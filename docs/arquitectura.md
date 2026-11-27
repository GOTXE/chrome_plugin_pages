# Arquitectura

Para quien quiera entender o modificar el código. Es una extensión **Manifest V3** en JavaScript puro con módulos ES: **sin compilación, sin dependencias y sin paso de build**. Las notas de diseño más detalladas, escritas como guía para quien toque el código, están en [`CLAUDE.md`](../CLAUDE.md).

## Mapa de archivos

```
manifest.json          Permisos, service worker, panel lateral. Sin default_popup (ver más abajo).
background.js          Service worker: modo de interfaz, sincronización, clasificación, insignia.
app/
  app.html             Una única interfaz para popup y panel lateral.
  app.js               Toda la lógica de la interfaz.
  app.css              Estilos (claro/oscuro con color-scheme).
shared/
  store.js             Ajustes, lista de guardadas, reglas de proposición, normalización de URL.
  categories.js        Categorías predefinidas y propias, nombres de subcarpeta.
  ai.js                Clasificación con OpenAI: petición, respuesta, lotes, límite, cola.
  learning.js          Memoria de correcciones: ejemplos, reglas de dominio, selección para el prompt.
  sync.js              Espejo bidireccional con la carpeta de marcadores y su organización.
docs/                  Esta documentación.
CLAUDE.md              Notas de diseño y reglas de trabajo (AGENTS.md es un enlace a este archivo).
```

## Los tres contextos

| Contexto | Archivo | Vida |
|---|---|---|
| **Interfaz** (popup o panel) | `app/app.js` | Mientras está abierta. El popup se destruye al cerrarlo. |
| **Service worker** | `background.js` | Efímero: el navegador lo apaga tras unos segundos de inactividad. |
| **Marcadores y pestañas** | API del navegador | Persistente. Es la fuente de verdad de la sincronización. |

Consecuencia clave: **el service worker no guarda estado en variables**. Todo lo que debe sobrevivir va a `chrome.storage.local`. Las pocas variables de módulo que hay (cola de peticiones, temporizadores) solo coordinan trabajo en curso.

La interfaz y el service worker se **comunican por `chrome.storage`**, no por la respuesta de los mensajes. La interfaz escribe un ajuste o lanza `classify`; el service worker trabaja y escribe el resultado; la interfaz reacciona a `storage.onChanged`. Así funciona aunque el popup se haya cerrado entre medias.

## Datos guardados

Todo en `chrome.storage.local`:

| Clave | Contenido |
|---|---|
| `settings` | Ajustes (ver [Ajustes](ajustes.md)). Mezclados con los valores por defecto de `DEFAULTS`. |
| `saved` | Lista de guardadas: `{ id, url, title, favIconUrl, domain, savedAt }`. |
| `syncedKeys` | Claves de URL que estaban en la lista y en los marcadores en la última pasada. Permite distinguir "nuevo aquí" de "borrado en otro sitio". **No quitar**: sin él, los borrados dejan de propagarse. |
| `classifications` | Caché por clave de URL: `{ category, action, confidence, at, source?, placed? }`. `source` solo lo llevan las que no vienen de la IA: `rule` (regla aprendida), `sync` (adoptada de una subcarpeta) o `user` (corrección del usuario). `placed`: subcarpeta donde este equipo dejó o vio el enlace. |
| `learned` | Ejemplos de correcciones: `{ key, domain, title, category?, action?, at }`, máximo 200. |
| `customCategories` | Categorías del usuario: `{ id, label, emoji, description }`. Los id son `u-xxxxxxxx` y no cambian al renombrar. |
| `openaiKey` | La clave de API. **En su propia entrada**, nunca dentro de `settings`. |
| `aiStatus`, `aiProgress`, `aiUsage` | Estado del último resultado o error, avance de la pasada en curso, y contador diario. |

## Flujos principales

### Proponer qué cerrar

`classify(tab, settings)` en `store.js` aplica las reglas en orden y devuelve `{ action, reason }`, más `doubtful: true` si ninguna regla decide. La interfaz superpone después el resultado de la IA, si lo hay, solo sobre las pestañas dudosas. Ver la [tabla de reglas](pestanas.md#cómo-decide-qué-proponer).

### Guardar y cerrar

`addSaved()` comprueba duplicados con `urlKey()` y escribe la lista. **Solo si funciona** se cierran las pestañas. Si cerrarlas dejara una ventana vacía, se crea una pestaña antes de cerrar.

### Comparar URL

`urlKey(url)` normaliza: ignora protocolo, `www`, ancla, barra final y parámetros de rastreo, y ordena el resto. Es la clave de la caché, de los duplicados y de la sincronización. **Úsala siempre que compares URL.**

### Sincronizar con marcadores

`requestSync()` (en `sync.js`) agrupa ráfagas de eventos y ejecuta una pasada tras otra. Cada pasada:

1. Localiza la carpeta "Leer luego" más antigua y une las duplicadas.
2. Lee el árbol completo (`readTree`).
3. Compara con la lista local y con `syncedKeys`: crea los marcadores nuevos, importa los que llegan, borra los que se quitaron de un lado.
4. Si la organización está activa, mueve los enlaces sueltos cuya categoría se conoce y adopta como categoría la de cada subcarpeta (`organizeByCategory`).

Se dispara con eventos de marcadores, cambios en `saved`, `settings`, `classifications` y `customCategories`, y al arrancar. Las pasadas son **idempotentes**: mover o adoptar dispara más pasadas, que no encuentran nada que hacer. No hay que quitar esa propiedad.

### Clasificar

1. La interfaz (o el modo automático) manda `{ type: 'classify', entries }` al service worker.
2. `classifyUrls()` encola la petición. Dentro, `selectPending()` descarta lo ya clasificado, lo no `http(s)`, los duplicados y los dominios protegidos.
3. Se aplican las **reglas de dominio aprendidas**: lo que resuelven se guarda sin llamar a OpenAI.
4. El resto se envía en **lotes de 20**, con los ejemplos del usuario añadidos al prompt. La respuesta es JSON con esquema estricto; se valida (categoría válida, acción `keep`/`later`, confianza acotada a 0–1).
5. Tras cada lote se guarda el resultado y se actualiza `aiProgress`. Al final, `aiStatus` y `aiProgress` se escriben en una sola llamada.

El esquema y el prompt se construyen **en cada petición** con la lista vigente de categorías (`categories()`), porque las del usuario pueden haber cambiado.

### Aprender

`organizeByCategory()` detecta que un enlace que este equipo había colocado (`placed`) aparece en otra subcarpeta, y entonces escribe un ejemplo con `addExamples()`. La interfaz hace lo mismo con las pestañas al pulsar *Guardar y cerrar*. `learnedRules()` y `pickExamples()` (en `learning.js`) los convierten en reglas y en ejemplos del prompt.

## Decisiones que no son obvias

- **Sin `default_popup` en el manifest.** Si lo tuviera, el popup se abriría antes de que el modo elegido estuviera aplicado. El service worker lo conmuta con `chrome.action.setPopup` y `sidePanel.setPanelBehavior({ openPanelOnActionClick })`; `action.onClicked` es solo un respaldo.
- **El panel va declarado en el manifest** (`side_panel.default_path`). Lo que se fija con `sidePanel.setOptions` no sobrevive a un reinicio, y sin un panel registrado `sidePanel.open()` falla con *No active side panel*.
- **`api.openai.com` es un permiso normal, no opcional.** `chrome.permissions.request` deja su promesa pendiente hasta que el usuario responde a un aviso anclado al icono; si no lo ve o cierra el panel, el ajuste no se guardaba. No volver a ligar el guardado de un ajuste a esa petición.
- **La clave de API no se sincroniza** (ni `chrome.storage.sync` ni marcadores). `chrome.storage.sync` además tiene un límite de unos 100 KB y en Brave los datos de extensiones no se sincronizan.
- **Los marcadores son el canal de sincronización** porque el navegador ya los sincroniza y se ven también en el móvil.
- **Manda la carpeta, no la IA** en la organización por subcarpetas, y **no se aprende de la propia IA**. Ver [Sincronización](sincronizacion.md#organizar-por-tipo-de-contenido) y [Aprendizaje](aprendizaje-y-categorias.md#aprendizaje).
- **La interfaz construye el DOM con `createElement` y `textContent`**, nunca con `innerHTML`, porque títulos y URL vienen de páginas ajenas.

## Probar los cambios

No hay pruebas automáticas en el repositorio. La comprobación mínima es la sintaxis:

```bash
node --check background.js app/app.js shared/*.js
```

Para probar de verdad, la extensión se puede cargar en un navegador con un perfil temporal y controlarlo por el protocolo de depuración. Para no gastar dinero en la IA, se puede apuntar `aiBaseUrl` (un ajuste sin pantalla) a un servidor local que imite `POST /v1/responses`. Así se comprobaron la clasificación, los avisos, el aprendizaje, las categorías y la sincronización con marcadores reales.

## Flujo de trabajo

- **Todo cambio entra por pull request.** Rama nueva, commit, push de la rama y PR. `main` está protegido en GitHub: PR obligatorio, sin *force push* ni borrado, también para administradores.
- Dos hooks refuerzan la regla en local: `.githooks/pre-push` (se activa con `git config core.hooksPath .githooks` tras clonar) y `.claude/hooks/block-main-push.sh`, que bloquea los push a `main` desde Claude Code.
- Los mensajes de commit van en español.

# Leer luego

Extensión Manifest V3 para Brave/Chrome. Guarda como "leer luego" las pestañas que llevan tiempo abiertas y las cierra, sin tocar las que se necesitan. JavaScript puro con módulos ES, sin build ni dependencias.

## Flujo de trabajo

- **Nunca se hace push a `main`: todo cambio entra por PR.** Rama nueva (`git switch -c tipo/descripcion`), commit, push de la rama y `gh pr create`. El merge lo decide el dueño del repo.
- El repo es público y `main` está protegido en GitHub (PR obligatorio, sin force push ni borrado, también para administradores).
- Dos hooks refuerzan la regla en local: `.githooks/pre-push` (git; se activa con `git config core.hooksPath .githooks` tras clonar) y `.claude/hooks/block-main-push.sh` (Claude Code, configurado en `.claude/settings.json`).
- Mensajes de commit en español, con la línea `Co-Authored-By` cuando los redacte Claude.

## Documentación

`docs/` es la documentación para el usuario (y `docs/arquitectura.md` para quien toque el código); el `README.md` es su resumen. **Cuando cambie el comportamiento visible, un ajuste, un permiso o lo que se envía a OpenAI, actualiza `docs/` y el README en el mismo PR.** Las capturas de `docs/img/` salen de la interfaz real con datos de ejemplo inventados (nunca datos personales); si cambia una pantalla, hay que rehacerlas. Los enlaces entre documentos y sus anclajes a secciones se comprueban a mano: tras editar títulos, verifica que no se rompen.

## Probar

No hay tests ni paso de compilación. En `brave://extensions` (o `chrome://extensions`): modo desarrollador → "Cargar descomprimida" → elegir esta carpeta. Tras cambiar código, recargar la extensión con el botón de la flecha circular. No hace falta "Empaquetar extensión".

Comprobación de sintaxis rápida: `node --check` sobre cada `.js`.

## Estructura

- `manifest.json`: sin `default_popup` a propósito (ver más abajo). Sin iconos: si se añaden, deben existir los archivos.
- `background.js`: service worker. Aplica el modo de interfaz y dispara la sincronización.
- `app/`: una única interfaz (`app.html/js/css`) que sirve como popup y como panel lateral; el popup se carga con `?mode=popup` y el panel sin parámetros.
- `shared/store.js`: ajustes, lista de guardadas, reglas de clasificación y normalización de URL.
- `shared/sync.js`: espejo bidireccional con una carpeta de marcadores.
- `shared/ai.js`: clasificación de URL con OpenAI (API Responses). `shared/categories.js`: lista de categorías por tipo de contenido.

## Decisiones que no son obvias

- **Popup o panel:** `background.js` conmuta con `chrome.action.setPopup` + `sidePanel.setPanelBehavior({ openPanelOnActionClick })` según `settings.uiMode`. El manifest no define `default_popup`; si lo hiciera, el popup se abriría antes de que el modo estuviera aplicado. `action.onClicked` es solo un respaldo. El panel se declara en el manifest (`side_panel.default_path`): lo que se fija con `sidePanel.setOptions` no sobrevive a un reinicio y sin panel registrado `sidePanel.open()` falla con "No active side panel". La propiedad es `openPanelOnActionClick`, no `...OnActionIconClick`.
- **Estado en `chrome.storage.local`, nunca en variables del service worker** (se apaga a los ~30 s). Claves: `settings`, `saved`, `syncedKeys`.
- **Duplicados:** se comparan con `urlKey()` (ignora `www`, protocolo, ancla, barra final y parámetros de rastreo), no con la URL en bruto. Úsala siempre que se compare una URL.
- **Sincronización:** los marcadores de la carpeta "Leer luego" son el canal, porque Brave Sync/Chrome Sync los sincronizan. `chrome.storage.sync` no sirve: ~100 KB de límite, Brave no sincroniza datos de extensiones y el ID de una extensión sin empaquetar cambia por equipo. `syncedKeys` distingue "nueva aquí" de "borrada en otro sitio"; no quitarlo, o los borrados dejarán de propagarse. Si la carpeta desaparece, se vuelve a subir lo local en lugar de borrar la lista.
- **Alcance:** una extensión solo ve las pestañas de su propio perfil de navegador. Varios perfiles necesitan la extensión cargada en cada uno.
- La interfaz se refresca sola con los eventos de `chrome.tabs` y `chrome.windows` (con debounce), porque el panel lateral queda abierto.

## Convenciones

- `async/await`, nunca cadenas `.then()`. Sin scripts ni manejadores en línea en el HTML.
- Texto de la interfaz en español. Construir el DOM con `textContent`/`createElement`, nunca `innerHTML` con títulos o URL de páginas.
- Permisos mínimos y justificados: `tabs`, `storage`, `unlimitedStorage`, `sidePanel`, `bookmarks`, `favicon`. Evitar `<all_urls>` salvo que una función lo exija.

## Categorías propias (`shared/categories.js`)

- La lista vigente es `categories()` = `BUILTIN_CATEGORIES` + `customCategories` de `storage.local` (`{ id, label, emoji, description }`, id `u-xxxxxxxx` estable aunque se renombre). El módulo la mantiene al día con `storage.onChanged`; los contextos que la usen sin haber leído storage (service worker) deben llamar a `loadCategories()` antes (ya lo hacen `run()` de sync y `classifyNow` de ai).
- Nunca asumir la lista fija: el esquema JSON y el prompt de OpenAI se construyen en cada petición con `categories()`. La `description` del usuario es lo que se le explica al modelo.
- Los nombres no pueden repetirse (sin distinguir mayúsculas) con ninguna categoría (`validateLabel`).
- **Editar** una categoría renombra sus subcarpetas de marcadores (`categoryFolderIds` antes de guardar); si no, dejarían de reconocerse y se crearían otras. **Borrar** olvida su clasificación y sus ejemplos, pero no toca las subcarpetas: pasan a ser carpetas propias del usuario.
- **Las categorías propias son locales** (no se sincronizan). En otro equipo, la subcarpeta aparece como carpeta propia y `listOwnFolders` la propone como categoría si tiene >= 3 enlaces (`MIN_LINKS_FOR_SUGGESTION`); "Ignorar" se guarda en `settings.ignoredFolders`. Convertirla nombra la categoría como la carpeta (`parseFolderTitle` separa el emoji) y sus enlaces se adoptan con `source: 'sync'`, sin contar como correcciones.

## Aprendizaje (`shared/learning.js`)

No se entrena nada: se guarda una lista corta (`learned`, máx. 200, un ejemplo por URL) de correcciones del usuario con dominio y título (nunca la ruta), y se usa de dos formas, ambas gobernadas por `settings.aiLearning`:
1. **Reglas de dominio** (`learnedRules`): >= 3 correcciones del mismo dominio y >= 80 % a la misma categoría → esa categoría se aplica sin llamar a OpenAI (`source: 'rule'`). Sin acción aprendida (`learnedAction`) se propone `keep`, porque una regla de categoría no dice si cerrar la pestaña.
2. **Ejemplos en el prompt** (`pickExamples`): los del mismo dominio del lote primero, luego los más recientes, hasta 24. Se presentan como datos, nunca como instrucciones.
- **Qué cuenta como corrección:** (a) mover un marcador entre subcarpetas de categoría, y (b) contradecir una propuesta de la IA en las pestañas, al pulsar "Guardar y cerrar". **No** se aprende de la propia IA: `cache[key].placed` recuerda en qué subcarpeta dejó o vio este equipo cada enlace; solo si luego aparece en otra es corrección. Un enlace que llega ya organizado por Sync se adopta (`source: 'sync'`) sin generar ejemplo, porque no se puede saber si lo puso el usuario o la IA de otro dispositivo.
- El panel "Lo aprendido" de Ajustes lista ejemplos y reglas y permite olvidarlos: es obligatorio mantenerlo, porque los ejemplos se envían a OpenAI y una señal equivocada debe poder borrarse.
- Los ejemplos no se sincronizan entre dispositivos (salvo lo que ya viaja en las carpetas).

## Subcarpetas por tipo en los marcadores

Ajuste `organizeBookmarks` (apagado por defecto: reorganiza los marcadores del usuario). Dentro de "Leer luego" hay una subcarpeta por categoría, con el nombre `folderTitle()` (emoji + etiqueta, p. ej. "📰 Noticias").
- **Manda la carpeta, no la IA.** Un enlace que ya está en una subcarpeta de categoría no se mueve nunca, y esa subcarpeta se adopta como su categoría en la caché (`source: 'folder'`). Así las categorías viajan entre dispositivos sin volver a pagar la clasificación, y mover un marcador a mano cuenta como corrección del usuario (base del aprendizaje futuro). Solo se mueven los enlaces sueltos en la raíz cuya categoría ya se conoce.
- Las subcarpetas con otro nombre son del usuario: sus enlaces cuentan como guardadas pero no se tocan.
- La sincronización lee el árbol completo (`readTree`), no solo los hijos directos. Las carpetas "Leer luego" duplicadas se unen conservando sus subcarpetas, y las subcarpetas de categoría duplicadas (dos dispositivos creándolas a la vez) se unen en la más antigua.
- La carpeta de categoría se crea al mover algo a ella; las vacías no se borran (otro dispositivo podría estar moviendo algo en ese momento).
- Mover o adoptar dispara más pasadas de `requestSync` (`onMoved`, cambios en `classifications`): son idempotentes, no quitar esa propiedad.

## Clasificación con IA (OpenAI)

- **Solo OpenAI**, con `POST /v1/responses` y salida JSON estricta (`text.format` con `json_schema`). Modelo por defecto `gpt-6-luna`, configurable en Ajustes. Antes de tocar nombres de modelo o la forma de la API, comprobar la documentación vigente.
- **Qué se envía:** solo dominio y título (truncado), nunca la ruta/query de la URL ni el contenido de la página. Los dominios de `keepDomains` no se envían. `store: false`. Cualquier cambio que envíe más datos debe ser opt-in y quedar reflejado en el README.
- **Dónde actúa:** solo en las pestañas "dudosas" (`classify()` devuelve `doubtful: true` cuando ninguna regla decide) y en las guardadas, para agruparlas. La IA solo marca una pestaña para cerrar si `action === 'later'` y la confianza es >= `MIN_CONFIDENCE`; el usuario siempre confirma.
- **Modos:** manual (botón con vista previa de lo que se envía) y automático (cada URL nueva que entra en guardadas, también las que llegan por Sync, más las pestañas dudosas al abrir la interfaz). No se clasifica cada navegación: eso enviaría el historial.
- **La clave de API** va en su propia entrada `openaiKey` de `storage.local`, nunca dentro de `settings`, y no se sincroniza (ni `chrome.storage.sync` ni marcadores). El acceso a `api.openai.com` es un `host_permissions` normal, **no opcional**: `chrome.permissions.request` deja la promesa pendiente hasta que el usuario responde a un aviso anclado al icono de la extensión, y si no lo ve o cierra el panel antes, el ajuste no se guardaba (se desmarcaba al reabrir). No volver a ligar el guardado de un ajuste a esa petición.
- **Caché:** `classifications` (por `urlKey`) evita reenviar lo ya clasificado. `aiUsage` limita las URL por día (`aiDailyLimit`). `aiStatus` guarda el último resultado o error y `aiProgress` el avance (lotes de 20). La interfaz los lee de storage —no de la respuesta del mensaje— para mostrar un aviso superior con barra de progreso, el resultado (se cierra solo a los 15 s o con ✕) y los errores (solo con ✕); el service worker pone además una insignia en el icono (`…` clasificando, `!` error) para que se vea con el popup cerrado. Al terminar, `aiStatus` y `aiProgress` se escriben en una sola llamada para que la interfaz no vea estados intermedios.
- **La ejecuta el service worker** (mensaje `classify`), no el popup, para que no se corte al cerrarlo. Las peticiones se encolan en `classifyUrls`.
- `settings.aiBaseUrl` no sale en la interfaz: permite apuntar a un servidor falso en pruebas (un servidor local que imite `/v1/responses`) sin gastar dinero.

## Fuera de alcance por ahora

Guardar el contenido de los artículos (scraping) se descartó. Nada pendiente de lo hablado. Ideas sin pedir: sincronizar las categorías propias entre dispositivos, ocultar categorías predefinidas.

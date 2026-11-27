# Leer luego

Extensión Manifest V3 para Brave/Chrome. Guarda como "leer luego" las pestañas que llevan tiempo abiertas y las cierra, sin tocar las que se necesitan. JavaScript puro con módulos ES, sin build ni dependencias.

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

## Clasificación con IA (OpenAI)

- **Solo OpenAI**, con `POST /v1/responses` y salida JSON estricta (`text.format` con `json_schema`). Modelo por defecto `gpt-6-luna`, configurable en Ajustes. Antes de tocar nombres de modelo o la forma de la API, comprobar la documentación vigente.
- **Qué se envía:** solo dominio y título (truncado), nunca la ruta/query de la URL ni el contenido de la página. Los dominios de `keepDomains` no se envían. `store: false`. Cualquier cambio que envíe más datos debe ser opt-in y quedar reflejado en el README.
- **Dónde actúa:** solo en las pestañas "dudosas" (`classify()` devuelve `doubtful: true` cuando ninguna regla decide) y en las guardadas, para agruparlas. La IA solo marca una pestaña para cerrar si `action === 'later'` y la confianza es >= `MIN_CONFIDENCE`; el usuario siempre confirma.
- **Modos:** manual (botón con vista previa de lo que se envía) y automático (cada URL nueva que entra en guardadas, también las que llegan por Sync, más las pestañas dudosas al abrir la interfaz). No se clasifica cada navegación: eso enviaría el historial.
- **La clave de API** va en su propia entrada `openaiKey` de `storage.local`, nunca dentro de `settings`, y no se sincroniza (ni `chrome.storage.sync` ni marcadores). El acceso a `api.openai.com` es un `host_permissions` normal, **no opcional**: `chrome.permissions.request` deja la promesa pendiente hasta que el usuario responde a un aviso anclado al icono de la extensión, y si no lo ve o cierra el panel antes, el ajuste no se guardaba (se desmarcaba al reabrir). No volver a ligar el guardado de un ajuste a esa petición.
- **Caché:** `classifications` (por `urlKey`) evita reenviar lo ya clasificado. `aiUsage` limita las URL por día (`aiDailyLimit`). `aiStatus` guarda el último resultado o error para mostrarlo en Ajustes.
- **La ejecuta el service worker** (mensaje `classify`), no el popup, para que no se corte al cerrarlo. Las peticiones se encolan en `classifyUrls`.
- `settings.aiBaseUrl` no sale en la interfaz: permite apuntar a un servidor falso en pruebas (un servidor local que imite `/v1/responses`) sin gastar dinero.
- **Categorías:** la lista está en `shared/categories.js`; el código las recibe como dato. Está previsto que el usuario pueda añadir las suyas y que la app aprenda de sus correcciones; aún no está hecho.

## Fuera de alcance por ahora

Guardar el contenido de los artículos (scraping) se descartó. Aprendizaje a partir de las correcciones del usuario y categorías definidas por el usuario: pendientes, no añadirlos sin que se pida.

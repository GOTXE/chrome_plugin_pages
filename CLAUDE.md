# Leer luego

Extensión Manifest V3 para Brave/Chrome. Guarda como "leer luego" las pestañas que llevan tiempo abiertas y las cierra, sin tocar las que se necesitan. JavaScript puro con módulos ES, sin build ni dependencias.

## Flujo de trabajo

- **Nunca se hace push a `main`: todo cambio entra por PR.** Rama nueva (`git switch -c tipo/descripcion`), commit, push de la rama y `gh pr create`. El merge lo decide el dueño del repo.
- El repo es público y `main` está protegido en GitHub (PR obligatorio, sin force push ni borrado, también para administradores).
- Dos hooks refuerzan la regla en local: `.githooks/pre-push` (git; se activa con `git config core.hooksPath .githooks` tras clonar) y `.claude/hooks/block-main-push.sh` (Claude Code, configurado en `.claude/settings.json`).
- Mensajes de commit en español, con la línea `Co-Authored-By` cuando los redacte Claude.

## Probar

No hay tests ni paso de compilación. En `brave://extensions` (o `chrome://extensions`): modo desarrollador → "Cargar descomprimida" → elegir esta carpeta. Tras cambiar código, recargar la extensión con el botón de la flecha circular. No hace falta "Empaquetar extensión".

Comprobación de sintaxis rápida: `node --check` sobre cada `.js`.

## Estructura

- `manifest.json`: sin `default_popup` a propósito (ver más abajo). Sin iconos: si se añaden, deben existir los archivos.
- `background.js`: service worker. Aplica el modo de interfaz y dispara la sincronización.
- `app/`: una única interfaz (`app.html/js/css`) que sirve como popup y como panel lateral; el modo llega por `?mode=popup|panel`.
- `shared/store.js`: ajustes, lista de guardadas, reglas de clasificación y normalización de URL.
- `shared/sync.js`: espejo bidireccional con una carpeta de marcadores.

## Decisiones que no son obvias

- **Popup o panel:** `background.js` conmuta con `chrome.action.setPopup` + `sidePanel.setPanelBehavior({ openPanelOnActionClick })` según `settings.uiMode`. El manifest no define `default_popup`; si lo hiciera, el popup se abriría antes de que el modo estuviera aplicado. `action.onClicked` es solo un respaldo. La propiedad es `openPanelOnActionClick`, no `...OnActionIconClick`.
- **Estado en `chrome.storage.local`, nunca en variables del service worker** (se apaga a los ~30 s). Claves: `settings`, `saved`, `syncedKeys`.
- **Duplicados:** se comparan con `urlKey()` (ignora `www`, protocolo, ancla, barra final y parámetros de rastreo), no con la URL en bruto. Úsala siempre que se compare una URL.
- **Sincronización:** los marcadores de la carpeta "Leer luego" son el canal, porque Brave Sync/Chrome Sync los sincronizan. `chrome.storage.sync` no sirve: ~100 KB de límite, Brave no sincroniza datos de extensiones y el ID de una extensión sin empaquetar cambia por equipo. `syncedKeys` distingue "nueva aquí" de "borrada en otro sitio"; no quitarlo, o los borrados dejarán de propagarse. Si la carpeta desaparece, se vuelve a subir lo local en lugar de borrar la lista.
- **Alcance:** una extensión solo ve las pestañas de su propio perfil de navegador. Varios perfiles necesitan la extensión cargada en cada uno.
- La interfaz se refresca sola con los eventos de `chrome.tabs` y `chrome.windows` (con debounce), porque el panel lateral queda abierto.

## Convenciones

- `async/await`, nunca cadenas `.then()`. Sin scripts ni manejadores en línea en el HTML.
- Texto de la interfaz en español. Construir el DOM con `textContent`/`createElement`, nunca `innerHTML` con títulos o URL de páginas.
- Permisos mínimos y justificados: `tabs`, `storage`, `unlimitedStorage`, `sidePanel`, `bookmarks`, `favicon`. Evitar `<all_urls>` salvo que una función lo exija.

## Fuera de alcance por ahora

Guardar el contenido de los artículos (scraping) y la clasificación con IA se descartaron o se aplazaron. No añadirlos sin que se pida.

# Leer luego

> ⚠️ **Proyecto en desarrollo (WIP).** Funciona, pero está sin pulir y puede cambiar o fallar. No está publicado en ninguna tienda.

Extensión para Brave, Chrome y otros navegadores Chromium que ayuda a no acumular pestañas. Guarda como "leer luego" las que llevan días abiertas y las cierra, sin tocar las que necesitas.

## Qué hace

- Lista las pestañas abiertas de todas las ventanas del perfil y propone cuáles guardar y cerrar:
  - las que llevan varios días sin abrirse (configurable),
  - las de dominios que marcas como "siempre leer luego".
- No propone las ancladas, en grupo, con audio, activas ni las páginas internas, ni las de dominios que marques como protegidos.
- Tú decides: puedes marcar o desmarcar cada pestaña, o fijar una regla para un dominio entero (🔒 nunca, 📖 siempre).
- Avisa de las pestañas duplicadas (🔁) y de las que ya están guardadas (✅).
- Lista de guardadas con buscador, abrir y quitar, copiar las URL y exportar a Markdown.
- Funciona como popup o como panel lateral, a elegir en Ajustes. La lista se actualiza sola.
- Sincroniza las guardadas entre dispositivos mediante una carpeta de marcadores "Leer luego", que viaja con Brave Sync o Chrome Sync.

## Instalación

No está en ninguna tienda, se carga sin empaquetar:

1. Clona o descarga este repositorio.
2. Abre `brave://extensions` (o `chrome://extensions`) y activa el **modo desarrollador**.
3. Pulsa **Cargar descomprimida** y elige la carpeta del proyecto.
4. Fija la extensión desde el icono del puzzle de la barra.

Hay que repetirlo en cada ordenador y en cada perfil del navegador. Una extensión solo ve las pestañas de su propio perfil.

## Estado y limitaciones conocidas

- **Panel lateral:** en algunos casos el icono abre el popup en lugar del panel. Está pendiente de investigar, sobre todo al arrancar el navegador.
- **Sincronización con marcadores:** hecha pero poco probada entre dispositivos reales, sobre todo la propagación de borrados. Pruébala con pocos enlaces antes de fiarte.
- Sin iconos propios todavía.
- Sin clasificación con IA ni guardado del contenido de los artículos. Por ahora solo se guardan enlaces.

## Privacidad

Todo se guarda en local en el navegador. La extensión no envía datos a ningún servidor. Los marcadores solo salen del equipo si tienes activada la sincronización del propio navegador.

Permisos que pide: `tabs` (leer título y URL), `storage` y `unlimitedStorage` (guardar la lista), `sidePanel` (modo panel), `bookmarks` (sincronización) y `favicon` (iconos de las guardadas).

## Desarrollo

JavaScript puro con módulos ES, sin compilación ni dependencias. Tras cambiar código, recarga la extensión desde la página de extensiones. Las notas de diseño están en [`CLAUDE.md`](CLAUDE.md).

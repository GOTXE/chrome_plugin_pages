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
- Clasificación opcional con IA (OpenAI): etiqueta cada enlace por tipo de contenido (blog, noticias, tutorial, referencia…), propone qué pestañas dudosas guardar y agrupa la lista de guardadas por esos tipos. Desactivada por defecto.
- Funciona como popup o como panel lateral, a elegir en Ajustes. La lista se actualiza sola.
- Sincroniza las guardadas entre dispositivos mediante una carpeta de marcadores "Leer luego", que viaja con Brave Sync o Chrome Sync.
- Puedes crear tus propias categorías (con nombre, emoji y una descripción que se le explica a la IA) y la extensión te propone convertir en categoría las subcarpetas tuyas de "Leer luego" que tengan varios enlaces.
- Aprende de tus correcciones (mover un enlace a otra subcarpeta, o contradecir una propuesta de pestañas): usa esos ejemplos al clasificar y, si un dominio se repite, lo clasifica sin enviarlo a OpenAI. Puedes ver y olvidar lo aprendido en Ajustes.
- Opcional: organiza esa carpeta en subcarpetas por tipo de contenido (📰 Noticias, 🧭 Tutoriales…). Si mueves un enlace a otra subcarpeta, se toma como una corrección tuya. Desactivado por defecto.

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
- Las categorías propias viven en cada navegador (no se sincronizan): en otro equipo aparecen como subcarpetas tuyas que puedes convertir en categoría. Tampoco se guarda el contenido de los artículos: solo los enlaces.

## Privacidad

Todo se guarda en local en el navegador. Los marcadores solo salen del equipo si tienes activada la sincronización del propio navegador.

La clasificación con IA es opcional y está desactivada por defecto. Si la activas, la extensión envía a OpenAI **solo el dominio y el título** de cada URL (nunca la ruta, los parámetros ni el contenido de la página), pidiendo que no conserve la respuesta. Si el aprendizaje está activo, junto a las URL nuevas se envían también hasta 24 ejemplos tuyos (también dominio y título), que puedes ver y borrar en Ajustes. En modo manual ves antes la lista exacta de lo que se enviará. La clave de API se guarda únicamente en el navegador donde la pegas y no se sincroniza; usa una clave de proyecto con límite de gasto.

Permisos que pide: `tabs` (leer título y URL), `storage` y `unlimitedStorage` (guardar la lista), `sidePanel` (modo panel), `bookmarks` (sincronización), `favicon` (iconos de las guardadas) y acceso a `api.openai.com` (solo se usa si activas la IA y pones tu clave).

## Desarrollo

JavaScript puro con módulos ES, sin compilación ni dependencias. Tras cambiar código, recarga la extensión desde la página de extensiones. Las notas de diseño están en [`CLAUDE.md`](CLAUDE.md).

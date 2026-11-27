# Primeros pasos

## Instalar

La extensión no está en ninguna tienda: se carga sin empaquetar desde la carpeta del proyecto.

1. Clona o descarga el repositorio.
2. Abre `brave://extensions` (en Chrome, `chrome://extensions`).
3. Activa el **modo desarrollador**, arriba a la derecha.
4. Pulsa **Cargar descomprimida** y elige la carpeta del proyecto, la que contiene `manifest.json`.
5. Fija la extensión desde el icono del puzzle de la barra de herramientas, para tener el icono siempre a mano.

> No uses "Empaquetar extensión": genera un archivo `.crx` para distribuirla y no sirve para probarla.

## Abrirla

Pulsa el icono de **Leer luego**. Según tu elección en [Ajustes](ajustes.md), se abre como:

- **Popup** (por defecto): una ventana pequeña anclada al icono. Se cierra al hacer clic fuera.
- **Panel lateral**: se queda abierto a un lado mientras navegas y se actualiza solo.

Puedes cambiar entre los dos cuando quieras en *Ajustes → Interfaz*. Es la misma pantalla en ambos casos.

Si eliges el panel lateral y alguna vez se abre el popup en su lugar, la extensión lo detecta: aparece un aviso con el botón **Abrir en panel lateral** y vuelve a aplicar el modo para que el siguiente clic funcione. Más detalles en [Solución de problemas](problemas.md).

## Tu primera limpieza

1. Abre la extensión: estás en la vista **Pestañas**. Arriba ves un resumen: `10 pestañas en 2 ventanas · 5 marcadas para guardar y cerrar`.
2. Las pestañas marcadas son las que la extensión propone guardar. Cada fila indica el motivo (por ejemplo `sin abrir hace 4 d` o `dominio de lectura`).
3. Revisa la lista. Desmarca las que quieras conservar abiertas, o marca otras que quieras guardar.
4. Pulsa **Guardar y cerrar (N)**. La extensión guarda primero la lista y, solo si ha funcionado, cierra las pestañas.
5. Ve a **Guardadas** para ver lo guardado. Desde ahí lo abres cuando quieras leerlo.

Si dos pestañas son la misma página, se guarda una sola vez y se cierran las dos.

## Actualizar la extensión

Cuando cambie el código (por ejemplo, tras un `git pull`):

1. Abre `brave://extensions`.
2. Pulsa el botón de la **flecha circular** de la tarjeta de *Leer luego*.
3. Cierra y vuelve a abrir el popup o el panel.

**No hace falta reiniciar el navegador.** Si el navegador desactivara la extensión por haber cambiado sus permisos, se reactiva con el interruptor de esa misma tarjeta.

Dos cosas que conviene saber:

- Si cargas la extensión **desde otra carpeta**, el navegador le da otro identificador y **los ajustes se pierden**, porque se guardan por extensión. La lista de guardadas no se pierde si tienes activada la [sincronización con marcadores](sincronizacion.md), porque está también en la carpeta de marcadores.
- Los datos de la extensión se borran si la **desinstalas**. La carpeta de marcadores "Leer luego" no se toca.

## Varios ordenadores y varios perfiles

- Hay que **instalar la extensión en cada ordenador y en cada perfil** del navegador. Una extensión solo ve las pestañas de su propio perfil.
- Los **ajustes son locales**: cada instalación tiene los suyos. Esto incluye la clave de OpenAI y las categorías propias.
- Lo que sí viaja entre equipos es la **lista de guardadas**, mediante la carpeta de marcadores. Necesita tener activado el Sync del navegador con *Marcadores*. Ver [Sincronización](sincronizacion.md).

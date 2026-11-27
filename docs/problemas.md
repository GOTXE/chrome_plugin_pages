# Solución de problemas

## La extensión

### No veo las pestañas de alguna ventana

Las pestañas que no aparecen casi siempre pertenecen a **otro perfil del navegador**. Una extensión solo ve las pestañas de su propio perfil, y cada perfil tiene sus propias extensiones: si en una ventana no aparece el icono de *Leer luego*, es de otro perfil. Para verlas, instala la extensión también en ese perfil.

Otras causas:

- **Ventanas privadas**: las extensiones no entran en ellas salvo que lo permitas en los detalles de la extensión. Aun así, mezclar pestañas privadas con la lista guardada no es recomendable.
- **Ventanas que no son normales** (una aplicación instalada, por ejemplo).

El resumen de arriba, `10 pestañas en 2 ventanas`, te dice exactamente cuántas ve.

### Al pulsar el icono se abre el popup y yo había elegido el panel lateral

Cada vez que se abre el popup con el panel elegido, aparece una franja con el botón **Abrir en panel lateral**. Púlsalo: abre el panel, cierra el popup y deja aplicado el modo para que el siguiente clic funcione.

Si el botón falla, muestra el motivo y las ventanas que ve el navegador. Además, en **Ajustes → Interfaz** hay una línea de *Estado* con el valor real:

```
Estado: ajuste=panel · esta vista=popup · popup=vacío · el icono abre el panel=true
```

Si dice `ajuste=popup`, lo que tienes guardado en este navegador es el popup. Los ajustes son locales de cada perfil y de cada ordenador, así que hay que elegir *Panel lateral* en cada uno.

### Mis ajustes han desaparecido

Los ajustes se guardan por extensión. Si cargas la extensión **desde otra carpeta**, el navegador le da otro identificador y empieza de cero. Cárgala siempre desde la misma carpeta. La lista de guardadas se recupera sola desde la carpeta de marcadores, si la sincronización estaba activa.

### He actualizado el código y no veo cambios

Recarga la extensión con la flecha circular en `brave://extensions` y cierra y abre el popup o el panel. No hace falta reiniciar el navegador.

### Una pestaña no se puede marcar

Es una página interna del navegador (`brave://…`, `about:blank`…). Esas no se pueden guardar.

### La lista no se actualiza

Se refresca sola al cambiar pestañas. Si tienes el panel lateral oculto, se actualiza al volver a mostrarlo.

## Sincronización

### Los enlaces no llegan al otro equipo

Compruébalo en este orden:

1. **Sync activo con Marcadores** en los dos dispositivos, y misma cadena. En Brave: `brave://settings/braveSync`.
2. Abre `brave://bookmarks` en cada equipo y mira si existe la carpeta **Leer luego** en *Otros marcadores*, y cuántas hay. Debería haber **una**.
3. Espera unos minutos: el Sync del navegador no es instantáneo.
4. Comprueba que el ajuste *Sincronizar guardadas con la carpeta de marcadores* está activado en los dos.

Si hay **dos carpetas "Leer luego"**, la extensión las une sola en cuanto el navegador avisa del cambio en los marcadores. Si no ocurre, recarga la extensión: al arrancar, repasa la carpeta y las une.

### He borrado la carpeta "Leer luego" y ha vuelto

Es lo esperado. La extensión no puede saber si fue intencionado y recrea la carpeta con lo que tienes en local, sin borrar tu lista. Para vaciarla de verdad, quita los enlaces desde *Guardadas*, o desactiva la sincronización.

### Las subcarpetas por tipo no se crean

- Revisa que **Organizar esa carpeta en subcarpetas por tipo de contenido** esté activado y que la sincronización también.
- Solo se mueven los enlaces que ya tienen categoría. Sin [IA](ia.md) activada, no hay categorías que usar.
- Los enlaces dentro de una subcarpeta con otro nombre no se mueven: es tuya.

## Clasificación con IA

Los mensajes de error y su causa están en [Clasificación con IA → Errores habituales](ia.md#errores-habituales). Aquí, otros síntomas:

### El botón de clasificar no aparece

- La IA tiene que estar activada y tener clave puesta.
- Solo hay botón en **modo manual**. En automático la clasificación ocurre sola.
- Solo aparece si hay algo pendiente: sin URL sin clasificar, no hay botón.
- Mientras hay una clasificación en curso, se oculta.

### Algunas URL se quedan sin clasificar

- Las de dominios de *Dominios que nunca se proponen* no se envían.
- Las páginas internas no se envían.
- Si se alcanzó el **límite diario**, el aviso lo indica y dice cuántas quedan.
- Si el modelo no devuelve resultado para alguna, queda pendiente para la siguiente pasada.

### Hay una `!` en el icono

Hubo un error en la última clasificación. Abre la extensión: la franja roja dice cuál fue. Pulsa la ✕ para quitar el aviso y la insignia.

### Se ha clasificado mal un enlace

Muévelo a la subcarpeta correcta de la carpeta de marcadores, si tienes activada la organización por tipo: esa corrección se [aprende](aprendizaje-y-categorias.md). Si ya no quieres que una corrección tenga efecto, bórrala en **Ajustes → Lo aprendido**.

## Categorías y aprendizaje

### Mis categorías propias no aparecen en otro ordenador

Es una limitación conocida: las categorías propias son locales de cada navegador. En el otro equipo verás su subcarpeta como una carpeta tuya, y la extensión te propondrá convertirla en categoría cuando tenga 3 o más enlaces.

### Una regla de dominio clasifica mal

Bórrala en **Ajustes → Lo aprendido → Reglas por dominio** (✕). Si el dominio mezcla tipos de contenido, por ejemplo un blog con tutoriales y opiniones, una regla por dominio lo clasificará siempre igual. Olvidarla devuelve la decisión a la IA.

## Pedir ayuda

Si algo no funciona y no está aquí, abre un *issue* en el repositorio con:

- Qué hacías y qué esperabas.
- El mensaje de error, si lo hay.
- La línea de **Estado** de *Ajustes → Interfaz*, si es un problema de apertura.
- Tu navegador y su versión.

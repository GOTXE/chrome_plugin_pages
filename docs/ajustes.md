# Ajustes

Todos los ajustes son **locales**: se guardan en el navegador y perfil donde los cambias, y no se sincronizan. Se aplican al momento, sin botón de guardar.

## Interfaz

| Ajuste | Valores | Por defecto |
|---|---|---|
| **Interfaz** | Popup · Panel lateral | Popup |

Cambia cómo se abre la extensión al pulsar su icono. Si tu navegador no admite paneles laterales para extensiones, esa opción aparece desactivada.

Debajo hay una línea de **Estado** con el valor real, útil si algo no se comporta como esperas:

```
Estado: ajuste=panel · esta vista=popup · popup=vacío · el icono abre el panel=true
```

Significa: lo que tienes elegido, cómo se ha abierto esta pantalla, si el icono tiene un popup asociado y si el icono abre el panel.

## Sincronización

| Ajuste | Por defecto | Qué hace |
|---|---|---|
| **Sincronizar guardadas con la carpeta de marcadores "Leer luego"** | Activado | Mantiene tu lista espejada con una carpeta de marcadores, que viaja con el Sync del navegador. Ver [Sincronización](sincronizacion.md). |
| **Organizar esa carpeta en subcarpetas por tipo de contenido** | Desactivado | Coloca los enlaces clasificados en subcarpetas con emoji. Requiere la sincronización. Reorganiza tus marcadores, por eso viene apagado. |

## Reglas de proposición

| Ajuste | Rango | Por defecto | Qué hace |
|---|---|---|---|
| **Días sin abrir para proponer "leer luego"** | 0 – 365 | 3 | Una pestaña que lleva sin abrirse al menos estos días se marca para guardar. Con 0, se marcan todas las que ninguna regla proteja. |
| **Dominios que nunca se proponen** | Uno por línea | Vacío | Sus pestañas nunca se marcan, y sus URL nunca se envían a la IA. |
| **Dominios que siempre son "leer luego"** | Uno por línea | Vacío | Sus pestañas siempre se marcan. |

Los dominios se pueden escribir como `github.com` o como una dirección completa; se normalizan solos. Un dominio incluye sus subdominios: `medium.com` cubre `blog.medium.com`.

Los botones 🔒 y 📖 de la vista [Pestañas](pestanas.md) editan estas dos listas.

## Clasificación con IA (OpenAI)

| Ajuste | Por defecto | Qué hace |
|---|---|---|
| **Activar la clasificación con IA** | Desactivado | Habilita todo lo de [IA](ia.md). Sin esto, la extensión no envía nada a OpenAI. |
| **Manual / Automático** | Manual | Manual: tú pulsas el botón y ves antes lo que se envía. Automático: se clasifica solo cada URL nueva guardada y las pestañas dudosas al abrir la extensión. |
| **Clave de API de OpenAI** | — | Se guarda solo en este navegador. El campo nunca la muestra: escribe una nueva para cambiarla, o usa **Borrar la clave guardada**. |
| **Modelo** | `gpt-6-luna` | Identificador del modelo de OpenAI. Si lo dejas vacío, vuelve al de por defecto. |
| **Máximo de URL clasificadas por día** | 300 (0 – 5000) | Tope de URL enviadas a OpenAI cada día. Al llegar, la clasificación se detiene hasta el día siguiente o hasta que lo subas. |

Debajo ves una línea de resumen: `Hoy: 68/300 URL · última pasada: 56 clasificadas + 12 por lo aprendido (12:12:18)`, o el error de la última pasada si falló.

## Categorías

La lista de categorías: las tuyas arriba y las predefinidas debajo, que no se pueden cambiar. Desde aquí creas, editas y borras categorías propias, y conviertes en categoría tus subcarpetas. Ver [Categorías propias y aprendizaje](aprendizaje-y-categorias.md).

## Lo aprendido

| Ajuste | Por defecto | Qué hace |
|---|---|---|
| **Usar lo aprendido al clasificar** | Activado | Permite usar tus correcciones: reglas de dominio y ejemplos en el prompt. Solo tiene efecto si la IA está activada. |

Debajo, las **reglas por dominio** y los **ejemplos** aprendidos, cada uno con una ✕ para olvidarlo, y **Olvidar todo**.

## Ajustes sin pantalla propia

| Dato | Dónde se cambia | Qué es |
|---|---|---|
| Agrupación de *Guardadas* | El selector de la propia vista | Tipo de contenido, sitio, fecha o sin agrupar. |
| Subcarpetas ignoradas | El ✕ de una sugerencia en *Categorías* | Subcarpetas tuyas que no quieres que se te propongan como categoría. |
| `aiBaseUrl` | Solo por código | Dirección del servidor de la API. Existe para probar con un servidor falso sin gastar dinero; no está pensado para usarse. |

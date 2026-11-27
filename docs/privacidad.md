# Privacidad y permisos

**La extensión no tiene servidor propio, ni analítica, ni cuentas.** No envía nada a quien la ha escrito. Lo único que puede salir de tu equipo es lo que se describe aquí, y casi todo es opcional.

## Dónde se guarda cada cosa

| Dato | Dónde | ¿Sale del equipo? |
|---|---|---|
| Lista de guardadas (URL, título, dominio, fecha) | Almacenamiento de la extensión en tu navegador | Solo si tienes activada la [sincronización](sincronizacion.md): se copia a la carpeta de marcadores, que viaja por el Sync de tu navegador bajo sus propias condiciones. |
| Ajustes y listas de dominios | Almacenamiento de la extensión | No. |
| Categorías propias | Almacenamiento de la extensión | No. (La subcarpeta de marcadores que las representa sí viaja, si organizas por tipo.) |
| Categoría de cada URL clasificada | Almacenamiento de la extensión | No. (Si organizas por tipo, se refleja en el nombre de la subcarpeta del marcador.) |
| Lo aprendido (ejemplos) | Almacenamiento de la extensión | Solo hacia OpenAI, y solo en las condiciones de abajo. |
| Clave de API de OpenAI | Almacenamiento de la extensión | Solo se envía a OpenAI para autenticar las peticiones. No se sincroniza. |
| Contadores y estado de la IA | Almacenamiento de la extensión | No. |

**Sobre la clave de API:** se guarda sin cifrar en el almacenamiento propio de la extensión. Otras extensiones no pueden leerla, pero cualquiera con acceso a tu perfil del navegador, sí. Por eso conviene usar una **clave de proyecto con permisos mínimos y límite de gasto**, y borrarla con *Borrar la clave guardada* cuando no la uses.

## Qué se envía a OpenAI, y cuándo

**Nada, mientras no actives la IA.** Con la IA activada y una clave puesta, solo cuando se clasifica (en modo manual, cuando pulsas *Enviar* tras ver la vista previa; en modo automático, cada vez que entra una URL nueva en *Guardadas* y al abrir la extensión):

| Se envía | No se envía nunca |
|---|---|
| El **dominio** de cada URL | La ruta de la URL ni sus parámetros |
| El **título** (recortado a 140 caracteres) | El contenido de la página |
| Un número de orden | Tu historial de navegación: solo se clasifican URL guardadas o pestañas dudosas abiertas, nunca cada página que visitas |
| Si el aprendizaje está activo: hasta **24 ejemplos** tuyos (dominio, título y tu elección) | Las URL de dominios de *Dominios que nunca se proponen* |

Además, la petición pide a OpenAI que **no conserve la respuesta**. Lo que OpenAI haga con los datos de la petición se rige por sus propias condiciones y la configuración de tu organización.

Puedes ver el prompt completo en [Clasificación con IA](ia.md#qué-se-envía-exactamente).

**Cómo mantenerlo bajo control**

- **Modo manual**: ves antes la lista exacta de lo que se enviará.
- **Dominios que nunca se proponen**: añade ahí lo que no quieras que salga, por ejemplo tu correo o herramientas internas.
- **Lo aprendido**: ves y borras los ejemplos que se envían, o desactivas su uso.
- **Desactivar la IA** en cualquier momento.

## Permisos

El navegador te los muestra al instalar la extensión. Para qué sirve cada uno:

| Permiso | Para qué se usa |
|---|---|
| `tabs` | Leer el título, la URL y el estado de tus pestañas, para listarlas y decidir qué proponer. El navegador lo describe como "leer tu historial de navegación", porque da acceso a las URL de las pestañas abiertas. La extensión **no** lee el contenido de las páginas y no usa tu historial: solo las pestañas abiertas. |
| `storage` y `unlimitedStorage` | Guardar tu lista, tus ajustes y lo aprendido. Sin límite de tamaño, para que una lista larga no falle. |
| `sidePanel` | Mostrar la extensión como panel lateral. |
| `bookmarks` | La carpeta de marcadores de la [sincronización](sincronizacion.md). |
| `favicon` | Mostrar el icono de cada web en *Guardadas*, también de los enlaces que llegan de otro equipo. |
| Acceso a `api.openai.com` | Hablar con la API de OpenAI. Solo se usa si activas la IA y pones una clave. |

La extensión **no inyecta código en las páginas** y no tiene permiso para hacerlo.

### Sobre el acceso a `api.openai.com`

Es un permiso normal de la extensión, no uno que se pida en el momento. Se probó como permiso opcional, pero la petición en tiempo de ejecución queda pendiente hasta que el usuario responde a un aviso del navegador, y si ese aviso no se ve o se cierra la extensión antes, el ajuste no se guardaba. Si prefieres restringirlo, en los detalles de la extensión puedes limitar el acceso al sitio: la IA dejará de funcionar y lo dirá con un mensaje claro.

# Sincronización

La lista de guardadas viaja entre tus dispositivos usando algo que tu navegador ya sincroniza: los **marcadores**. La extensión mantiene una carpeta llamada **Leer luego**, dentro de *Otros marcadores*, como espejo de la lista.

```
Otros marcadores
└── Leer luego
    ├── https://…           ← enlaces sueltos (aún sin categoría)
    ├── ✍️ Blog y opinión
    ├── 📰 Noticias
    └── 🧭 Tutoriales y guías
```

Como son marcadores normales, también los ves y los abres desde el navegador del móvil, sin necesidad de la extensión.

## Qué necesitas

1. **Sync del navegador activo con *Marcadores***, en los dos (o más) dispositivos y con la misma cadena de sincronización. En Brave: `brave://settings/braveSync`.
2. **La extensión instalada en cada ordenador** donde quieras gestionar la lista. Sin ella, los enlaces aparecen como marcadores, pero nadie los mantiene.
3. El ajuste *Sincronizar guardadas con la carpeta de marcadores* activado (lo está por defecto).

La sincronización del navegador no es instantánea: puede tardar un poco en propagar los cambios.

## Qué se sincroniza y cómo

La sincronización es **bidireccional**:

| Si… | Entonces… |
|---|---|
| Guardas pestañas en este equipo | Aparecen como marcadores en la carpeta "Leer luego" y llegan a tus otros equipos. |
| Llega un marcador nuevo a la carpeta (de otro equipo, o puesto por ti a mano) | Aparece en *Guardadas*. |
| Quitas un enlace de *Guardadas* (lo abres o pulsas ✕) | Su marcador se borra, y desaparece en los demás equipos. |
| Borras un marcador de la carpeta | Desaparece de *Guardadas*. |
| El mismo enlace llega por dos caminos | Se conserva uno solo. |

Para distinguir "enlace nuevo aquí" de "enlace borrado en otro sitio", la extensión recuerda qué enlaces estaban ya en los dos lados en la última pasada. Si uno estaba en los dos y ahora falta en uno, es que se borró en ese lado.

### Casos delicados

- **Si borras la carpeta "Leer luego" entera**, la extensión la recrea y vuelve a subir lo que tenga en local. No borra tu lista, porque no puede saber si fue intencionado.
- **Si hay dos carpetas "Leer luego"** (por ejemplo, un equipo la creó antes de que llegara la del otro), se unen en la más antigua sin perder ningún enlace. Lo mismo ocurre con subcarpetas de categoría duplicadas.
- **La carpeta no se crea hasta que hay algo que subir**, justo para evitar esas duplicadas al arrancar en un equipo nuevo.
- **Desactivar la sincronización** simplemente deja de espejar. No borra ni la lista ni los marcadores.

## Organizar por tipo de contenido

Es un ajuste aparte, **desactivado por defecto**, porque reorganiza tus marcadores. Al activarlo, los enlaces clasificados se mueven a una subcarpeta con el nombre de su categoría y su emoji (`📰 Noticias`, `🧭 Tutoriales y guías`…).

### Reglas

- **Manda tu carpeta, no la IA.** Un enlace que ya está en una subcarpeta de categoría no se mueve nunca. Esa subcarpeta pasa a ser su categoría. Solo se mueven los enlaces sueltos en la raíz de "Leer luego" cuya categoría ya se conoce.
- **Mover un marcador a mano cuenta como una corrección tuya**: la extensión lo anota para [aprender](aprendizaje-y-categorias.md).
- **Las categorías viajan por Sync**: como la categoría es el nombre de la carpeta, otro equipo la lee de ahí y no tiene que volver a clasificar el enlace (ni pagarlo).
- **Las subcarpetas con otro nombre son tuyas**. Sus enlaces cuentan como guardadas, pero no se tocan. Si tienen varios enlaces, la extensión te propone [convertirlas en categoría](aprendizaje-y-categorias.md#convertir-una-subcarpeta-tuya-en-categoría).
- **Reconoce una carpeta por su nombre** aunque le hayas quitado o cambiado el emoji (`Noticias` y `🗞️ Noticias` valen igual que `📰 Noticias`).
- **Las subcarpetas vacías no se borran**, porque otro dispositivo podría estar moviendo algo dentro en ese mismo momento.
- **Desactivar el ajuste no deshace lo ya organizado**: las subcarpetas se quedan como estén.

### Cómo se mueve un enlace

1. Guardas una pestaña: el marcador entra suelto en "Leer luego" (o directamente en su subcarpeta, si ya se conoce su categoría).
2. La [IA](ia.md) la clasifica (o llega ya clasificada desde otro equipo).
3. Con el ajuste activo, el marcador pasa a la subcarpeta de su categoría.
4. Si tú lo mueves a otra subcarpeta, esa pasa a ser su categoría y no vuelve atrás.

## Limitaciones

- Las **categorías propias** y los **ajustes** son locales de cada equipo (ver [Categorías propias](aprendizaje-y-categorias.md)). La subcarpeta sí viaja, y en otro equipo aparece como carpeta tuya que puedes convertir en categoría.
- Los **ejemplos aprendidos** no se sincronizan. Solo viaja lo que ya está en las carpetas.
- Si mueves un marcador en un equipo que **no lo había visto colocado**, se adopta su carpeta como categoría pero no se anota como corrección: la extensión no puede saber si lo colocaste tú o la IA de otro equipo, y no quiere aprender de sus propios errores.

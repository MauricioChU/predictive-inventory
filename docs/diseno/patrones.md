# Patrones de diseño

Cómo se arman las pantallas de PAPITO para que todas se sientan de la misma familia. Antes de inventar un estilo para una vista nueva, buscar aquí el patrón que ya lo resuelve. Reglas de fondo: [06-experiencia-de-uso](../specs/fase-1/06-experiencia-de-uso.md) (RN-UX-01 a RN-UX-16).

## Bases

| Qué | Dónde | Regla |
|---|---|---|
| Letra | `tokens.css` (`html[data-letra]`) | Todo en `rem`: escala con Normal (18 px), Grande (20 px) y Muy grande (24 px). Ningún texto por debajo de `1rem` salvo marcas secundarias muy cortas. |
| Toques | `--alto-toque` (48 px), `--alto-boton-principal` (56 px), `--separacion-toque` | Nada tocable mide menos. Si se ve chico (un enlace, la asa), la zona de toque se agranda con relleno o márgenes negativos. |
| Espacios | `--espacio-1` … `--espacio-6` | Sin huecos en blanco: el contenido va seguido; lo fijo (pie, total) va pegado abajo. |
| Colores | `tokens.css` | Texto 7:1; el color nunca es la única señal (va con texto o ícono). |
| Cifras | `pegarCifras()` (`shared/ui/texto-sin-cortes.ts`) | "S/ 3.50" y "2 unid." nunca se parten entre renglones. |
| Íconos | `lucide-vue-next` | Siempre con texto (RN-UX-04). Excepciones con nombre accesible: tuerca de Ajustes, flecha ⌄ de las hojas. |

## Movimiento

Una sola familia de animaciones, lentas para que se vea de dónde sale y adónde vuelve cada cosa. Con "reducir movimiento" del sistema todo pasa al instante (`base.css`).

| Token / clase | Uso |
|---|---|
| `--duracion-hoja` (420 ms), `--curva-hoja-entrar`, `--curva-hoja-salir` | Duración y curvas de todo lo que entra y sale. |
| `.hoja-entra` / `.hoja-sale` + `--hoja-cerrada-arriba` | La hoja crece desde su forma cerrada (el bloque de abajo) y vuelve ahí. Sin la variable, sale y vuelve desde el borde de la pantalla. |
| `.velo-entra` / `.velo-sale` | El fondo oscuro de una hoja abierta. |
| `.aparece` | Contenido que llega (pantalla de éxito): sube suave y se aclara. |
| `al-terminar-animacion.ts` | Para cerrar: el componente pone `hoja-sale` con su `:class` (nunca a mano: Vue la borra) y quita la hoja cuando la animación termina. |
| `TransitionGroup` de líneas | Quitar una línea la desvanece y las de abajo suben; agregar la hace aparecer. |

## Hoja inferior — `HojaInferior.vue`

Para todo lo que se consulta sin salir de la pantalla (Movimientos y lo que venga).

- A toda la pantalla sobre la navegación; arriba la asa gris (tocable) y el título con la flecha ⌄ (nombre accesible "Cerrar").
- Abre con `hoja-entra`, cierra con `hoja-sale`; el velo y la asa también la cierran; Escape también.
- Lo de atrás queda `inert`; al abrir, el foco va al título; al cerrar, vuelve al botón que la abrió (`volverA`).
- Sin "Volver": la hoja se cierra, no se navega.

## Panel de carrito — `PanelDeCarrito.vue`

Para registrar algo con varias líneas (Vender, Llegó mercadería).

- Siempre abajo, desde el inicio, como un bloque cerrado en cero: título, "Total · N productos" y el botón de confirmar (desactivado sin productos).
- Al agregar el primer producto **crece** desde ese bloque hasta toda la pantalla; la flecha ⌄, la asa o el título lo ocultan y vuelve a ser el bloque. Si se quita todo, baja solo.
- Abierto: líneas y fecha seguidas; el total y confirmar quedan pegados abajo, sin raya encima.
- Nada se confirma con un formulario de precio o costo a medio escribir.
- En PC (≥ 1024 px) no hay panel: el carrito va a la derecha con el mismo contenido.

## Línea de carrito — `FilaDeCarrito.vue` (compacta)

- Foto, nombre e importe en la primera fila; debajo, cuánto queda y el precio por unidad, que es el botón para cambiarlo (subrayado, con lápiz).
- − / + con *Quitar* al lado. En Vender el + se detiene en el stock.
- Formularios en línea (cambiar precio, otro precio) con *Guardar* y *Cancelar*; mientras están abiertos, *Quitar* se oculta.

## Fila de aviso — `FilaDeAviso.vue`

Para avisos que no deben alargar la pantalla (Inicio).

- Una fila: ícono + texto corto + flecha (botón con nombre accesible, p. ej. "Ver productos").
- Varias se apilan una bajo otra; el detalle va en la pantalla a la que lleva la flecha, no en la fila.
- Tonos: `atencion`, `info`, `exito` (color + ícono, nunca solo color).

## Confirmación — `PantallaExito.vue`

- ✓ que crece, título, resumen; con `alCentro`, al centro del alto libre. Vender y Recibir muestran además lo registrado con `ResumenDeLineas.vue` (nombre, importe, "2 unid. × S/ 3.50", marca "Precio especial" / "Costo nuevo"), igual en las dos.
- Deshacer (10 s) como botón **dentro** de la pantalla, arriba a la derecha (`segundosParaDeshacer` + evento `deshacer`; se ve "Deshacer (9)" y desaparece al vencer). No persiste: si la persona se va, la oferta se cancela. Solo Vender y Recibir; las demás pantallas usan el aviso negro de abajo (`usarDeshacer().ofrecer(oferta, { enPantalla: true })`).
- Al abrirse, la página vuelve arriba para que ✓ y Deshacer se vean.

## Verificar

Todo cambio visual se mira antes de entregarlo con capturas de Playwright (spec temporal `e2e/zz-*.spec.ts`, que no se sube): celular 360×740 con letra Grande y 320 px con Muy grande. Se busca: sin huecos, sin palabras ni montos partidos, sin desplazamiento a los lados, animaciones que se ven.

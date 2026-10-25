# Patrones de diseño

Cómo se arman las pantallas de PAPITO para que todas se sientan de la misma familia. Antes de inventar un estilo para una vista nueva, buscar aquí el patrón que ya lo resuelve. Reglas de fondo: [06-experiencia-de-uso](../specs/fase-1/06-experiencia-de-uso.md) (RN-UX-01 a RN-UX-16).

## Bases

| Qué | Dónde | Regla |
|---|---|---|
| Letra | `tokens.css` (`html[data-letra]`) | Todo en `rem`: escala con Normal (18 px), Grande (20 px) y Muy grande (24 px). Ningún texto por debajo de `1rem` salvo marcas secundarias muy cortas. |
| Toques | `--alto-toque` (48 px), `--alto-boton-principal` (56 px), `--separacion-toque` | Nada tocable mide menos. Si se ve chico (un enlace, la asa), la zona de toque se agranda con relleno o márgenes negativos. |
| Espacios | `--espacio-1` … `--espacio-6` | Sin huecos en blanco: el contenido va seguido; lo fijo (pie, total) va pegado abajo. |
| Pantalla que llena el alto | `--relleno-bloque` (`LayoutApp.vue`) | Una pantalla que ocupa todo el alto libre usa `calc(100dvh - var(--alto-pie, 0px) - 2 * var(--relleno-bloque, var(--espacio-4)))`: la variable vale lo que el relleno de arriba y de abajo de `<main>` (más en PC). Con `2 * var(--espacio-4)` fijo, en PC sobraban 40 px y aparecía la barra de la página. Si todo entra, la página no se desplaza (`scrollHeight == innerHeight`); nunca se arregla con `overflow: hidden` en el body. |
| Colores | `tokens.css` | Texto 7:1; el color nunca es la única señal (va con texto o ícono). |
| Cifras | `pegarCifras()` (`shared/ui/texto-sin-cortes.ts`) | "S/ 3.50" y "2 unid." nunca se parten entre renglones. |
| Encabezado de página | `EncabezadoPagina.vue` | Siempre el mismo: título `h1` con la misma altura en todas las vistas. Una acción al lado del título (p. ej. «Categorías») va en el slot `accion`: su caja no suma alto, el título no se mueve. |
| Título de sección | clase `.titulo-de-seccion` (`base.css`) | Un solo estilo (1.125 rem, negrita, color de texto) para «Más vendidos», «N productos», Datos, Precios, secciones de Ajustes y Control. No inventar otro tamaño. |
| Tarjeta de producto | `TarjetaDeProducto.vue`, `AccesosRapidos.vue` | Fondo claro (`--color-fondo`), borde de 2 px (`--color-borde`) y `--radio`; al tocar, fondo suave y borde primario. Lista y grilla se ven igual. |
| Íconos | `lucide-vue-next` | Siempre con texto (RN-UX-04). Excepciones con nombre accesible: tuerca de Ajustes, flecha ⌄ de las hojas, «Filtros» (siempre) y «Categorías» (cuando no cabe junto al título) en Productos. |

## Movimiento

Una sola familia de animaciones, lentas para que se vea de dónde sale y adónde vuelve cada cosa. Con "reducir movimiento" del sistema todo pasa al instante (`base.css`).

| Token / clase | Uso |
|---|---|
| `--duracion-hoja` (420 ms), `--curva-hoja-entrar`, `--curva-hoja-salir` | Duración y curvas de todo lo que entra y sale. |
| `.hoja-entra` / `.hoja-sale` + `--hoja-cerrada-arriba` | La hoja crece desde su forma cerrada (el bloque de abajo) y vuelve ahí. Sin la variable, sale y vuelve desde el borde de la pantalla. |
| `.velo-entra` / `.velo-sale` | El fondo oscuro de una hoja abierta. |
| `.aparece` | Contenido que llega (pantalla de éxito): sube suave y se aclara. |
| `al-terminar-animacion.ts` | Para cerrar: el componente pone `hoja-sale` con su `:class` (nunca a mano: Vue la borra) y quita la hoja cuando la animación termina. |
| `--duracion-vista-sale` (120 ms) + `--duracion-vista` (220 ms) + `--distancia-vista` (28 px) + `.cambio-de-vista-*` (en `LayoutApp.vue`) | Cambio de pantalla en la navegación, en modo `out-in` (nunca hay dos a la vez): la vieja se desvanece rápido en su sitio y la nueva entra con un deslizamiento corto desde el lado hacia el que se va, con fundido. Dirección en `router/direccion-de-vista.ts` (pestañas por orden; hacia adentro = derecha, volver = izquierda; hermanas de igual profundidad = solo fundido), fijada en `<html data-vista-direccion>`. Anima `left` (no `transform`) para que `PanelDeCarrito`/`HojaInferior` (`position: fixed`) no se rompan; `overflow-x: clip` solo mientras dura. El router espera a que la vieja se vaya para llevar la página arriba (`router/salida-de-vista.ts`); el foco va al `h1` de la que entra (`router/foco-de-titulo.ts`). La primera carga no se anima. |
| `--duracion-dialogo` (220 ms) + `.dialogo-animado` | Diálogos `<dialog>` (`DialogoConfirmacion`): el fondo se oscurece (`::backdrop`) y la caja crece un poco desde abajo; al cerrar, al revés. Con transiciones CSS (`@starting-style`, `overlay`/`display` discretos), no `@keyframes`: el `<dialog>` se cierra en el acto —el foco vuelve enseguida— y el navegador lo mantiene visible mientras se va. Basta ponerle la clase. |
| `DespliegueAnimado.vue` + `--duracion-despliegue` (320 ms abrir) + `--duracion-despliegue-sale` (220 ms cerrar) + `--curva-despliegue` | Despliegue: un formulario en línea (cambiar precio, «¿Vendiste alguno a otro precio?») abre en alto con curva que se frena al final; el contenido se aclara y baja 0.5 rem y arranca a ~25 % del tiempo (cuando la caja ya tiene lugar). Cerrar es al revés y más rápido: el contenido se va en el primer ~55 % y la caja se recoge. Lo de abajo se desliza con la caja, sin saltos. Con `v-if` interno (cerrado no existe en el DOM), alto medido en el momento (Web Animations) y soltado al terminar de abrir (la caja sigue al contenido si cambia); sin Web Animations o con «reducir movimiento», al instante. Meter el formulario en el slot, sin relleno en la caja de afuera. |
| `TransitionGroup` de líneas | Quitar una línea la desvanece y las de abajo suben; agregar la hace aparecer. |

## Hoja inferior — `HojaInferior.vue`

Para todo lo que se consulta sin salir de la pantalla (Movimientos y lo que venga).

- A toda la pantalla sobre la navegación; arriba la asa gris (tocable) y el título con la flecha ⌄ (nombre accesible "Cerrar").
- Abre con `hoja-entra`, cierra con `hoja-sale`; el velo y la asa también la cierran; Escape también.
- Lo de atrás queda `inert`; al abrir, el foco va al título; al cerrar, vuelve al botón que la abrió (`volverA`).
- Sin "Volver": la hoja se cierra, no se navega.
- Pie opcional (`#pie`, recibe `cerrar`): un botón principal fijo abajo, fuera de lo que se desplaza.

### Filtros en hoja + chips (Productos)

- Arriba, siempre en una fila: el buscador (igual que el de Vender: etiqueta «Buscar producto» visible arriba, marcador «Por ejemplo: lejía»; el botón va alineado con el campo) y el botón «Filtros», solo ícono de 56 px con el número de filtros puestos (nombre accesible «Filtros · N activos»). «Categorías» queda junto al título; si no cabe con su texto, solo ícono.
- El botón abre `HojaDeFiltros.vue`: «Mostrar» (opciones en cuadros que se envuelven) y «Categoría» (una opción por fila, la elegida marcada); se aplican al tocar y el pie «Ver N productos» solo cierra.
- Lo activo va debajo del buscador en UNA línea de chips quitables (pastilla pequeña, zona de toque de 48 px, nombre accesible «Quitar filtro X»); si no caben se desplazan de lado dentro de su fila, sin barra, y el texto largo lleva elipsis; sin filtros no hay línea.

### Formulario dentro de una hoja

- Un formulario de página se mete en la hoja con una propiedad `en-hoja`: sin su encabezado ni «Volver», con el botón de guardar pegado al fondo de la hoja (`position: sticky` con el relleno del cuerpo cancelado) y la confirmación dentro de la hoja. Un solo título: el de la hoja cambia («Producto guardado») y el de la confirmación queda solo para el lector (`tituloOculto`). Tocar en la navegación la pantalla donde está la hoja la cierra. Ejemplo: `FormularioDeProducto.vue` desde Productos.

## Panel de carrito — `PanelDeCarrito.vue`

Para registrar algo con varias líneas (Vender, Llegó mercadería).

- Siempre abajo, desde el inicio, como un bloque cerrado en cero: título, "Total · N productos" y el botón de confirmar (desactivado sin productos).
- Al agregar el primer producto **crece** desde ese bloque hasta toda la pantalla; la flecha ⌄, la asa o el título lo ocultan y vuelve a ser el bloque. Si se quita todo, baja solo.
- Abierto: líneas y fecha seguidas; el total y confirmar quedan pegados abajo, sin raya encima.
- Nada se confirma con un formulario de precio o costo a medio escribir.
- En PC (≥ 1024 px) no hay panel: el carrito va a la derecha con el mismo contenido.

## Línea de carrito — `FilaDeCarrito.vue` (compacta)

- Foto, nombre e importe en la primera fila; debajo, cuánto queda y el precio por unidad, que es el botón para cambiarlo (subrayado, con lápiz). En Vender, ese lápiz cambia el **precio del producto para siempre** y antes de guardar pregunta con un diálogo («¿Cambiar el precio de Lejía 1 L? Desde ahora se venderá a S/ 4.00 (antes S/ 3.50).» · «Cambiar precio» / «Cancelar»); si deja pérdida, el catálogo pide otra confirmación. «¿Vendiste alguno a otro precio?» es lo que vale solo para esta venta. En Recibir el lápiz de costo no cambia.
- − / + con *Quitar* al lado. En Vender el + se detiene en el stock.
- Formularios en línea (cambiar precio, otro precio) con *Guardar* y *Cancelar*; mientras están abiertos, *Quitar* se oculta.
- «¿Vendiste alguno a otro precio?» también con 1 unidad: sin «¿Cuántos?», solo «¿A cuánto lo vendiste?»; al guardar, cambia el precio de esa línea.

## Diálogo con lista — `DialogoConfirmacion.vue` con slot

Cuando hay varios productos que revisar (aviso de sobrecompra en Llegó mercadería), el diálogo no junta todo en un párrafo: sin `mensaje`, el slot lleva una lista, **una fila por producto** (nombre en negrita y debajo, en color suave, una o dos frases cortas con `pegarCifras`), separadas por una raya fina. El título dice el hecho en tono amable y los dos botones (cancelar y confirmar) quedan iguales, apilados.

## Carrusel de avisos — `CarruselDeAvisos.vue`

Cuando puede haber varios avisos y no deben alargar la pantalla (Inicio).

- En Inicio va **justo encima de los botones de acción** (parte de la zona de abajo); lo de arriba (cifras) crece para llenar el alto libre.
- Un aviso a la vez en una región con nombre («Avisos», `aria-roledescription` «carrusel»).
- Un solo bloque (marco, borde grueso a la izquierda y fondo del tono del aviso, que cambia con él). Con acción, **todo el bloque es un botón** (nombre accesible = frase completa) que lleva a su pantalla. Con 2 o más: a la derecha un «1/3» pequeño y, aparte (hermano del bloque, nunca anidado), el botón › de 48 × 48 px reales («Siguiente aviso, 2 de 3») que pasa al siguiente y da la vuelta; **sin tira de puntos**. Deslizar de lado también cambia (extra, nunca lo único: RN-UX-05); tras deslizar no se abre el aviso. El cambio es un fundido corto y el aviso nuevo se anuncia (`aria-live`).
- Los textos de cada aviso son cortos y entran en un renglón a 360 px con letra Grande («3 agotados», «Queda poco: 3»); el nombre accesible del bloque es la frase completa («3 productos agotados. Ver productos»).
- Con un solo aviso: solo el bloque tocable (con una flecha decorativa), sin flecha de siguiente ni contador.
- Tonos: `atencion`, `info`, `exito` (color + ícono, nunca solo color).
- Cada aviso lleva `id`; la acción emite ese `id`.

## Cifra principal — `TarjetaDeCifra principal`

La cifra que una pantalla quiere que se lea primero (Inicio: «Total vendido»).

- Título arriba y la cifra debajo, hasta 2.5 rem (sin partir el monto); la secundaria («Ganancia real») va debajo, compacta y en una línea (`compacta en-linea`, cifra de 1.4 rem). La principal es claramente más grande (≥ 1.6 ×).
- Sin ventas, «Ganancia real» se ve igual (S/ 0.00) y «Todavía no hay ventas hoy» va en el total. Las dos tarjetas crecen para llenar el alto libre (la principal el doble) con el contenido **arriba**: centrado en una caja alta se veía flotando.

## Subvista de ayudas, selector de top y gráfico comparativo — Control

- **Control mide, las ayudas van aparte**: lo que el sistema avisa o sugiere (Atención, Para comprar, Productos parados) vive en `/control/ayuda` (`VistaAyudaInteligente.vue`, con `EncabezadoPagina volver`). Se abre desde un botón al final de Control (ícono, «Ayuda inteligente» y debajo «N cosas para mirar»; en pantallas angostas sin flecha, para que el nombre quepa entero con letra Muy grande).
- **Dos listas, un bloque**: dos top 5 se alternan con un `SelectorSegmentado` («Más vendidos» / «Más ganancia») en la misma tarjeta; solo se ve una lista a la vez.
- **Comparar dos períodos**: un `GraficoBarras` por métrica con dos barras (la actual destacada, la anterior), el cambio dicho con palabras encima y el valor escrito en cada barra; el lector de pantalla recibe la tabla. Las dos métricas se alternan con un `SelectorSegmentado` («Ventas» / «Ganancia») en el mismo bloque: se ve un gráfico a la vez.
- **Barras verticales** (`GraficoColumnas.vue`, «Mejor día de la semana»): una columna por día, todas visibles; si no entran, el gráfico se desplaza de lado **por dentro** del bloque (región con nombre que el teclado alcanza; la página no se mueve, RN-UX-09), con la destacada centrada al abrir; valor encima, etiqueta legible debajo (rem), tabla solo-lector.

## Resumen de lo registrado — `ResumenDeLineas.vue`

- A la vista, como mucho 4 líneas (alto medido, aunque un nombre ocupe dos renglones). En una pantalla corta, donde ni 4 caben (`PantallaExito` tiene alto fijo), la tarjeta se achica (piso ~7 rem) y se desplaza igual, con «y N más» medido. Con más de 4, la tarjeta se desplaza **por dentro** (`overscroll-behavior: contain`: la página no se mueve), es una región con nombre («Lo que vendiste: 7 productos») que el teclado alcanza (Tab, flechas) y abajo hay una pista: degradado y «y N más ⌄» que pasa a «Ya viste todo» al llegar al final.

## Confirmación — `PantallaExito.vue`

- ✓ que crece, título, resumen; con `alCentro`, al centro del alto libre. Vender y Recibir muestran además lo registrado con `ResumenDeLineas.vue` (nombre, importe, "2 unid. × S/ 3.50", marca "Precio especial" / "Costo nuevo"), igual en las dos.
- Deshacer (10 s) como botón **dentro** de la pantalla, arriba a la derecha (`segundosParaDeshacer` + evento `deshacer`; se ve "Deshacer (9)" y desaparece al vencer). No persiste: si la persona se va, la oferta se cancela. Solo Vender y Recibir; las demás pantallas usan el aviso negro de abajo (`usarDeshacer().ofrecer(oferta, { enPantalla: true })`).
- Al abrirse, la página vuelve arriba para que ✓ y Deshacer se vean.

## Detalle de producto — `VistaDetalleProducto.vue`

- «Volver» en su propia fila y el nombre debajo como título (`EncabezadoPagina` con `volver`).
- Foto a la izquierda (30 %, tope 7 rem) y «Tienes» con el estado a su derecha; «Se acaba en…» y «Vendes…» debajo, compactos; «Contar stock» y «Registrar pérdida» lado a lado si caben, si no uno bajo otro.

## Verificar

Todo cambio visual se mira antes de entregarlo con capturas de Playwright (spec temporal `e2e/zz-*.spec.ts`, que no se sube): celular 360×740 con letra Grande y 320 px con Muy grande. Se busca: sin huecos, sin palabras ni montos partidos, sin desplazamiento a los lados, animaciones que se ven.

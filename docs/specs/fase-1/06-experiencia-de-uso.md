# 06 · Experiencia de uso

La app la usa principalmente una **persona mayor en un celular Android**. Cada decisión de diseño se mide contra esa persona: vista cansada, dedos menos precisos, poca paciencia con lo técnico y miedo a "malograr algo".

Criterios ejecutables: pruebas E2E y de accesibilidad descritas en [07-calidad.md](07-calidad.md).

Patrones de diseño reutilizables (hoja inferior, panel de carrito, fila de aviso, animaciones): [docs/diseno/patrones.md](../../diseno/patrones.md).

## Principios

1. **Una acción principal por pantalla**, grande y abajo, al alcance del pulgar.
2. **Nada se pierde por un toque equivocado**: todo se puede deshacer o se confirma con un resumen claro.
3. **Se lee sin lentes**: letra grande por defecto y alto contraste.
4. **Se entiende sin explicaciones**: íconos siempre con texto y palabras de la tienda.
5. **Nunca un callejón sin salida**: siempre hay un botón "Volver" visible y un mensaje que dice qué hacer.

## Reglas de experiencia

| Id | Regla |
|---|---|
| **RN-UX-01** | **Tamaño de letra** configurable: Normal (18 px), **Grande (20 px, por defecto)** y Muy grande (24 px). Todo el diseño escala con esa base. |
| **RN-UX-02** | **Zonas táctiles** de al menos **48 × 48 px**; los botones de acción principal miden al menos **56 px** de alto y ocupan todo el ancho en celular. Separación mínima de 8 px entre elementos tocables.<br>*Excepción deliberada:* con letra *Muy grande* en 320–360 px, la barra del total pone el total y su botón en una sola fila (el botón no ocupa todo el ancho) para no tapar media pantalla; si el texto no entra, el botón baja a su fila a todo el ancho. |
| **RN-UX-03** | **Contraste** mínimo 7:1 para texto normal y 4.5:1 para texto grande e íconos (WCAG AAA para texto). |
| **RN-UX-04** | **Íconos siempre acompañados de texto.** El color nunca es la única señal (RN-AL-05).<br>*Excepción deliberada:* el botón **Ajustes** de Inicio es solo la tuerca, con el nombre accesible "Ajustes" (`aria-label`) y una zona táctil de al menos 48 × 48 px. Lo mismo el botón para ocultar el panel de venta abierto: solo la flecha ⌄, con el nombre accesible "Ocultar" (cerrado dice *Ver detalle*); la flecha ⌄ de toda **hoja inferior** ("Cerrar", p. ej. *Movimientos*) y la flecha › de la fila de aviso de Inicio ("Ver productos"), ambas con zona táctil de 48 × 48 px. |
| **RN-UX-05** | **Sin gestos ocultos**: nada depende de deslizar, mantener presionado ni doble toque. Todo tiene un botón visible. |
| **RN-UX-06** | **Números fáciles**: los campos de cantidad y precio abren el teclado numérico y tienen botones **− / +** grandes. Se aceptan coma o punto como separador decimal. |
| **RN-UX-07** | **Mensajes en lenguaje simple**, en tono amable y de "tú". Los errores dicen **qué pasó y qué hacer**, nunca un código técnico: "Solo quedan 2 unid. de Lejía 1 L. Cambia la cantidad o registra la llegada de mercadería." |
| **RN-UX-08** | **Confirmaciones solo donde hay riesgo** (restaurar respaldo, archivar con stock, precio con pérdida). Lo demás se registra directo y ofrece **Deshacer** (RN-OP-18). |
| **RN-UX-09** | **Responsive real**: ninguna pantalla tiene desplazamiento horizontal entre **320 px y 1920 px** de ancho, en vertical y horizontal, y con la letra en *Muy grande*. |
| **RN-UX-10** | **Estados vacíos útiles**: cada lista vacía explica por qué y ofrece la acción siguiente ("Aún no tienes productos. **Agregar el primero**"). |
| **RN-UX-11** | **Retroalimentación inmediata**: cada operación muestra una confirmación visible (pantalla verde con ✓ y el resumen) y una vibración corta si el celular la permite. |
| **RN-UX-12** | **Navegación fija** con 5 destinos, ícono y texto: **Inicio · Vender · Recibir · Productos · Control**. En celular va abajo; desde 1024 px, a la izquierda. Al cambiar de destino la pantalla vieja se desvanece (≈ 0,12 s) y la nueva entra con un deslizamiento corto y fundido desde el lado de la pestaña tocada (≈ 0,22 s; hacia adentro desde la derecha, al volver desde la izquierda; hermanas, solo fundido; sin movimiento si el sistema pide reducirlo). Los diálogos de confirmación aparecen y se van con una animación corta (fondo que se oscurece y caja que crece un poco; ≈ 0,22 s), también sin movimiento si el sistema pide reducirlo. *Ajustes* se abre desde Inicio; *Movimientos* (el historial de días) se abre en una hoja desde Inicio. |
| ~~RN-UX-13~~ | **Retirada** (2026-10-19): el dueño no quiere la tarjeta "Instala la app" en Inicio; instalar sigue posible desde el menú del navegador. |
| **RN-UX-14** | **Sin internet no hay diferencia**: ninguna pantalla muestra errores de conexión en la Fase 1, y la app abre y funciona completa en modo avión. |
| **RN-UX-15** | **Accesible**: navegable con lector de pantalla (TalkBack): cada control tiene nombre, los avisos importantes se anuncian (`aria-live`), el orden de foco es lógico y se respeta "reducir movimiento" del sistema. |
| **RN-UX-16** | **Primera vez obligatoria**: mientras no esté completada, la app **no deja navegar**. Cualquier dirección lleva a la bienvenida y la navegación fija (RN-UX-12) no se muestra. Las únicas pantallas que se abren desde ella, sin navegación fija, son las que ofrecen sus pasos: *Restaurar copia* (RN-RE-10), *Producto nuevo* e *Importar productos* (paso 4, al terminar vuelven al paso 5) y *Contar todo* (paso 5). La primera vez queda **completada al responder el paso 5**, con *Contar ahora* o *Terminar*. Los pasos 4 y 5 aceptan *Más tarde* como respuesta válida. Si la app se cierra a mitad, vuelve a empezar en la bienvenida con lo ya respondido (nombre y letra) prellenado. |

## Pantallas

### Inicio
```
┌──────────────────────────────┐
│ BODEGA ROSITA            ⚙  │
│ LUNES 19 DE OCTUBRE          │
│ ┌──────────────────────────┐ │
│ │ Hoy ganaste  S/ 48.20    │ │
│ │ Vendiste     S/ 162.50   │ │
│ └──────────────────────────┘ │
│ ┌ 🟠 4 productos se acaban  ›┐ │
│                              │
│   (espacio libre)            │
│ [ 🛒  VENDER               ] │
│ [ 📦  LLEGÓ MERCADERÍA     ] │
│ [ 🤔  ¿NECESITO COMPRAR?   ] │
│  Movimientos ⌃               │
├──────────────────────────────┤
│ Inicio Vender Recibir Prod. Control │
└──────────────────────────────┘
```
El encabezado es el **nombre de la tienda en mayúsculas**, sin saludo ni emoji (si no hay nombre, el encabezado dice *Inicio*), y a la derecha la tuerca de *Ajustes*. Debajo va la **fecha en mayúsculas**, sin hora (el celular ya la muestra); es la fecha de la tienda (Lima) y, si la medianoche pasa con la app abierta, se pone al día al volver a la app. Las acciones quedan **abajo, sobre la navegación**, al alcance del pulgar; **Inicio entra en una sola pantalla** (360 × 740 con letra Grande, sin desplazar): el aviso es una fila compacta y los avisos que vengan se apilan igual, una bajo otra. Si el contenido es más alto que la pantalla (letra Muy grande, 320 px), todo fluye hacia abajo sin taparse.

### Vender
```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│╭────────────────────────────╮│        │ Vender                       │
││ ▬ En esta venta         ⌄  ││        │ [ Buscar producto          ] │
││ [▢] Lejía 1 L     S/ 10.50 ││        │ Más vendidos  [Lejía][Carbón]│
││     Quedan 7     ✎ S/ 3.50 ││        │  (grilla, sigue a la vista)  │
││ [−] 3 [+]        🗑 Quitar ││        │ ╭──────────────────────────╮ │
││ 🏷 ¿Vendiste alguno a otro ││        │ │ ▬ En esta venta Ver det.▴│ │
││    precio?                 ││        │ │ Total · 2 prod. S/ 11.00 │ │
││ ¿Cuándo fue la venta?      ││        │ │ [   Confirmar venta     ]│ │
││ ( Ahora )  ( Otro día )    ││        │ ╰──────────────────────────╯ │
││ Total · 1 prod.  S/ 10.50  ││        │ Inicio Vender Recibir ...    │
││ [    Confirmar venta     ] ││        └──────────────────────────────┘
│╰────────────────────────────╯│
│ Inicio Vender Recibir ...    │
└──────────────────────────────┘
 panel abierto (toda la pantalla)               panel oculto
```
1. Buscar (campo grande arriba) → resultados con **foto grande**, nombre, precio y stock; los más vendidos primero. Debajo del buscador, accesos rápidos a los 8 productos más vendidos. No hay sección "En esta venta" mientras no se haya elegido nada.
2. Desde el inicio, abajo, está el bloque **En esta venta** cerrado y en cero (Total · 0 productos, S/ 0.00, *Confirmar venta* desactivado). Tocar un producto lo agrega con cantidad 1 y **ese bloque crece hasta ocupar toda la pantalla** (RN-OP-22); al ocultarlo vuelve a meterse abajo y queda el bloque, con el foco en su título; lo de atrás no se alcanza mientras está abierto. Para agregar otro producto se toca *Ocultar* (o fuera de la hoja). La hoja crece y vuelve despacio (≈ 0,4 s; su borde de arriba va desde el bloque cerrado hasta arriba y de vuelta, mientras el total y *Confirmar venta* quedan abajo) con la animación compartida de hojas (`--duracion-hoja` en tokens.css, `hoja-entra` / `hoja-sale` con `--hoja-cerrada-arriba` en base.css), que usarán las demás hojas; sin movimiento si el sistema pide reducirlo.
3. **Panel abierto**: título *En esta venta* con la flecha ⌄ para ocultarlo (también se oculta tocando la asa gris de arriba o el título); sin raya sobre el total; cada línea, compacta: foto, nombre e importe; debajo, **"Quedan N unid."** (o "Se acaba") y, bajo el importe, el **precio por unidad, que es el botón para cambiarlo** en toda la línea (subrayado, con lápiz; con precio especial, etiqueta y "Precio especial"); − / + y *Quitar* (la línea se desvanece y las de abajo suben suave; al agregar, aparece); y, en la línea con el precio de siempre y más de una unidad, el enlace ***¿Vendiste alguno a otro precio?*** (RN-OP-11), que abre *¿Cuántos? (de N)* y *¿A cuánto cada uno? (S/)* con *Guardar* y *Cancelar*; mientras esté abierto (o el de cambiar precio), *Confirmar venta* queda bloqueado con "Guarda o cancela el precio para confirmar.". Las líneas y *¿Cuándo fue la venta?* van seguidas, sin huecos; **Total · N productos** y **Confirmar venta** quedan pegados abajo. Todos los textos van a la letra elegida o más (RN-UX-01) y todo lo tocable mide 48 px o más.
4. **Panel oculto** (con *Ocultar* o tocando el título; se vuelve a abrir con *Ver detalle*, siempre con botón: RN-UX-05): pegado abajo, no tapa la grilla: título, total y Confirmar venta (en celular horizontal, en dos filas). Confirmar desde ahí registra con *Ahora*. Si se quitan todas las líneas, el panel baja y desaparece.
5. Pantalla de éxito, al centro del alto libre y con la animación compartida de aparecer (el ✓ crece y el resto sube suave: `aparece` en base.css): ✓, *Venta registrada*, el total y **lo que se vendió** (cada producto con "2 unid. × S/ 3.50", su importe y, si va, "Precio especial"), *Nueva venta* y, arriba a la derecha de la misma pantalla, **Deshacer (10)** con la cuenta de los 10 s (RN-OP-18) → vuelve a Vender con el carrito. Si la persona se va de la pantalla (o toca *Nueva venta*), el Deshacer desaparece: no sigue en otra vista; lo que se deshizo se anuncia y se ve en el pie.

En PC (desde 1024 px) no hay panel deslizable: el carrito queda a la derecha del buscador con el mismo contenido que el panel expandido y *Confirmar venta*. El panel es una región con nombre ("En esta venta"); al abrirse (también al aparecer con el primer producto) el foco pasa a su título y al ocultarlo vuelve al botón; la cabecera lleva `aria-expanded`; sin animación si el sistema pide reducir movimiento.

### Recibir (Llegó mercadería)
Es el llenado de inventario: más simple que Vender. En celular (< 1024 px) usa **el mismo panel que Vender** (RN-OP-22): abajo desde el inicio, en *Valor total · 0 productos* S/ 0.00; con el primer producto crece a toda la pantalla; *Ocultar* (flecha ⌄, asa o título) lo deja abajo; mismas animaciones. Al confirmar, la pantalla de éxito es la misma de Vender: al centro, *Llegada registrada*, *N productos · Valor total*, lo que llegó (cada producto con "12 unid. × S/ 2.40", su importe y *Costo nuevo* si cambió), *Nueva llegada* y **Deshacer (10)** arriba a la derecha. Título *Lo que llegó*, *¿Cuándo llegó?* y el botón *Registrar llegada*. Cada línea muestra su **costo** editable (el costo por unidad es el botón *Cambiar costo*, con *Costo nuevo* si cambió) en lugar del precio de venta; no lleva *¿Vendiste alguno a otro precio?* ni tope de stock (es ingreso). Mientras un costo esté en edición, *Registrar llegada* queda bloqueado ("Guarda o cancela el costo para confirmar."). Se puede abrir prellenada desde *Para comprar* (en celular el panel se abre solo, a toda la pantalla, con el aviso *Cargamos tu lista para comprar de hoy* adentro). Al confirmar, avisa si algo es una **sobrecompra** (RN-OP-20; *Cambiar cantidad* abre el panel y deja el foco en esa cantidad). El total se llama **Valor total** en todas partes (panel, PC, éxito, anuncios y detalle de la operación). En PC (≥ 1024 px) queda como estaba: buscador a la izquierda y carrito *Lo que llegó* a la derecha, con *Valor total*.

### ¿Necesito comprar?
Buscador grande → al tocar un producto, una respuesta clara en letras grandes: **"Sí, compra ~12 unid."**, **"No hace falta: te alcanza para ~20 días"** o **"No compres: no se vende hace 45 días"** (RN-AN-16). Pensado para usarse en el mercado, sin internet.

### Contar todo (conteo guiado)
Un producto por pantalla, con foto grande, agrupados por categoría: "¿Cuántos hay?" → *Siguiente*. Barra de progreso ("Llevas 23 de 80"), botones *Saltar* y *Seguir después* (RN-OP-21).

### Productos
Lista con el buscador y, a su lado, el botón **Filtros** (solo ícono, con un número encima cuando hay filtros puestos; siempre en la misma fila, también con letra Muy grande). «Categorías» queda junto al título (si no cabe, solo ícono). *Filtros* abre una **hoja inferior** (la misma de Movimientos) con **Mostrar** (Todos · Se acaban · Queda poco · Agotados · Archivados) y **Categoría** como lista de una opción por fila, la elegida marcada; abajo, un botón fijo «Ver N productos» que cierra la hoja. Lo activo se ve debajo del buscador como **chips** quitables en una sola línea («Se acaban ✕», «Limpieza ✕»; si no caben, se desplazan de lado); sin filtros no hay nada. *Se acaban* suma agotados y los que quedan poco; se abre ya elegido desde el aviso de Inicio (`/productos?estado=se-acaban`). Cada fila: foto, nombre, **stock con unidad**, estado (color + ícono + texto). El **detalle** muestra: stock, "se acaba en ~N días", precios y ganancia por unidad, tendencia de 8 semanas, últimos movimientos y botones *Editar*, *Contar stock*, *Registrar pérdida*, *Archivar*.

**Agregar producto** (botón fijo de abajo, o «Agregar el primero») abre el formulario de **Producto nuevo** en una **hoja inferior** a toda la pantalla, sin salir de la lista (con lo buscado ya escrito como nombre, si no se encontró). Al guardar, la confirmación («Producto guardado», con *Agregar otro producto* y *Ver producto*) se ve dentro de la hoja; la lista deja los filtros (para que no escondan lo nuevo) y se vuelve a leer al cerrar. La pantalla `/productos/nuevo` sigue para los otros accesos (Primera vez, enlaces, otras listas).

### Control (Torre de control)
Tarjetas apiladas en el orden de [04](04-torre-de-control.md); desde 768 px en dos columnas.

La tarjeta **Alquiler del local** (RN-AN-19), en sus dos estados configurados:
```
┌─ Alquiler del local ─────────────┐   ┌─ Alquiler del local ─────────────┐
│ Para el pago del 20/10 llevas    │   │ ✓ Ya cubriste el local del 20/10 │
│ S/ 820.00 de S/ 1 200.00         │   │ Lo que ganes de más es tuyo:     │
│ ████████████░░░░░░  68 %         │   │ llevas S/ 140.00                 │
│ Te falta S/ 380.00               │   │ ██████████████████  100 %        │
│                    Cambiar  ›    │   │                    Cambiar  ›    │
└──────────────────────────────────┘   └──────────────────────────────────┘
```
Cuando el pago cae hoy, mañana o pasado mañana, la tarjeta suma una línea arriba ("Mañana pagas el local: S/ 1 200.00", RN-AL-10).

*Configurar* y *Cambiar* abren la pantalla **Alquiler del local**: tres botones de opción (*Una vez al mes* · *Dos veces al mes* · *No pago, el local es mío*) y, si paga, el monto (con − / +, RN-UX-06) y uno o dos selectores del día del mes (1 al 31). Abajo, *Guardar*. La misma pantalla se abre desde *Ajustes → Datos de la tienda*.

### Movimientos (Historial)
Desde Inicio, **Movimientos** abre una **hoja inferior** (a toda la pantalla, sobre la navegación; se cierra con la flecha ⌄ "Cerrar", tocando la asa gris o el velo, o con Escape; lo de atrás queda inerte pero la navegación de abajo sigue alcanzable, el foco va al título al abrir y vuelve al botón al cerrar). Muestra las operaciones agrupadas por día ("Hoy", "Ayer", "Lunes 12") con **filtros de fecha**: *Hoy · Ayer · 7 días · 30 días · Elegir día* (al abrir, *7 días*; con *Elegir día* no se busca una fecha futura o inválida: avisa). La hoja abierta y su filtro viven en la dirección de Inicio (`/?movimientos=7-dias`), así que volver desde el detalle de una operación —también tras anularla— reabre la hoja con el mismo filtro. Por pedido se traen hasta 3 páginas; si falta, *Ver más*. Tocar una operación muestra el detalle y el botón **Anular**.

La pantalla *Historial* (`/historial`, con filtro por tipo) sigue existiendo para los enlaces que llegan a ella (detalle de un producto, avisos).

### Ajustes
Datos de la tienda (incluye *Alquiler del local*), días entre compras, días de anticipación, aviso de sobrecompra, tamaño de letra, notificaciones, categorías, **Guardar copia** (con el aviso "Hace N días que no guardas una copia", RN-RE-06), **Restaurar copia**, **Exportar a Excel**, **Importar productos**, **Revisar datos** y *Acerca de* (versión).

### Primera vez
Obligatoria (RN-UX-16), sin navegación fija:

1. **Bienvenida**: *Empezar*, o *Ya tengo una copia guardada* (RN-RE-10).
2. **Nombre de la tienda.**
3. **Tamaño de letra** (con vista previa).
4. **"¿Cómo quieres cargar tus productos?"**: *Uno por uno*, *Desde Excel* o *Más tarde*.
5. **"Ahora contemos lo que tienes"**: *Contar ahora* (solo si ya hay productos) o *Terminar* (con productos sin contar dice "Puedes contarlos después desde Inicio"). Completa la primera vez y abre el conteo guiado o Inicio.

El costo del local **no** es un paso: se configura desde su tarjeta en Control (RN-AN-19).

## Responsive

| Ancho | Diseño |
|---|---|
| 320–599 px (celular) | Una columna, navegación abajo, botón principal fijo abajo. |
| 600–1023 px (celular grande / tablet) | Una columna más ancha (máx. 720 px); Control en dos columnas desde 768 px. |
| ≥ 1024 px (PC) | Navegación lateral; Vender y Recibir con buscador a la izquierda y carrito a la derecha; contenido máx. 1200 px. |

Se diseña **primero para 360 px** (el ancho más común en Android) y se verifica en 320 px.

## Guía de palabras

| Usar | Evitar |
|---|---|
| Llegó mercadería | Registrar ingreso / entrada |
| Se dañó · Se derramó · Se venció | Merma (en pantalla) |
| Contar stock | Ajuste de inventario |
| Queda poco · Agotado · Bien | Stock crítico / bajo umbral |
| Se acaba en ~4 días | Cobertura de 4 días |
| Guardar copia | Backup / exportar JSON |
| ¿Necesito comprar? | Consulta de cobertura |
| Deshacer · Anular | Revertir / rollback |

# 06 · Experiencia de uso

La app la usa principalmente una **persona mayor en un celular Android**. Cada decisión de diseño se mide contra esa persona: vista cansada, dedos menos precisos, poca paciencia con lo técnico y miedo a "malograr algo".

Criterios ejecutables: pruebas E2E y de accesibilidad descritas en [07-calidad.md](07-calidad.md).

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
| **RN-UX-04** | **Íconos siempre acompañados de texto.** El color nunca es la única señal (RN-AL-05).<br>*Excepción deliberada:* el botón **Ajustes** de Inicio es solo la tuerca, con el nombre accesible "Ajustes" (`aria-label`) y una zona táctil de al menos 48 × 48 px. |
| **RN-UX-05** | **Sin gestos ocultos**: nada depende de deslizar, mantener presionado ni doble toque. Todo tiene un botón visible. |
| **RN-UX-06** | **Números fáciles**: los campos de cantidad y precio abren el teclado numérico y tienen botones **− / +** grandes. Se aceptan coma o punto como separador decimal. |
| **RN-UX-07** | **Mensajes en lenguaje simple**, en tono amable y de "tú". Los errores dicen **qué pasó y qué hacer**, nunca un código técnico: "Solo quedan 2 unid. de Lejía 1 L. Cambia la cantidad o registra la llegada de mercadería." |
| **RN-UX-08** | **Confirmaciones solo donde hay riesgo** (restaurar respaldo, archivar con stock, precio con pérdida). Lo demás se registra directo y ofrece **Deshacer** (RN-OP-18). |
| **RN-UX-09** | **Responsive real**: ninguna pantalla tiene desplazamiento horizontal entre **320 px y 1920 px** de ancho, en vertical y horizontal, y con la letra en *Muy grande*. |
| **RN-UX-10** | **Estados vacíos útiles**: cada lista vacía explica por qué y ofrece la acción siguiente ("Aún no tienes productos. **Agregar el primero**"). |
| **RN-UX-11** | **Retroalimentación inmediata**: cada operación muestra una confirmación visible (pantalla verde con ✓ y el resumen) y una vibración corta si el celular la permite. |
| **RN-UX-12** | **Navegación fija** con 5 destinos, ícono y texto: **Inicio · Vender · Recibir · Productos · Control**. En celular va abajo; desde 1024 px, a la izquierda. *Ajustes* e *Historial* se abren desde Inicio. |
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
│ ┌ 🟠 4 productos se acaban ┐ │
│ │ 1 agotado y 3 por acabarse│ │
│ │      Ver productos  ›    │ │
│ └──────────────────────────┘ │
│                              │
│   (espacio libre)            │
│ [ 🛒  VENDER               ] │
│ [ 📦  LLEGÓ MERCADERÍA     ] │
│ [ 🤔  ¿NECESITO COMPRAR?   ] │
│  Historial ›                 │
├──────────────────────────────┤
│ Inicio Vender Recibir Prod. Control │
└──────────────────────────────┘
```
El encabezado es el **nombre de la tienda en mayúsculas**, sin saludo ni emoji (si no hay nombre, el encabezado dice *Inicio*), y a la derecha la tuerca de *Ajustes*. Debajo va la **fecha en mayúsculas**, sin hora (el celular ya la muestra); es la fecha de la tienda (Lima) y, si la medianoche pasa con la app abierta, se pone al día al volver a la app. Las acciones quedan **abajo, sobre la navegación**, al alcance del pulgar; si el contenido es más alto que la pantalla (letra Muy grande, 320 px), todo fluye hacia abajo sin taparse.

### Vender
```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Vender                       │        │ Vender                       │
│ [ Buscar producto          ] │        │ [ Buscar producto          ] │
│ ╭──────────────────────────╮ │        │ Más vendidos  [Lejía][Carbón]│
│ │ ▬ En esta venta  Ocultar ▾│ │       │  (grilla, sigue a la vista)  │
│ │ [▢] Lejía 1 L     S/ 7.00│ │        │                              │
│ │     Quedan 8 unid.       │ │        │                              │
│ │     ✎ S/ 3.50 c/u        │ │        │ ╭──────────────────────────╮ │
│ │ [−] 2 [+]       🗑 Quitar │ │        │ │ ▬ En esta venta Ver det.▴│ │
│ │ ¿Cuándo fue la venta?    │ │        │ │ Total · 2 prod. S/ 11.00 │ │
│ │ ( Ahora )  ( Otro día )  │ │        │ │ [   Confirmar venta     ]│ │
│ │ Total · 2 prod. S/ 11.00 │ │        │ ╰──────────────────────────╯ │
│ │ [   Confirmar venta     ]│ │        │ Inicio Vender Recibir ...    │
│ ╰──────────────────────────╯ │        └──────────────────────────────┘
│ Inicio Vender Recibir ...    │
└──────────────────────────────┘
   panel abierto (al agregar)                   panel oculto
```
1. Buscar (campo grande arriba) → resultados con **foto grande**, nombre, precio y stock; los más vendidos primero. Debajo del buscador, accesos rápidos a los 8 productos más vendidos. No hay sección "En esta venta" mientras no se haya elegido nada.
2. Tocar un producto lo agrega con cantidad 1 y **sube desde abajo el panel de venta ya abierto** (RN-OP-22). Mide lo que ocupa su contenido, sin huecos (con muchas líneas llega casi arriba y las líneas se desplazan dentro), y no tapa la grilla: se siguen tocando productos para agregarlos.
3. **Panel abierto**: título *En esta venta* con *Ocultar*; cada línea, compacta: foto, nombre, **"Quedan N unid."** (o "Se acaba") y el **precio por unidad, que es el botón para cambiarlo** (subrayado, con lápiz; con precio especial, etiqueta y la marca "Precio especial"), con el importe a la derecha; debajo − / + y *Quitar*. Luego *¿Cuándo fue la venta?* (*Ahora* / *Otro día*); abajo, siempre a la vista, **Total · N productos** y **Confirmar venta**. Todos los textos van a la letra elegida o más (RN-UX-01) y todo lo tocable mide 48 px o más.
4. **Cambiar precio** abre, en la misma línea, *Nuevo precio en S/* y, si hay más de una unidad, *¿Para cuántas? (de N)* (RN-OP-11). **Panel oculto** (con *Ocultar* o tocando el título; se vuelve a abrir con *Ver detalle*, siempre con botón: RN-UX-05): título, total y Confirmar venta. Confirmar desde ahí registra con *Ahora*. Si se quitan todas las líneas, el panel baja y desaparece.
5. Pantalla de éxito con ✓, resumen y **Deshacer** (10 s) → vuelve a Vender vacío.

En PC (desde 1024 px) no hay panel deslizable: el carrito queda a la derecha del buscador con el mismo contenido que el panel expandido y *Confirmar venta*. El panel es una región con nombre ("En esta venta"); al abrirse con su botón el foco pasa a su título y al ocultarlo vuelve al botón (al aparecer con el primer producto, el foco se queda en la grilla); la cabecera lleva `aria-expanded`; sin animación si el sistema pide reducir movimiento.

### Recibir (Llegó mercadería)
Igual que Vender, pero cada línea muestra **costo** editable en lugar del precio de venta. Se puede abrir prellenada desde *Para comprar*. Al confirmar, avisa si algo es una **sobrecompra** (RN-OP-20).

### ¿Necesito comprar?
Buscador grande → al tocar un producto, una respuesta clara en letras grandes: **"Sí, compra ~12 unid."**, **"No hace falta: te alcanza para ~20 días"** o **"No compres: no se vende hace 45 días"** (RN-AN-16). Pensado para usarse en el mercado, sin internet.

### Contar todo (conteo guiado)
Un producto por pantalla, con foto grande, agrupados por categoría: "¿Cuántos hay?" → *Siguiente*. Barra de progreso ("Llevas 23 de 80"), botones *Saltar* y *Seguir después* (RN-OP-21).

### Productos
Lista con buscador, filtros por categoría y por estado (Todos · Se acaban · Queda poco · Agotados · Archivados). *Se acaban* suma agotados y los que quedan poco; se abre ya elegido desde el aviso de Inicio (`/productos?estado=se-acaban`). Cada fila: foto, nombre, **stock con unidad**, estado (color + ícono + texto). El **detalle** muestra: stock, "se acaba en ~N días", precios y ganancia por unidad, tendencia de 8 semanas, últimos movimientos y botones *Editar*, *Contar stock*, *Registrar pérdida*, *Archivar*.

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

### Historial
Operaciones agrupadas por día ("Hoy", "Ayer", "Lunes 12"), con filtro por tipo. Tocar una muestra el detalle y el botón **Anular**.

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

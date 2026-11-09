# 04 · Qué hace la app hoy (v0.6.0)

> Recorrido por pantallas, en palabras de la tienda. Las reglas exactas están en las [specs de la Fase 1](../specs/fase-1/README.md); el diseño de cada pantalla, en [06-experiencia-de-uso](../specs/fase-1/06-experiencia-de-uso.md) y los [patrones de diseño](../diseno/patrones.md).

La navegación de abajo tiene cinco destinos: **Inicio · Vender · Recibir · Productos · Control**. Ajustes se abre con la tuerca de Inicio.

## Primera vez

Una guía obligatoria de 5 pasos, sin salidas a medias:

1. **Bienvenida**: *Empezar* o *Ya tengo una copia guardada* (restaura una copia, por ejemplo en un celular nuevo).
2. **Nombre de la tienda.**
3. **Tamaño de letra**: Normal, Grande o Muy grande, con vista previa.
4. **¿Cómo quieres cargar tus productos?**: uno por uno, desde Excel o más tarde.
5. **Ahora contemos lo que tienes**: abre el conteo guiado o termina.

## Inicio

Entra completo en una sola pantalla de celular:

- El **nombre de la tienda** y la **fecha**.
- **Total vendido** de hoy (la cifra principal) y **Ganancia real** (o *Pérdida real*).
- Un **carrusel de avisos**: *N agotados*, *Queda poco: N*, *N precios para revisar*. Cada aviso lleva a Productos ya filtrado o a Ayuda inteligente.
- Los botones **Vender**, **Llegó mercadería** y **¿Necesito comprar?**, abajo, al alcance del pulgar.
- **Movimientos**: abre una hoja con todo lo que pasó, por días (Hoy, Ayer, 7 días, 30 días o un día elegido).

## Vender

1. Se busca el producto escribiendo parte del nombre. Los resultados muestran **foto grande**, precio y stock, y debajo del buscador están los **más vendidos**.
2. Al tocar un producto se abre el panel **En esta venta** a pantalla completa, con cantidad, importe y "Quedan N unid.". Con *Ocultar* se vuelve a la lista para agregar más.
3. Detalles útiles:
   - **No se puede vender más de lo que hay.**
   - El **lápiz del precio** cambia el precio del producto para siempre, siempre con una pregunta de confirmación. Si el precio nuevo deja pérdida, pide una segunda confirmación.
   - **¿Vendiste alguno a otro precio?** sirve para un precio distinto solo en esa venta (por ejemplo, una unidad más barata para un amigo).
   - **¿Cuándo fue la venta?**: *Ahora* u *Otro día*, para anotar una venta olvidada.
4. **Confirmar venta** muestra la confirmación al centro, con lo vendido y el total, y **Deshacer (10)** durante 10 segundos.

Productos por kilo o litro (como el carbón) aceptan decimales.

## Recibir (Llegó mercadería)

Igual que Vender, pero para lo que llega:

- El panel **Lo que llegó** va con cantidad y **costo** de cada producto. Si el costo cambió, se marca *Costo nuevo*.
- Se puede anotar **cuándo llegó**.
- **Aviso de sobrecompra**: si lo que llega alcanza para más días que el límite configurado (30 por defecto), o si el producto está parado, la app avisa con *Esto es más de lo que necesitas*. Muestra una fila por producto con cuánto llega, para cuántos días alcanza y cuánto se sugería comprar. Se puede *Cambiar cantidad* o *Registrar igual*.
- Al confirmar: *Llegada registrada*, con el **valor total** y *Deshacer (10)*.

## ¿Necesito comprar?

Pensado para el **mercado mayorista, sin internet**. Se elige un producto y la app responde con una sola frase grande:

- **"Sí, compra ~12 unid."** (con el costo estimado)
- **"No hace falta: te alcanza para ~20 días"**
- **"No compres: no se vende hace 45 días y tienes 8"**

## Productos

- Buscador y botón **Filtros**: Todos, Se acaban, Queda poco, Agotados, Archivados y por **categoría**. Lo filtrado se ve en chips que se quitan con ✕.
- **Agregar producto** en una hoja, sin salir de la lista: nombre, foto, categoría, unidad (unidad, kilo o litro), precio de compra, precio de venta, stock mínimo ("Avisarme cuando queden") y stock inicial.
- **Categorías** junto al título.
- **Detalle de un producto**:
  - Foto, cuánto **tienes** y su estado.
  - Pronóstico "Se acaba en ~N días" y "Vendes ~2 unid. al día".
  - Gráfico de las últimas 8 semanas.
  - Historial del producto.
  - **Contar stock**, **Registrar pérdida** (se dañó, se derramó, se venció), editar y **archivar**: sale de la lista sin perder su historial.

## Control (para medir)

Tarjetas apiladas, en dos columnas en pantallas anchas:

- **Resumen**: Total vendido y Ganancia real de Hoy, Ayer, 7 días o 30 días, con el costo de lo vendido, las pérdidas y las diferencias de conteo.
- **Alquiler del local**: "Para el pago del 20/10 llevas S/ 820.00 de S/ 1 200.00 · Te falta S/ 380.00", con barra de avance. Cuando el pago se acerca: "Mañana pagas el local".
- **Tus mejores productos**: más vendidos o más ganancia, en 7 o 30 días.
- **Semana contra semana**: ventas o ganancia, en gráfico de barras.
- **Mejor día de la semana**: barras de lunes a domingo (con al menos 14 días de historia).
- Botón **Ayuda inteligente**, con cuántas cosas hay para mirar.

## Ayuda inteligente

Lo que conviene atender:

- **Atención**: productos agotados, con poco stock y **precios para revisar** (venta menor o igual que la compra).
- **Para comprar**: lista con la cantidad sugerida y el costo estimado de cada producto y el total. Se pueden cambiar cantidades o quitar productos, y **compartir la lista por WhatsApp**.
- **Productos parados**: con stock y sin ventas en 30 días, con el **dinero inmovilizado** y una sugerencia: "Ponlo a la vista u ofrécelo con descuento".

## Contar todo (conteo guiado)

Recorre la tienda producto por producto, agrupado por categoría y con foto grande:

- Pregunta "¿Cuántos hay?" y sigue con *Siguiente*.
- Muestra el avance ("Llevas 23 de 80").
- Tiene *Saltar* y *Seguir después*.
- Corrige el stock de lo contado y guarda la diferencia como ajuste.

## Avisos

- Cada producto está **Normal**, **Por acabarse** o **Agotado**. Pasa a *Por acabarse* cuando llega al stock mínimo o cuando, según cómo se vende, se acaba dentro de los días de anticipación (3 por defecto).
- La app avisa **solo cuando el estado empeora** y no repite el aviso hasta que el producto se repone.
- Hay notificaciones del sistema, con permiso del usuario, mientras la app está abierta o se acaba de usar. Con la app cerrada llegan en la Fase 2.
- **Recordatorio del pago del local** dos días antes.

## Ajustes

- **Datos de la tienda**: nombre y alquiler del local.
- Días entre compras, días de anticipación y límite del aviso de sobrecompra.
- Tamaño de letra, notificaciones y categorías.
- **Guardar copia**, con el aviso "Hace N días que no guardas una copia", y **Restaurar copia**.
- **Exportar a Excel** e **Importar productos** desde una plantilla.
- **Revisar datos**: recalcula el stock desde el libro de operaciones, corrige cualquier diferencia y dice qué cambió.
- **Acerca de**: la versión.

## Deshacer y anular

Nada se borra:

- Lo recién registrado se puede **deshacer** durante 10 segundos.
- Después, cualquier operación se **anula** desde Movimientos: la app registra una operación que la revierte por completo, y el historial queda completo.

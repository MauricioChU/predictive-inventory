# 02 · Operaciones de stock (Inventario)

Cómo cambia el stock: ventas, llegada de mercadería, mermas, conteos y correcciones.

Criterios de aceptación ejecutables: [features/operaciones.feature](features/operaciones.feature)

## Historias de usuario

| Id | Historia |
|---|---|
| HU-OP-01 | Como usuario principal quiero **vender uno o varios productos** y ver el **total a cobrar**, para no hacer cuentas a mano. |
| ~~HU-OP-02~~ | **Retirada** (2026-10-19): el dueño no usa el vuelto en la app. |
| HU-OP-03 | Como usuario principal quiero registrar **la mercadería que llegó** con su precio de compra. |
| HU-OP-04 | Como usuario principal quiero registrar **lo que se dañó, derramó o venció**, para que el stock sea real. |
| HU-OP-05 | Como usuario principal quiero **contar lo que hay en el estante** y que la app corrija el stock. |
| HU-OP-06 | Como usuario principal quiero **deshacer** algo que registré mal. |
| HU-OP-07 | Como usuario principal quiero **anotar una venta de ayer** que olvidé registrar. |
| HU-OP-08 | Como administrador quiero ver el **historial** de todo lo que pasó con un producto. |
| HU-OP-09 | Como usuario principal quiero que la app **me avise si estoy comprando de más**, porque suelo comprar mercadería que no se vende a tiempo. |
| HU-OP-10 | Como usuario principal quiero **contar toda la tienda paso a paso**, porque la mercadería está desordenada y no sé cuánto tengo realmente. |

## Modelo

El inventario funciona como un **libro de operaciones**: cada hecho del negocio se escribe una vez y nunca se borra. El stock de un producto es la suma de sus movimientos ([ADR-0002](../../adr/0002-libro-de-operaciones-inmutable.md)).

### Operación (agregado, inmutable)

| Campo | Notas |
|---|---|
| `id` | UUID generado en el dispositivo (clave de idempotencia para la sincronización de la Fase 2). |
| `tipo` | Ver tabla de tipos. |
| `movimientos` | Lista no vacía, un movimiento por producto. Sin ningún producto se rechaza: "Agrega al menos un producto". |
| `ocurridaEn` | Fecha-hora del hecho (por defecto, ahora). |
| `registradaEn` | Fecha-hora en que se anotó. |
| `motivo` | Obligatorio en `MERMA`; opcional en `AJUSTE` y `ANULACION`. |
| `nota` | Texto libre opcional (máx. 200 caracteres; si se pasa: "La nota puede tener hasta 200 caracteres"). |
| `anulaA` | Solo en `ANULACION`: id de la operación revertida. |
| `dispositivoId` | Identificador del dispositivo que la registró. |

### Movimiento (parte de la operación)

| Campo | Notas |
|---|---|
| `productoId` | |
| `cantidad` | Cantidad **con signo** (+ entra, − sale), en la unidad del producto. |
| `costoUnitario` | Precio de compra del producto en ese momento (o el que se indicó en un ingreso). Siempre se guarda. |
| `precioUnitario` | Solo en ventas: precio de venta aplicado. |

### Tipos de operación

| Tipo | En pantalla | Efecto en stock | Datos propios |
|---|---|---|---|
| `STOCK_INICIAL` | Stock inicial | + | Costo = precio de compra del producto |
| `INGRESO` | Llegó mercadería | + | Costo de compra por línea |
| `VENTA` | Venta | − | Precio de venta y costo por línea |
| `MERMA` | Se dañó / se derramó / se venció / otro | − | Motivo obligatorio |
| `AJUSTE` | Conteo de stock / producto retirado | + o − | Diferencia calculada |
| `ANULACION` | Anulado | Inverso de la operación original | `anulaA` |

### Existencia (proyección)

`productoId → cantidad actual`. Se actualiza **en la misma transacción** que la operación y puede reconstruirse en cualquier momento sumando los movimientos ([RN-OP-19](#integridad)).

## Reglas de negocio

### Generales

| Id | Regla |
|---|---|
| **RN-OP-01** | El stock **solo cambia mediante operaciones**. No existe una forma de editar el número de stock directamente. |
| **RN-OP-02** | Las operaciones son **inmutables**: no se editan ni se borran. Para corregir, se anula y se vuelve a registrar. |
| **RN-OP-03** | Cada movimiento tiene una **cantidad mayor que 0** (antes de aplicar el signo) y no mayor a 99 999. |
| **RN-OP-04** | **Precisión por unidad**: `UNIDAD` solo acepta enteros; `KILO` y `LITRO` aceptan hasta **3 decimales** (gramos o mililitros). |
| **RN-OP-05** | **El stock nunca es negativo.** Si una operación dejaría algún producto bajo 0, se rechaza **completa** y el mensaje dice qué producto falta y cuánto hay: "Solo quedan 2 unid. de Lejía 1 L". |
| **RN-OP-06** | Una operación con varias líneas se registra **entera o no se registra** (atómica). |
| **RN-OP-07** | Una operación no repite un producto: si se agrega dos veces el mismo, se **suman** las cantidades en una sola línea. Solo se suman líneas con el mismo precio (el de venta en una venta, el costo en un ingreso). En un ingreso, con costos distintos se rechaza: "Pusiste el mismo producto dos veces con distinto precio. Déjalo en una sola línea." En una venta, cada precio queda en su propia línea (RN-OP-11). |
| **RN-OP-08** | Solo se operan productos **activos** (salvo la anulación de una operación pasada de un producto ya archivado). Un producto que no existe se rechaza: "No encontramos ese producto". |
| **RN-OP-09** | La fecha de una operación puede ser **ahora o hasta 7 días atrás**, nunca futura. Por defecto es ahora. Si se elige otra fecha, se elige también la hora; sin hora (o si no se puede leer) se pide: "Elige la fecha y la hora". La validación de stock (RN-OP-05) se hace contra el stock **actual**. |

### Venta

| Id | Regla |
|---|---|
| **RN-OP-10** | Cada línea de venta guarda el **precio de venta** y el **costo unitario** vigentes en ese momento. |
| **RN-OP-11** | El precio de una línea puede cambiarse **solo para esa venta** (rebaja o precio especial). Debe ser mayor que S/ 0.00. El precio del producto no cambia. Si la línea tiene más de una unidad, se elige **para cuántas** (por defecto, todas): con menos, esas unidades pasan a otra línea del mismo producto con ese precio (p. ej. de 5, 4 a S/ 3.50 y 1 a S/ 3.00 para un amigo), y la venta se registra con las dos líneas, cada una con su precio y su ganancia. El stock (RN-OP-05) y "Quedan" (RN-OP-22) cuentan las dos juntas. Volver una parte al precio de siempre la junta otra vez con su línea. |
| **RN-OP-12** | **Importe de línea** = precio × cantidad, redondeado al céntimo (mitad hacia arriba). **Total de la venta** = suma de importes de línea. **Ganancia de línea** = importe − (costo × cantidad redondeado al céntimo). |
| ~~RN-OP-13~~ | **Retirada** (2026-10-19): el dueño no usa el vuelto en la app; ya no se pregunta con cuánto pagan. |
| **RN-OP-22** | **Panel de venta**: al agregar el primer producto aparece el panel **ya abierto**, con las líneas, el total y *Confirmar venta*; mide lo que ocupa su contenido (sin huecos) y no tapa la grilla, que se sigue tocando para agregar; *Ocultar* lo deja en el título, el total y *Confirmar venta*; cada línea muestra cuántas unidades quedan tras la venta (stock − cantidad) en tiempo real ("Quedan 7 unid."; si no queda nada, "Se acaba"; si la cantidad pasa el stock, vale RN-OP-05); *¿Cuándo fue la venta?* está en el panel abierto; confirmar registra la venta con *Ahora* salvo que se haya elegido *Otro día* (RN-OP-09). |

### Llegada de mercadería (ingreso)

| Id | Regla |
|---|---|
| **RN-OP-14** | Cada línea de ingreso lleva un **costo unitario**, prellenado con el precio de compra actual del producto. Si se cambia, al confirmar se pregunta "¿Actualizar el precio de compra a S/ X?" (opción por defecto: sí) y se muestra el nuevo margen contra el precio de venta. |
| **RN-OP-20** | **Aviso de sobrecompra**: al confirmar un ingreso, cada línea se revisa con dos criterios. (a) Si el producto tiene predicción y (stock actual + cantidad) ÷ VPD **supera** el límite configurado (valor inicial: 30 días), se avisa: "Con esto tendrías Lejía 1 L para ~60 días. Te sugerimos ~7 unid." si el producto está en *Para comprar*, o "… Ahora no necesitabas comprar." si no lo está (días = (stock + cantidad) ÷ VPD, redondeado hacia abajo). (b) Si el producto está **parado** (RN-AN-11), se avisa: "Lejía 1 L no se vende hace 45 días y aún tienes 4 unid.". El aviso **no bloquea**: se puede *Registrar igual* o *Cambiar cantidad*. Sin predicción ni producto parado, no hay aviso. |

### Merma y ajuste

| Id | Regla |
|---|---|
| **RN-OP-15** | La **merma** exige un motivo: *Se dañó o rompió*, *Se derramó*, *Se venció* u *Otro* (con nota obligatoria). Su costo es costo unitario × cantidad y cuenta como **pérdida**. |
| **RN-OP-16** | **Contar stock**: el usuario escribe cuánto **hay realmente**. La app calcula la diferencia contra el stock actual. Si es 0, no se registra nada y se muestra "El stock ya estaba correcto". Si no, se registra un `AJUSTE` por la diferencia (positiva o negativa). Los ajustes no cuentan como ganancia ni como merma: se muestran aparte como *Diferencias de conteo*. |
| **RN-OP-21** | **Conteo guiado** ("Contar todo"): recorre los productos activos agrupados por categoría y ordenados por nombre, uno por pantalla. Cada respuesta se registra **al momento** como en RN-OP-16, así que no se pierde nada si se interrumpe. Se puede *Saltar* un producto o *Seguir después*: el conteo recuerda en qué producto quedó y cuáles faltan. Al terminar muestra un resumen: productos contados, productos con diferencia y el valor total de las diferencias (si no se contó ninguno: "No contaste ningún producto."). |

### Anulación y deshacer

| Id | Regla |
|---|---|
| **RN-OP-17** | Cualquier operación, salvo una `ANULACION`, puede **anularse una sola vez**. La anulación invierte todos sus movimientos y se rechaza si dejaría stock negativo (RN-OP-05), por ejemplo al anular un ingreso cuya mercadería ya se vendió. La operación anulada y su anulación **no cuentan** en ningún cálculo de ventas, ganancias, mermas ni tendencias. |
| **RN-OP-18** | Después de registrar cualquier operación se muestra **"Deshacer"** durante 10 segundos. Deshacer equivale a anularla sin pedir motivo. Un toque que llega cuando ya pasó ese tiempo se rechaza con "Ya pasó el tiempo para deshacer. Puedes anularla desde el Historial." El stock inicial y el retiro de stock que se registran al crear o archivar un producto (RN-CAT-08, RN-CAT-11) no ofrecen Deshacer. |

### Integridad

| Id | Regla |
|---|---|
| **RN-OP-19** | Para todo producto, la existencia guardada es **igual** a la suma de sus movimientos. Una verificación (en Ajustes → *Revisar datos*) recalcula las existencias desde el libro y corrige cualquier diferencia, informando qué cambió. |

## Ejemplos de cálculo

| Producto | Unidad | Precio | Costo | Cantidad | Importe | Costo total | Ganancia |
|---|---|---|---|---|---|---|---|
| Lejía 1 L | UNIDAD | S/ 3.50 | S/ 2.40 | 2 | S/ 7.00 | S/ 4.80 | S/ 2.20 |
| Carbón | KILO | S/ 4.00 | S/ 2.75 | 1.25 | S/ 5.00 | S/ 3.44 | S/ 1.56 |
| Detergente a granel | KILO | S/ 7.90 | S/ 5.30 | 0.333 | S/ 2.63 | S/ 1.76 | S/ 0.87 |
| **Total** | | | | | **S/ 14.63** | **S/ 10.00** | **S/ 4.63** |

Cálculos con redondeo al céntimo, mitad hacia arriba: 2.75 × 1.25 = 3.4375 → 3.44; 7.90 × 0.333 = 2.6307 → 2.63; 5.30 × 0.333 = 1.7649 → 1.76.

## Eventos de dominio

| Evento | Datos | Lo escuchan |
|---|---|---|
| `OperacionRegistrada` | id, tipo, productos afectados | Alertas, Análisis |
| `OperacionAnulada` | id original, id de la anulación, productos afectados | Alertas, Análisis |

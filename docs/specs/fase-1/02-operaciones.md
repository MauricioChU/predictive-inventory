# 02 · Operaciones de stock (Inventario)

Cómo cambia el stock: ventas, llegada de mercadería, mermas, conteos y correcciones.

Criterios de aceptación ejecutables: [features/operaciones.feature](features/operaciones.feature)

## Historias de usuario

| Id | Historia |
|---|---|
| HU-OP-01 | Como usuario principal quiero **vender uno o varios productos** y ver el **total a cobrar**, para no hacer cuentas a mano. |
| HU-OP-02 | Como usuario principal quiero escribir **con cuánto me pagaron** y ver el **vuelto**. |
| HU-OP-03 | Como usuario principal quiero registrar **la mercadería que llegó** con su precio de compra. |
| HU-OP-04 | Como usuario principal quiero registrar **lo que se dañó, derramó o venció**, para que el stock sea real. |
| HU-OP-05 | Como usuario principal quiero **contar lo que hay en el estante** y que la app corrija el stock. |
| HU-OP-06 | Como usuario principal quiero **deshacer** algo que registré mal. |
| HU-OP-07 | Como usuario principal quiero **anotar una venta de ayer** que olvidé registrar. |
| HU-OP-08 | Como administrador quiero ver el **historial** de todo lo que pasó con un producto. |

## Modelo

El inventario funciona como un **libro de operaciones**: cada hecho del negocio se escribe una vez y nunca se borra. El stock de un producto es la suma de sus movimientos ([ADR-0002](../../adr/0002-libro-de-operaciones-inmutable.md)).

### Operación (agregado, inmutable)

| Campo | Notas |
|---|---|
| `id` | UUID generado en el dispositivo (clave de idempotencia para la sincronización de la Fase 2). |
| `tipo` | Ver tabla de tipos. |
| `movimientos` | Lista no vacía, un movimiento por producto. |
| `ocurridaEn` | Fecha-hora del hecho (por defecto, ahora). |
| `registradaEn` | Fecha-hora en que se anotó. |
| `motivo` | Obligatorio en `MERMA`; opcional en `AJUSTE` y `ANULACION`. |
| `nota` | Texto libre opcional (máx. 200 caracteres). |
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
| **RN-OP-07** | Una operación no repite un producto: si se agrega dos veces el mismo, se **suman** las cantidades en una sola línea. |
| **RN-OP-08** | Solo se operan productos **activos** (salvo la anulación de una operación pasada de un producto ya archivado). |
| **RN-OP-09** | La fecha de una operación puede ser **ahora o hasta 7 días atrás**, nunca futura. Por defecto es ahora. La validación de stock (RN-OP-05) se hace contra el stock **actual**. |

### Venta

| Id | Regla |
|---|---|
| **RN-OP-10** | Cada línea de venta guarda el **precio de venta** y el **costo unitario** vigentes en ese momento. |
| **RN-OP-11** | El precio de una línea puede cambiarse **solo para esa venta** (rebaja o precio especial). Debe ser mayor que S/ 0.00. El precio del producto no cambia. |
| **RN-OP-12** | **Importe de línea** = precio × cantidad, redondeado al céntimo (mitad hacia arriba). **Total de la venta** = suma de importes de línea. **Ganancia de línea** = importe − (costo × cantidad redondeado al céntimo). |
| **RN-OP-13** | **Vuelto** (opcional, no se guarda): vuelto = pagado − total. Si lo pagado es menor que el total, se muestra "Faltan S/ X" y no se puede confirmar el cobro con ese monto. Hay botones rápidos con billetes: S/ 10, 20, 50, 100 y "Exacto". |

### Llegada de mercadería (ingreso)

| Id | Regla |
|---|---|
| **RN-OP-14** | Cada línea de ingreso lleva un **costo unitario**, prellenado con el precio de compra actual del producto. Si se cambia, al confirmar se pregunta "¿Actualizar el precio de compra a S/ X?" (opción por defecto: sí) y se muestra el nuevo margen contra el precio de venta. |

### Merma y ajuste

| Id | Regla |
|---|---|
| **RN-OP-15** | La **merma** exige un motivo: *Se dañó o rompió*, *Se derramó*, *Se venció* u *Otro* (con nota obligatoria). Su costo es costo unitario × cantidad y cuenta como **pérdida**. |
| **RN-OP-16** | **Contar stock**: el usuario escribe cuánto **hay realmente**. La app calcula la diferencia contra el stock actual. Si es 0, no se registra nada y se muestra "El stock ya estaba correcto". Si no, se registra un `AJUSTE` por la diferencia (positiva o negativa). Los ajustes no cuentan como ganancia ni como merma: se muestran aparte como *Diferencias de conteo*. |

### Anulación y deshacer

| Id | Regla |
|---|---|
| **RN-OP-17** | Cualquier operación, salvo una `ANULACION`, puede **anularse una sola vez**. La anulación invierte todos sus movimientos y se rechaza si dejaría stock negativo (RN-OP-05), por ejemplo al anular un ingreso cuya mercadería ya se vendió. La operación anulada y su anulación **no cuentan** en ningún cálculo de ventas, ganancias, mermas ni tendencias. |
| **RN-OP-18** | Después de registrar cualquier operación se muestra **"Deshacer"** durante 10 segundos. Deshacer equivale a anularla sin pedir motivo. |

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

Si pagan con S/ 20.00, el vuelto es S/ 5.37.

## Eventos de dominio

| Evento | Datos | Lo escuchan |
|---|---|---|
| `OperacionRegistrada` | id, tipo, productos afectados, existencias resultantes | Alertas, Análisis |
| `OperacionAnulada` | id original, id de la anulación | Alertas, Análisis |

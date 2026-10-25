# 04 · Torre de control (Análisis)

Una vista con todo lo que conviene saber del negocio: cuánto se gana, qué se acaba, qué comprar y qué se vende más. En la navegación se llama **Control**.

Criterios de aceptación ejecutables: [features/torre-de-control.feature](features/torre-de-control.feature)

## Historias de usuario

| Id | Historia |
|---|---|
| HU-AN-01 | Como usuario principal quiero saber **cuánto gané hoy**. |
| HU-AN-02 | Como usuario principal quiero saber **en cuántos días se acaba** cada producto según cómo se vende. |
| HU-AN-03 | Como usuario principal quiero una **lista de compras** con cantidades sugeridas y cuánto dinero necesito, que pueda mandar por WhatsApp. |
| HU-AN-04 | Como administrador quiero ver **qué se vende más** y qué deja más ganancia. |
| HU-AN-05 | Como administrador quiero ver **qué productos están parados** y cuánto dinero hay ahí. |
| HU-AN-06 | Como administrador quiero que me avisen de **precios mal puestos**. |
| HU-AN-07 | Como administrador quiero comparar **esta semana con la anterior** y saber **qué día se vende más**. |
| HU-AN-08 | Como usuario principal quiero **preguntar a la app si necesito comprar** un producto cuando estoy en el mercado, para no comprar de más. |
| HU-AN-09 | Como usuario principal quiero saber **si lo que voy ganando ya cubre el alquiler del local** antes de la próxima fecha de pago. |

## Secciones de la vista (en este orden)

1. **Resumen**: *Total vendido* (cifra principal), *Ganancia real* (con pérdida, *Pérdida real*), costo de lo vendido, *Pérdidas* y *Diferencias de conteo* del periodo (Hoy · Ayer · 7 días · 30 días).
2. **Alquiler del local**: cuánto llevas ganado para el próximo pago (RN-AN-17 a RN-AN-19).
3. **Tus mejores productos**: un solo bloque con un selector entre *Más vendidos* y *Más ganancia* (top 5, RN-AN-09).
4. **Semana contra semana**: gráfico de barras (esta semana contra la anterior) por métrica.
5. **Mejor día de la semana**.
6. Botón **Ayuda inteligente** (con el número de cosas por mirar: agotados, por acabarse, precios para revisar y productos parados), que abre una subvista (`/control/ayuda`) con, en este orden:
   - **Atención**: agotados, por acabarse y precios para revisar, con su cantidad. Cada uno abre su lista.
   - **Para comprar**: lista sugerida con costo total.
   - **Productos parados**.

Los avisos de *Atención* también llegan a Inicio (RN-AL-06).

Cada sección con poca información muestra un mensaje claro en lugar de quedar vacía: "Todavía no hay ventas esta semana", "Necesito al menos 2 semanas de ventas para saberlo".

## Reglas de negocio

### Base de los cálculos

| Id | Regla |
|---|---|
| **RN-AN-01** | Los cálculos consideran solo operaciones **no anuladas** y excluyen las anulaciones (RN-OP-17). Los días se cuentan en la zona horaria de la tienda. Un **día completo** es cualquier día anterior a hoy. |
| **RN-AN-02** | Para un periodo: **Ventas** = suma de importes de venta. **Costo de lo vendido** = suma de costo × cantidad de las ventas. **Ganancia bruta** = ventas − costo de lo vendido. **Pérdidas por merma** = suma de costo × cantidad de las mermas. **Ganancia neta** = ganancia bruta − pérdidas por merma. **Diferencias de conteo** = suma de costo × cantidad (con signo) de los ajustes, mostrada aparte y sin afectar la ganancia. Todo redondeado al céntimo por línea (RN-OP-12). |
| **RN-AN-03** | **Inicio** muestra dos cifras de **hoy**: *Total vendido* (lo cobrado) y, debajo, *Ganancia real* (la ganancia neta; con pérdida, *Pérdida real*). "Todavía no hay ventas hoy" se dice una sola vez, en el total. La Torre de control permite elegir el periodo: Hoy, Ayer, Últimos 7 días (incluye hoy) y Últimos 30 días (incluye hoy). |

### Predicción

| Id | Regla |
|---|---|
| **RN-AN-04** | **Venta promedio diaria (VPD)** de un producto: se miran los **28 días completos** anteriores a hoy. Son **días válidos** los que están desde el día del primer movimiento del producto, **sin contar** los días en que estuvo agotado todo el día (stock 0 al empezar, stock 0 al terminar y sin ventas). VPD = cantidad vendida en los días válidos ÷ número de días válidos. Si hay **menos de 7 días válidos**, el producto **no tiene predicción**. |
| **RN-AN-05** | **Días de cobertura** = stock ÷ VPD, redondeado **hacia abajo** a un entero. Se muestra "Se acaba en ~N días" (si N = 0: "Se acaba hoy"). Si la VPD es 0 se muestra "Sin ventas en las últimas 4 semanas". Sin predicción, o con stock 0 (el estado ya dice *Agotado*), no se muestra nada. |

### Lista para comprar

| Id | Regla |
|---|---|
| **RN-AN-06** | **Nivel objetivo**: con predicción, stock mínimo + VPD × días entre compras (configuración, valor inicial 7). Sin predicción, 2 × stock mínimo. **Cantidad sugerida** = nivel objetivo − stock, redondeada **hacia arriba** al incremento de su unidad (1 para unidades, 0.5 para kg y L), y **como mínimo un incremento**. |
| **RN-AN-07** | Un producto activo entra en **Para comprar** si su estado es `AGOTADO` o `POR_ACABARSE`, **o** si tiene predicción y no le alcanza hasta la próxima compra: stock − VPD × días entre compras < stock mínimo. Orden: agotados, luego por acabarse, luego el resto; dentro de cada grupo, menos días de cobertura primero (sin predicción al final del grupo) y luego por nombre. |
| **RN-AN-08** | Cada línea muestra la cantidad sugerida y su **costo estimado** (cantidad × precio de compra); la lista muestra el **total estimado**. El usuario puede cambiar cantidades o quitar productos; esos cambios se recuerdan hasta el final del día. Si el producto no existe o está archivado: "No encontramos ese producto". La lista se puede **compartir** como texto (WhatsApp u otra app) y se puede convertir en **"Registrar llegada"**, que abre *Llegó mercadería* con los productos y cantidades ya cargados (editables). |

Formato del texto compartido:

```
Lista de compras – <Nombre de la tienda> – 15/10/2026
• Lejía Tradicional 1 L: 12 unid.
• Carbón: 1.5 kg
Total estimado: S/ 32.93
```

### Observaciones

| Id | Regla |
|---|---|
| **RN-AN-09** | **Más vendidos** (periodo: 7 o 30 días, incluye hoy): dos listas de hasta 5 productos **con al menos una venta en el periodo**: por **veces vendido** (número de líneas de venta) y por **ganancia**. Empates: más ventas en soles primero, luego por nombre. Cada fila muestra también la cantidad vendida con su unidad. |
| **RN-AN-10** | **Precios para revisar**: productos activos con precio de venta ≤ precio de compra, con la pérdida por unidad. Orden: mayor pérdida primero. |
| **RN-AN-11** | **Productos parados**: productos activos con stock > 0, **sin ventas en los últimos 30 días** (incluye hoy) y cuyo primer movimiento fue **hace 30 días o más**. Muestran el **dinero inmovilizado** (stock × precio de compra) y el total. Orden: más dinero primero. Sugerencia fija: "Ponlo a la vista u ofrécelo con descuento". |
| **RN-AN-12** | **Semana contra semana**: compara los **últimos 7 días completos** con los **7 días anteriores** a esos, en ventas y ganancia neta. Cambio % = (actual − anterior) ÷ anterior × 100, redondeado al entero, mostrado como "▲ 12 % más" o "▼ 5 % menos". Si la semana anterior es 0: "Sin datos de la semana anterior". |
| **RN-AN-13** | **Mejor día de la semana**: promedio de ventas por día de la semana (lunes a domingo) en los **56 días completos** anteriores a hoy, contando solo desde el día de la primera operación de la tienda. Promedio = ventas de ese día de la semana ÷ cuántas veces ocurrió ese día en el rango (un día sin ventas cuenta como S/ 0). Requiere **al menos 14 días** de historia. Se marca el día con mayor promedio (empate: el primero de la semana). Si todos los promedios son S/ 0.00: "Todavía no hay ventas para saberlo". |
| **RN-AN-14** | **Tendencia del producto** (en el detalle del producto): cantidad vendida en cada uno de los **últimos 8 bloques de 7 días completos**, como gráfico de barras, junto con la VPD redondeada a un decimal ("Vendes ~2 unid. al día"; si es mayor que 0 pero menor que 0.05: "Vendes menos de 0.1 unid. al día", con la unidad del producto) y los días de cobertura. Con VPD 0 no se muestra la venta diaria: la cobertura ya dice "Sin ventas en las últimas 4 semanas". |
| **RN-AN-15** | Todos los cálculos se hacen **en el celular, sin internet**, a partir del libro de operaciones. |

### Antes de comprar

| Id | Regla |
|---|---|
| **RN-AN-16** | **"¿Necesito comprar?"**: al elegir un producto, la app responde con **una sola frase** según el primer caso que se cumpla: (1) si está **parado** (RN-AN-11): "No compres: no se vende hace N días y tienes X"; (2) si está en **Para comprar** (RN-AN-07): "Sí, compra ~N" con la cantidad de la lista de hoy (la sugerida o la que el usuario cambió, RN-AN-08) y su costo estimado; si el usuario lo quitó de la lista de hoy y su estado es `AGOTADO` o `POR_ACABARSE`, se responde igual con la cantidad sugerida (quitarlo solo lo saca de la lista: nunca se dice "No hace falta" de un producto agotado o por acabarse); si lo quitó y su estado es `NORMAL`, se sigue con el caso 3; (3) si tiene predicción: "No hace falta: te alcanza para ~N días"; (4) si no: "Tienes X. Todavía no sé cuánto vendes; vuelve a preguntar en unos días". Debajo se muestra el stock actual y la última vez que llegó mercadería de ese producto. Si el producto no existe o está archivado: "No encontramos ese producto". |

### Alquiler del local

| Id | Regla |
|---|---|
| **RN-AN-17** | **Costo del local** (configuración de la tienda, valor inicial: *sin configurar*). Se responde **"¿Pagas alquiler por tu local?"** con una de tres opciones: **Una vez al mes**, **Dos veces al mes** o **No pago (el local es mío)**. Si paga, se indica **cuánto paga cada vez** (mayor que S/ 0.00, con dos decimales como máximo y hasta S/ 99 999.99; el mismo monto en cada pago) y **qué día paga**: un día del 1 al 31, o **dos días distintos** si paga dos veces al mes. Se configura desde la tarjeta *Alquiler del local* de Control y desde *Ajustes → Datos de la tienda*. Los cambios valen desde ese momento para todos los cálculos (el avance se calcula del libro de operaciones; no hay historial que corregir). |
| **RN-AN-18** | **Fechas de pago**: en cada mes, la fecha de pago es el día elegido; si el mes no tiene ese día, es su **último día** (el 31 en febrero de 2027 es el 28/02/2027). El **último pago** es la fecha de pago más reciente **igual o anterior a hoy**; el **próximo pago** es la primera fecha de pago **posterior a hoy**. El **periodo actual** va desde el último pago (incluido) hasta hoy (incluido): el mismo día de pago empieza un periodo nuevo. |
| **RN-AN-19** | **Tarjeta *Alquiler del local*** (no depende del periodo elegido en el Resumen). **Llevas** = ganancia neta (RN-AN-02) del periodo actual. Si *llevas* es menor que el monto: "Para el pago del <próximo pago, DD/MM> llevas S/ X de S/ M", "Te falta S/ (M − X)" y una barra de avance de ⌊X ÷ M × 100⌋ % (entre 0 % y 100 %; con *llevas* negativo, 0 %). Si *llevas* es igual o mayor que el monto: "✓ Ya cubriste el local del <próximo pago, DD/MM>" y "Lo que ganes de más es tuyo: llevas S/ (X − M)", con la barra al 100 %. **Sin configurar**: la tarjeta pregunta "¿Pagas alquiler por tu local?" con el botón *Configurar*. **No pago**: la tarjeta no se muestra. |

Ejemplos de RN-AN-18 (pagos el 5 y el 20 de cada mes):

| Hoy | Último pago | Próximo pago | Periodo actual |
|---|---|---|---|
| 15/10/2026 | 05/10/2026 | 20/10/2026 | 05/10 – 15/10 |
| 20/10/2026 | 20/10/2026 | 05/11/2026 | 20/10 – 20/10 |
| 03/11/2026 | 20/10/2026 | 05/11/2026 | 20/10 – 03/11 |

Pago una vez al mes, el día 31: hoy 15/02/2027 → último pago 31/01/2027, próximo pago 28/02/2027.

## Ejemplos

Configuración: días entre compras = 7, días de anticipación = 3.

| Producto | Unidad | Mínimo | Stock | Vendido (días válidos) | VPD | Cobertura | Estado | ¿Para comprar? | Objetivo | Sugerido | Costo est. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Lejía 1 L | UNIDAD | 3 | 5 | 56 en 28 días | 2 | 2 días | Por acabarse | Sí (estado) | 3 + 14 = 17 | 12 unid. | 12 × S/ 2.40 = S/ 28.80 |
| Carbón | KILO | 3 | 7 | 21 en 28 días | 0.75 | 9 días | Bien | Sí (7 − 5.25 < 3) | 3 + 5.25 = 8.25 | 1.25 → **1.5 kg** | 1.5 × S/ 2.75 = S/ 4.13 (4.125 redondeado) |
| Jabón nuevo | UNIDAD | 3 | 2 | 4 en 5 días | — (menos de 7 días) | — | Por acabarse | Sí (estado) | 2 × 3 = 6 | 4 unid. | según precio |
| Bolsas | UNIDAD | 0 | 0 | — | — | — | Agotado | Sí (estado) | 0 | **1 unid.** (mínimo un incremento) | según precio |

## Modelo

- `ResumenDiario` (proyección, reconstruible): por producto y día: cantidad vendida, número de líneas vendidas, ventas, costo de lo vendido, costo de mermas, valor de ajustes, cambio neto de stock. Se actualiza en la misma transacción que cada operación y anulación, para que la Torre de control cargue rápido.
- `AlquilerDelLocal` (objeto de valor, en la configuración de la tienda): `null` (sin configurar) · `{ tipo: 'NO_PAGA' }` · `{ tipo: 'MENSUAL', montoCentimos, dias: [d] }` · `{ tipo: 'QUINCENAL', montoCentimos, dias: [d1, d2] }`, con los días ordenados de menor a mayor. Dinero en céntimos ([ADR-0003](../../adr/0003-enteros-para-dinero-y-cantidades.md)).
- Los cálculos (VPD, cobertura, sugerido, rankings, fechas de pago y avance del alquiler) son **funciones puras del dominio**, sin acceso a base de datos, probadas con datos de ejemplo compartidos ([ADR-0006](../../adr/0006-specs-ejecutables.md)).

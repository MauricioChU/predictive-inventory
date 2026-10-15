# Plan 05 — Módulo Inventario (RN-OP)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md) y [04-08-ola-2-comun.md](04-08-ola-2-comun.md) primero.

**Objetivo:** el libro de operaciones (venta, ingreso, merma, ajuste, stock inicial, anulación), existencias, carrito y vuelto, deshacer, revisar datos, conteo guiado y aviso de sobrecompra.

**Rama:** `feat/inventario` · **Spec:** [02-operaciones.md](../../specs/fase-1/02-operaciones.md), [features/operaciones.feature](../../specs/fase-1/features/operaciones.feature), [ADR-0002](../../adr/0002-libro-de-operaciones-inmutable.md), [ADR-0004](../../adr/0004-costo-vigente-al-vender.md).

**Consume (perezosos):** `CatalogoConsultable` (datos y `actualizarPrecioCompra`), `AnalisisConsultable['situacion']` (sobrecompra), `TiendaConsultable` (configuración y `dispositivoId`), `ProyeccionDeOperaciones[]` (resúmenes de Análisis).

## Archivos

```
src/modules/inventario/
├─ domain/
│  ├─ operacion.ts           agregado Operacion (inmutable) + fábricas por tipo
│  ├─ reglas.ts              validarCantidad, validarFecha, validarStock, fusionarLineas
│  ├─ carrito.ts             Carrito (puro, lo usa la UI)
│  ├─ vuelto.ts              calcularVuelto, BILLETES_RAPIDOS
│  ├─ mensajes.ts            mensajeStockInsuficiente, mensajeCambioDePrecio, mensajesDeSobrecompra, …
│  ├─ conteo-guiado.ts       ConteoGuiado (sobre ConteoGuiadoRegistro)
│  └─ etiquetas.ts           etiqueta en pantalla por tipo de operación
├─ application/
│  ├─ puertos.ts
│  ├─ registrar.ts           registro común: validar stock, guardar, existencias, proyecciones, eventos
│  ├─ ventas.ts  ingresos.ts  mermas-y-ajustes.ts  anulaciones.ts
│  ├─ deshacer.ts            ServicioDeDeshacer
│  ├─ historial.ts  revisar-datos.ts  conteo.ts
│  └─ modulo.ts              crearModuloInventario
├─ infrastructure/memoria/repositorios.ts
└─ index.ts
```

## Interfaces que produce

```ts
// application/puertos.ts
export interface RepositorioDeOperaciones {
  agregar(r: OperacionRegistro): Promise<void>
  porId(id: string): Promise<OperacionRegistro | null>
  anulacionDe(operacionId: string): Promise<OperacionRegistro | null>
  porProducto(productoId: string): Promise<OperacionRegistro[]>
  todas(): Promise<OperacionRegistro[]>
}
export interface RepositorioDeExistencias {
  obtener(productoId: string): Promise<Cantidad>        // 0 si no hay registro
  fijar(productoId: string, cantidad: Cantidad): Promise<void>
  todas(): Promise<Map<string, Cantidad>>
  reemplazarTodas(existencias: Map<string, Cantidad>): Promise<void>
}
export interface RepositorioDeConteo {
  obtener(): Promise<ConteoGuiadoRegistro | null>
  guardar(r: ConteoGuiadoRegistro): Promise<void>
}

// application/modulo.ts
export interface DependenciasDeInventario {
  operaciones: RepositorioDeOperaciones
  existencias: RepositorioDeExistencias
  conteo: RepositorioDeConteo
  uow: UnidadDeTrabajo
  reloj: Reloj
  ids: GeneradorDeIds
  bus: BusDeEventos
  catalogo: () => CatalogoConsultable
  analisis: () => Pick<AnalisisConsultable, 'situacion'>
  tienda: () => TiendaConsultable
  proyecciones: () => ProyeccionDeOperaciones[]
}

export interface LineaPedida { productoId: string; cantidad: string }
export interface DatosDeVenta { lineas: (LineaPedida & { precioEspecial?: string })[]; ocurridaEn?: Instante; nota?: string }
export interface DatosDeIngreso {
  lineas: (LineaPedida & { costo: string })[]
  ocurridaEn?: Instante
  confirmarSobrecompra?: boolean
  /** undefined = aún no se preguntó; true/false = respuesta del usuario (RN-OP-14). */
  actualizarPreciosDeCompra?: boolean
}
export type RespuestaDeIngreso =
  | { tipo: 'hecho'; operacionId: string }
  | { tipo: 'aviso-sobrecompra'; avisos: { productoId: string; mensaje: string }[] }
  | { tipo: 'confirmar-precios'; cambios: { productoId: string; mensaje: string }[] }
export type RespuestaDeConteo =
  | { tipo: 'sin-cambios'; mensaje: 'El stock ya estaba correcto' }
  | { tipo: 'ajustado'; operacionId: string; diferencia: Cantidad }

export interface LineaDeOperacionVista {
  productoId: string; nombre: string; unidad: Unidad; cantidad: Cantidad
  precioUnitario: Dinero | null; costoUnitario: Dinero; importe: Dinero | null; ganancia: Dinero | null
}
export interface OperacionVista {
  id: string; tipo: TipoDeOperacion; etiqueta: string; ocurridaEn: Instante
  lineas: LineaDeOperacionVista[]; total: Dinero | null; ganancia: Dinero | null
  anulada: boolean; anulaA: string | null; motivo: string | null; nota: string | null
}
export interface EstadoDelConteo {
  producto: { id: string; nombre: string; unidad: Unidad; stock: Cantidad; tieneFoto: boolean } | null
  progreso: string            // "Llevas 1 de 3"
  terminado: boolean
  resumen: string[] | null    // solo al terminar
}

export interface ModuloInventario {
  registrarVenta(d: DatosDeVenta): Promise<{ operacionId: string }>
  registrarIngreso(d: DatosDeIngreso): Promise<RespuestaDeIngreso>
  registrarMerma(d: { productoId: string; cantidad: string; motivo: string; nota?: string; ocurridaEn?: Instante }): Promise<{ operacionId: string }>
  contarStock(d: { productoId: string; contado: string }): Promise<RespuestaDeConteo>
  anularOperacion(d: { operacionId: string; motivo?: string }): Promise<{ anulacionId: string }>
  deshacer: ServicioDeDeshacer
  historial(filtro?: { productoId?: string; tipo?: TipoDeOperacion }): Promise<OperacionVista[]>
  revisarDatos(): Promise<{ mensaje: string; corregidos: { productoId: string; antes: Cantidad; despues: Cantidad }[] }>
  reconstruirExistencias(): Promise<void>
  iniciarConteoGuiado(): Promise<EstadoDelConteo>
  conteoActual(): Promise<EstadoDelConteo | null>
  responderConteo(contado: string): Promise<EstadoDelConteo>
  saltarEnConteo(): Promise<EstadoDelConteo>
  consultable: InventarioParaCatalogo
}
export function crearModuloInventario(d: DependenciasDeInventario): ModuloInventario

// application/deshacer.ts
export class ServicioDeDeshacer {
  /** Llamado por cada registro de operación (no por anulaciones). */
  ofrecer(operacionId: string, registradaEn: Instante): void
  /** null si pasaron 10 segundos o más, o si ya se usó. */
  disponible(): { operacionId: string; segundosRestantes: number } | null
  deshacer(): Promise<void>       // anula sin pedir motivo (RN-OP-18)
}
export const SEGUNDOS_PARA_DESHACER = 10
export const OPCIONES_DE_SOBRECOMPRA = ['Registrar igual', 'Cambiar cantidad'] as const

// domain/carrito.ts
export interface ProductoEnCarrito { id: string; nombre: string; unidad: Unidad; precioVenta: Dinero }
export class Carrito {
  agregar(producto: ProductoEnCarrito, cantidad: Cantidad): void      // fusiona (RN-OP-07)
  cambiarCantidad(productoId: string, cantidad: Cantidad): void
  cambiarPrecio(productoId: string, precio: Dinero | null): void      // null = precio normal
  quitar(productoId: string): void
  vaciar(): void
  get lineas(): readonly { producto: ProductoEnCarrito; cantidad: Cantidad; precio: Dinero; importe: Dinero }[]
  total(): Dinero
  aDatosDeVenta(): DatosDeVenta
}

// domain/vuelto.ts
export const BILLETES_RAPIDOS: readonly number[]   // [1000, 2000, 5000, 10000] céntimos
export function calcularVuelto(total: Dinero, pagado: string): { puedeConfirmar: boolean; mensaje: string; vuelto: Dinero | null }
```

## Reglas y mensajes exactos

| Regla | Comportamiento | Mensaje |
|---|---|---|
| RN-OP-03 | cantidad ≤ 0 | `La cantidad debe ser mayor que 0` |
| RN-OP-03 | cantidad > 99 999 | `La cantidad no puede pasar de 99 999` |
| RN-OP-04 | precisión | los de `Cantidad.deTexto` (se lee con la unidad del producto) |
| RN-OP-05 | stock resultante < 0 (primer producto que falla, en orden de líneas) | `Solo quedan 10 unid. de Lejía 1 L` · `Solo queda 1 kg de Detergente a granel` · stock 0: `Ya no queda Lejía 1 L` |
| RN-OP-06 | cualquier error | no se guarda nada (UoW) |
| RN-OP-07 | líneas repetidas | se suman en una sola antes de validar |
| RN-OP-08 | producto archivado | `Escoba está archivado. Reactívalo para usarlo` |
| — | producto inexistente | `No encontramos ese producto` |
| RN-OP-09 | `ocurridaEn` > ahora | `La fecha no puede ser futura` |
| RN-OP-09 | `ocurridaEn` < `inicioDelDia(hoy − 7)` | `Solo puedes anotar hasta 7 días atrás` |
| RN-OP-10/12 | por línea: importe = `precio.multiplicarPor(cant)`, costo total = `costo.multiplicarPor(cant)`, ganancia = importe − costo total | — |
| RN-OP-11 | precio especial ≤ 0 | `El precio de venta debe ser mayor que S/ 0.00` |
| RN-OP-13 | pagado < total | `Faltan S/ 4.63`, `puedeConfirmar: false` |
| RN-OP-13 | pagado ≥ total | `Vuelto S/ 5.37` |
| RN-OP-14 | costo ≠ precio de compra, `actualizarPreciosDeCompra === undefined` | `¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad` (pérdida: `Perderás S/ X por unidad`; igual a venta: `No ganarás nada por unidad`; KILO/LITRO: `por kilo` / `por litro`) |
| RN-OP-15 | motivo vacío | `Elige qué pasó con el producto` |
| RN-OP-15 | motivo `Otro` sin nota | `Cuéntanos qué pasó` |
| RN-OP-15 | motivo fuera de `MOTIVOS_DE_MERMA` | `Elige qué pasó con el producto` |
| RN-OP-16 | contado < 0 | `La cantidad contada no puede ser negativa` |
| RN-OP-16 | diferencia 0 | `{ tipo: 'sin-cambios', mensaje: 'El stock ya estaba correcto' }`, no se registra nada |
| RN-OP-17 | anular una ANULACION | `Una anulación no se puede anular. Registra la operación de nuevo` |
| RN-OP-17 | ya anulada | `Esta operación ya fue anulada` |
| RN-OP-17 | operación inexistente | `No encontramos esa operación` |
| RN-OP-19 | sin diferencias | mensaje `Todo está en orden` |
| RN-OP-19 | con diferencias | `Corregimos el stock de 1 producto: Carbón (7 kg → 10 kg)` (varios: `de 2 productos: A (…), B (…)`) |
| RN-OP-20 | ver sección | — |
| RN-OP-21 | ver sección | — |

Costos guardados por movimiento: `STOCK_INICIAL` = el costo recibido; `INGRESO` = costo de la línea; `VENTA`, `MERMA`, `AJUSTE` = `precioCompra` vigente del producto; `ANULACION` = el de la línea original. Motivos guardados: merma = el elegido; conteo = `MOTIVO_CONTEO`; retiro = `MOTIVO_PRODUCTO_RETIRADO`.

**Registro común** (`application/registrar.ts`), dentro de **una** UoW: leer existencias de los productos → `validarStock` → `operaciones.agregar` → `existencias.fijar` por producto → `for (p of proyecciones()) p.alRegistrar(registro)` (anulación: `p.alAnular(original, anulacion)`). Después de la UoW: publicar `OperacionRegistrada` / `OperacionAnulada` y, para registros (no anulaciones), `deshacer.ofrecer(id, registradaEn)`.

**Sobrecompra (RN-OP-20)**, antes de registrar un ingreso si `confirmarSobrecompra` no es `true`. Por cada línea, con `s = analisis().situacion(productoId)` (estado previo al ingreso) y `limite = tienda().configuracion().diasMaximosDeCompra`:
1. Si `s.parado`: `` `${nombre} no se vende hace ${s.parado.diasSinVender} días y aún tienes ${formatearCantidad(s.stock)}` ``
2. Si no, y `s.prediccion` con `vendido > 0`: `dias = floor((stock + cantidad)_m × diasValidos / vendido_m)`; si `dias > limite`: `` `Con esto tendrías ${nombre} para ~${dias} días. ` `` + (`s.enListaParaComprar && s.cantidadSugerida` ? `` `Te sugerimos ~${formatearCantidad(sugerida)}` `` : `Ahora no necesitabas comprar.`).

Sin punto final agregado después de una cantidad: el punto de `4 unid.` / `~7 unid.` en el `.feature` es el de la abreviatura (con kg: `… aún tienes 2 kg`, `Te sugerimos ~1.5 kg`).

Ejemplos (de `operaciones.feature`): Lejía stock 10, VPD 2 (56 en 28 días), compra 110 → `Con esto tendrías Lejía 1 L para ~60 días. Te sugerimos ~7 unid.` · Carbón stock 10, VPD 0.25, compra 5 → `Con esto tendrías Carbón para ~60 días. Ahora no necesitabas comprar.` · Lejía compra 20 → sin aviso (15 días).

**Conteo guiado (RN-OP-21):** orden = productos activos ordenados por `normalizar(categoriaNombre)` y luego `normalizar(nombre)`. `responderConteo` aplica `contarStock` **al momento** y guarda `{ diferencia, valor = costo × diferencia }`. Progreso: `` `Llevas ${posicion} de ${total}` ``. Al terminar, resumen: `Contaste 2 productos. 1 con diferencia: -S/ 4.80` (sin diferencias: `Contaste 2 productos. Todo cuadraba.`; singular `1 producto`) y, si hubo saltados, `Te faltó contar 1: Detergente a granel` (varios: nombres separados por `, `). Productos archivados durante el conteo se saltan solos.

---

### Tarea 1: `Operacion` y reglas de dominio

**Archivos:** `domain/operacion.ts`, `domain/reglas.ts`, `domain/mensajes.ts`, `domain/etiquetas.ts` + specs.

Fábricas: `Operacion.venta`, `.ingreso`, `.merma`, `.ajuste`, `.stockInicial`, `.anulacionDe(original, …)`, más `desdeRegistro`/`aRegistro`, `lineas()` con importe/costo total/ganancia, `total()`, `ganancia()`. Etiquetas en pantalla: `STOCK_INICIAL` → `Stock inicial`, `INGRESO` → `Llegó mercadería`, `VENTA` → `Venta`, `MERMA` → el motivo (p. ej. `Se derramó`), `AJUSTE` → `Conteo de stock` o `Producto retirado`, `ANULACION` → `Anulado`.

Tests: RN-OP-03, RN-OP-04 (esquemas completos del feature), RN-OP-09 (cinco fechas del esquema con ahora `2026-10-15 10:00`), RN-OP-10/12 (venta de tres líneas: importes 7.00 / 5.00 / 2.63, ganancias 2.20 / 1.56 / 0.87, total 14.63, ganancia 4.63), RN-OP-11 (precio especial 3.00 → total 6.00, ganancia 1.20), RN-OP-15 (cuatro filas del esquema de motivo), RN-OP-17 (anulación invierte signos; anular una anulación falla), `validarStock` (mensajes de 10 unid., 1 kg, 0), `fusionarLineas` (RN-OP-07).

- [ ] Rojo → verde → commit `feat(inventario): operaciones inmutables y reglas RN-OP`.

### Tarea 2: Carrito y vuelto

**Archivos:** `domain/carrito.ts`, `domain/vuelto.ts` + specs.

Tests: RN-OP-07 (agregar 1 y luego 2 → una línea de 3), cambiar precio solo en la línea, total de la venta de tres líneas = S/ 14.63, RN-OP-13 (pagos 20.00 / 14.63 / 10.00 → `Vuelto S/ 5.37` / `Vuelto S/ 0.00` / `Faltan S/ 4.63`), `aDatosDeVenta` incluye `precioEspecial` solo si cambió.

- [ ] Rojo → verde → commit `feat(inventario): carrito con total y calculadora de vuelto`.

### Tarea 3: Repositorios en memoria y registro común

**Archivos:** `infrastructure/memoria/repositorios.ts`, `application/puertos.ts`, `application/registrar.ts` + specs.

Tests: existencias por defecto 0; `anulacionDe`; RN-OP-06 (si una proyección lanza en `alRegistrar`, ni la operación ni las existencias quedan guardadas); los eventos se publican solo tras confirmar; las proyecciones reciben el registro exacto.

- [ ] Rojo → verde → commit `feat(inventario): registro atómico de operaciones con proyecciones`.

### Tarea 4: Ventas, ingresos (con precios y sobrecompra), mermas, ajustes, stock inicial y retiro

**Archivos:** `application/ventas.ts`, `ingresos.ts`, `mermas-y-ajustes.ts`, `modulo.ts` (parcial) + specs.

Dobles: catálogo en memoria simple (mapa de `ProductoResumido` con `actualizarPrecioCompra` que registra la llamada), análisis falso con `situacion` configurable, tienda falsa con configuración inicial y `dispositivoId: 'disp-1'`, proyección espía.

Tests (datos del `Antecedentes` de `operaciones.feature`: Lejía 1 L UNIDAD 2.40/3.50 stock 10, Carbón KILO 2.75/4.00 stock 10, Detergente a granel KILO 5.30/7.90 stock 5):
- RN-OP-01: venta 3 + ingreso 6 → stock 13; historial `STOCK_INICIAL, VENTA, INGRESO`; existencia = suma de movimientos.
- RN-OP-05/06: vender 11 → error exacto; venta de dos líneas con Carbón 20 → error `Solo quedan 10 kg de Carbón` y Lejía sigue en 10.
- RN-OP-08: ingreso de producto archivado → error exacto.
- RN-OP-14: ingreso costo 2.60 → `confirmar-precios` con el mensaje exacto; con `true` → stock 22 y `actualizarPrecioCompra(S/ 2.60)`; con `false` → stock 22 y sin llamada.
- RN-OP-15: merma 2 "Se derramó" → stock 8; el movimiento guarda costo 2.40.
- RN-OP-16: contar 8 → AJUSTE −2 con motivo `Conteo de stock`; contar 10 → `sin-cambios`.
- RN-OP-20: los tres ejemplos de arriba, más "parado" (`Escoba no se vende hace 45 días y aún tienes 4 unid.`), y con `confirmarSobrecompra: true` → se registra (stock 120).
- Stock inicial y `retirarStock` (AJUSTE −stock con motivo `Producto retirado`; con stock 0 no registra nada).

- [ ] Rojo → verde → commit `feat(inventario): ventas, ingresos, mermas, conteos y aviso de sobrecompra`.

### Tarea 5: Anulaciones, deshacer, historial, revisar datos y conteo guiado

**Archivos:** `application/anulaciones.ts`, `deshacer.ts`, `historial.ts`, `revisar-datos.ts`, `conteo.ts`, `domain/conteo-guiado.ts`, `modulo.ts` (completo), `index.ts` + specs.

Tests:
- RN-OP-02/17: anular venta → stock 10, historial `STOCK_INICIAL, VENTA, ANULACION`, la venta aparece `anulada: true`; anular dos veces → error; anular la anulación → error; anular un ingreso ya vendido (Detergente: +3, vender 7, anular ingreso) → `Solo queda 1 kg de Detergente a granel`. La proyección recibe `alAnular(original, anulacion)`.
- RN-OP-18 (con `RelojFijo`): a los 5 s `disponible()` no es null y `deshacer()` deja el stock en 10; a los 11 s es null; tras usarlo, null.
- RN-OP-19: alterar la existencia de Carbón a 7 en el repositorio → `revisarDatos()` la deja en 10 y devuelve el mensaje exacto; sin cambios → `Todo está en orden`. `revisarDatos` también llama `reconstruir(todas)` en cada proyección.
- RN-OP-21: recorrido Carbón → Detergente (saltar) → Lejía (contar 8) con el resumen exacto; interrumpir tras el primero y `conteoActual()` sigue en Detergente con `Llevas 1 de 3`.
- `historial` ordena de más reciente a más antiguo y marca anuladas.
- `consultable`: `stockDe`, `existencias`, `tieneOperaciones`, `ultimoIngresoDe` (ignora ingresos anulados), `operaciones`, `registrarStockInicial`, `retirarStock`.

- [ ] Rojo → verde → verificación final de la rama → commit `feat(inventario): anulaciones, deshacer, revisión de datos y conteo guiado`.

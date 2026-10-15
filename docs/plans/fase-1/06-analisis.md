# Plan 06 — Módulo Análisis: Torre de control (RN-AN)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md) y [04-08-ola-2-comun.md](04-08-ola-2-comun.md) primero.

**Objetivo:** la proyección `ResumenDiario` y todos los cálculos de la Torre de control como **funciones puras**, más los casos de uso de consulta y la lista para comprar editable.

**Rama:** `feat/analisis` · **Spec:** [04-torre-de-control.md](../../specs/fase-1/04-torre-de-control.md), [03-alertas.md](../../specs/fase-1/03-alertas.md) (tabla de estados), [features/torre-de-control.feature](../../specs/fase-1/features/torre-de-control.feature).

**Consume (perezosos):** `CatalogoConsultable` (productos), `InventarioConsultable` (existencias, último ingreso), `TiendaConsultable` (configuración). **Implementa:** `ProyeccionDeOperaciones`, `AnalisisConsultable`.

> El **estado de stock** (Agotado / Por acabarse / Bien) se calcula aquí porque depende de la predicción; Alertas solo decide cuándo avisar.

## Archivos

```
src/modules/analisis/
├─ domain/
│  ├─ resumen-diario.ts      ResumenDiario (VO) + aplicarOperacion / revertirOperacion sobre registros
│  ├─ prediccion.ts          calcularPrediccion, diasDeCobertura, textoCobertura, textoVentaDiaria
│  ├─ estado.ts              estadoDeStock
│  ├─ compras.ts             cantidadSugerida, entraEnLista, ordenarLista, textoParaCompartir
│  ├─ periodos.ts            rangoDePeriodo, resumenDePeriodo
│  ├─ observaciones.ts       masVendidos, preciosParaRevisar, productosParados, semanaContraSemana, mejorDiaDeLaSemana, tendencia
│  └─ necesito-comprar.ts    respuestaNecesitoComprar
├─ application/
│  ├─ puertos.ts
│  ├─ proyeccion.ts          ProyeccionDeResumenes implements ProyeccionDeOperaciones
│  ├─ situaciones.ts         situacion / situaciones (carga en lote)
│  ├─ torre.ts               consultarTorre, consultarResumen
│  ├─ lista-de-compras.ts    lista editable del día, compartir, convertir en llegada
│  ├─ producto.ts            detalleDeProducto, necesitoComprar
│  └─ modulo.ts              crearModuloAnalisis
├─ infrastructure/memoria/repositorios.ts
└─ index.ts
```

## Interfaces que produce

```ts
// application/puertos.ts
export interface RepositorioDeResumenes {
  obtener(productoId: string, dia: Dia): Promise<ResumenDiarioRegistro | null>
  guardar(r: ResumenDiarioRegistro): Promise<void>
  entre(desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]>              // inclusive
  primerDiaDe(productoId: string): Promise<Dia | null>
  primerDiaDeLaTienda(): Promise<Dia | null>
  vaciar(): Promise<void>
}
export interface RepositorioDeListaDeCompras {
  delDia(dia: Dia): Promise<ListaDeComprasRegistro | null>
  guardar(r: ListaDeComprasRegistro): Promise<void>
}

// application/modulo.ts
export interface DependenciasDeAnalisis {
  resumenes: RepositorioDeResumenes
  listaDeCompras: RepositorioDeListaDeCompras
  uow: UnidadDeTrabajo
  reloj: Reloj
  catalogo: () => CatalogoConsultable
  inventario: () => InventarioConsultable
  tienda: () => TiendaConsultable
}

export type Periodo = 'HOY' | 'AYER' | '7_DIAS' | '30_DIAS'
export interface ResumenDePeriodo {
  ventas: Dinero; costoVendido: Dinero; gananciaBruta: Dinero; mermas: Dinero; gananciaNeta: Dinero; diferenciasDeConteo: Dinero
}
export interface LineaParaComprar {
  productoId: string; nombre: string; unidad: Unidad; estado: EstadoDeStock
  diasDeCobertura: number | null; cantidad: Cantidad; costoEstimado: Dinero
}
export interface ListaParaComprar { lineas: LineaParaComprar[]; total: Dinero }
export interface FilaMasVendido { productoId: string; nombre: string; unidad: Unidad; veces: number; cantidad: Cantidad; ventas: Dinero; ganancia: Dinero }
export interface ProductoParado { productoId: string; nombre: string; unidad: Unidad; stock: Cantidad; diasSinVender: number; dineroInmovilizado: Dinero }
export interface PrecioParaRevisar { productoId: string; nombre: string; perdidaPorUnidad: Dinero }
export interface FilaComparacion { concepto: 'Ventas' | 'Ganancia neta'; actual: Dinero; anterior: Dinero; cambio: string }
export type ComparacionSemanal = { tipo: 'sin-datos'; mensaje: 'Sin datos de la semana anterior' } | { tipo: 'comparacion'; filas: FilaComparacion[] }
export type MejorDia =
  | { tipo: 'insuficiente'; mensaje: 'Necesito al menos 2 semanas de ventas para saberlo' }
  | { tipo: 'calculado'; promedios: { dia: NombreDeDia; promedio: Dinero }[]; mejor: NombreDeDia }
export type NombreDeDia = 'lunes' | 'martes' | 'miércoles' | 'jueves' | 'viernes' | 'sábado' | 'domingo'

export interface TorreDeControl {
  resumen: ResumenDePeriodo
  atencion: { agotados: number; porAcabarse: number; preciosParaRevisar: number }
  paraComprar: ListaParaComprar
  masVendidos: { porVeces: FilaMasVendido[]; porGanancia: FilaMasVendido[] }
  semana: ComparacionSemanal
  mejorDia: MejorDia
  parados: { productos: ProductoParado[]; total: Dinero }
  preciosParaRevisar: PrecioParaRevisar[]
}
export interface DetalleDeProducto {
  situacion: SituacionDeProducto
  textoCobertura: string | null          // RN-AN-05
  textoVentaDiaria: string | null        // "Vendes ~2 unid. al día"
  tendencia: Cantidad[]                  // 8 valores, del más antiguo al más reciente (RN-AN-14)
}

export interface ModuloAnalisis {
  proyeccion: ProyeccionDeOperaciones
  consultable: AnalisisConsultable
  consultarResumen(periodo: Periodo): Promise<ResumenDePeriodo>
  consultarTorre(opciones?: { periodo?: Periodo; periodoMasVendidos?: 7 | 30 }): Promise<TorreDeControl>
  listaParaComprar(): Promise<ListaParaComprar>
  cambiarCantidadEnLista(productoId: string, cantidad: string): Promise<void>
  quitarDeLista(productoId: string): Promise<void>
  textoParaCompartir(): Promise<string>
  lineasParaRegistrarLlegada(): Promise<{ productoId: string; cantidad: Cantidad; costo: Dinero }[]>
  necesitoComprar(productoId: string): Promise<{ respuesta: string; stock: Cantidad; unidad: Unidad; ultimoIngreso: Instante | null }>
  detalleDeProducto(productoId: string): Promise<DetalleDeProducto | null>
}
export function crearModuloAnalisis(d: DependenciasDeAnalisis): ModuloAnalisis
```

## Definiciones exactas

**Proyección (por movimiento `m` de la operación `op`, día `d = diaDe(op.ocurridaEn)`):** fila `(m.productoId, d)` (crear en ceros si no existe; `clave = ${productoId}|${dia}`):
- siempre: `cambioNeto += m.cantidad`
- `VENTA`: `lineasVendidas += 1`; `cantidadVendida += |cant|`; `ventas += precio×|cant|`; `costoVendido += costo×|cant|` (cada producto redondeado al céntimo con `Dinero.multiplicarPor`)
- `MERMA`: `costoMermas += costo×|cant|`
- `AJUSTE`: `valorAjustes += costo×cant` (con signo)
- `STOCK_INICIAL`, `INGRESO`: solo `cambioNeto`

`alAnular(original, anulacion)`: resta de la fila del **día de la original** todo lo que la original sumó **excepto `cambioNeto`**; suma `cambioNeto` de los movimientos de la anulación en el **día de la anulación**. `reconstruir(ops)`: `vaciar()`, luego recorrer por `registradaEn` ascendente: `ANULACION` → `alAnular(original, op)`; el resto → `alRegistrar(op)`.

**Predicción (RN-AN-04)** para un producto, con `hoy`, `stock` actual y sus filas:
```
hasta = hoy − 1; inicioVentana = hoy − 28
primer = primerDiaDe(producto); si primer es null o primer > hasta → sin predicción
desde = max(inicioVentana, primer)
stockFin = stock − Σ cambioNeto(días ≥ hoy)          // stock al terminar "hasta"
para d = hasta … desde (hacia atrás):
  stockInicio = stockFin − cambioNeto(d)
  válido salvo (stockInicio == 0 && stockFin == 0 && cantidadVendida(d) == 0)
  stockFin = stockInicio
diasValidos = cantidad de días válidos; vendido = Σ cantidadVendida en días válidos
si diasValidos < 7 → sin predicción; si no → { vendido, diasValidos }
```
**Cobertura (RN-AN-05):** `vendido == 0` → null; si no `floor(stock_m × diasValidos / vendido_m)`. `textoCobertura`: sin predicción → null; `vendido == 0` → `Sin ventas en las últimas 4 semanas`; 0 → `Se acaba hoy`; 1 → `Se acaba en ~1 día`; n → `Se acaba en ~n días`. `textoVentaDiaria`: `Vendes ~X <unidad> al día` con X = VPD redondeada a 1 decimal (`formatearCantidad`); sin predicción → null.

**Estado:** `stock ≤ 0` → `AGOTADO`; `stock ≤ mínimo` o (`cobertura ≠ null` y `cobertura ≤ diasAnticipacion`) → `POR_ACABARSE`; si no `NORMAL`.

**Cantidad sugerida (RN-AN-06)** con `inc = Cantidad.incrementoDe(unidad)`, `f = diasEntreCompras`, todo en milésimas enteras:
```
con predicción (v = vendido_m, n = diasValidos):  faltante·n = (min_m·n + v·f) − stock_m·n
sin predicción (n = 1):                            faltante   = 2·min_m − stock_m
sugerido = faltante·n ≤ 0 ? inc : ceil(faltante·n / (n · inc_m)) · inc_m       // nunca menos que un incremento
```
**Entra en la lista (RN-AN-07):** `estado ≠ NORMAL` **o** (con predicción y `stock_m·n − v·f < min_m·n`). **Orden:** AGOTADO, POR_ACABARSE, NORMAL; dentro: cobertura ascendente con `null` al final; luego `nombre` (`localeCompare 'es'`). **Costo estimado** = `precioCompra.multiplicarPor(sugerido)`; total = suma.

**Lista editable (RN-AN-08):** los cambios del día (`ListaDeComprasRegistro` con `dia = hoy`) reemplazan la cantidad (`cantidad` en milésimas) o quitan (`null`). Otro día → sin cambios. `cambiarCantidadEnLista` valida con `Cantidad.deTexto(texto, unidad)` y > 0. **Texto compartido:**
```
Lista de compras – <nombreTienda> – DD/MM/AAAA
• <nombre>: <cantidad con unidad>
Total estimado: S/ X.XX
```
(sin nombre de tienda: `Lista de compras – DD/MM/AAAA`; separadores: guion largo `–` y viñeta `•`).

**Periodos (RN-AN-03):** HOY `[hoy, hoy]`, AYER `[hoy−1, hoy−1]`, 7_DIAS `[hoy−6, hoy]`, 30_DIAS `[hoy−29, hoy]`. `resumenDePeriodo` suma filas de todos los productos (RN-AN-02): neta = bruta − mermas; diferencias = Σ `valorAjustes`.

**Más vendidos (RN-AN-09):** periodo 7 → `[hoy−6, hoy]`, 30 → `[hoy−29, hoy]`; solo productos con `veces > 0`; `porVeces`: veces desc, ventas desc, nombre; `porGanancia`: ganancia desc, ventas desc, nombre; máximo 5 cada una.

**Precios para revisar (RN-AN-10):** activos con `venta ≤ compra`; `perdidaPorUnidad = compra − venta`; orden pérdida desc.

**Parados (RN-AN-11):** activos, stock > 0, sin `lineasVendidas` en `[hoy−29, hoy]`, `primerDiaDe ≤ hoy − 30`. `diasSinVender = hoy − (último día con venta, o primer día si nunca vendió)`. `dineroInmovilizado = precioCompra × stock`; orden desc; total.

**Semana contra semana (RN-AN-12):** actual `[hoy−7, hoy−1]`, anterior `[hoy−14, hoy−8]`. Si las ventas anteriores son 0 → `sin-datos`. Por fila: `p = redondearMitadLejosDeCero((actual − anterior)·100, |anterior|)`; texto `▲ p % más` (p > 0), `▼ |p| % menos` (p < 0), `= igual` (p = 0); si `anterior` de esa fila es 0 → `Sin datos de la semana anterior`.

**Mejor día (RN-AN-13):** `primerDiaDeLaTienda` null o `hoy − primer < 14` → `insuficiente`. Rango `[max(hoy−56, primer), hoy−1]`; por día de la semana: `promedio = redondearMitadLejosDeCero(Σ ventas_céntimos, ocurrencias)`; mejor = mayor promedio, empate → el primero de la semana.

**Tendencia (RN-AN-14):** bloque `k = 0…7` (0 = más antiguo) = `[hoy − 7·(8−k), hoy − 7·(8−k) + 6]`; valor = Σ `cantidadVendida`.

**¿Necesito comprar? (RN-AN-16)**, primer caso que aplique:
1. parado → `No compres: no se vende hace N días y tienes <stock>`
2. en lista → `Sí, compra ~<sugerido> (<costo estimado>)`
3. con predicción y `vendido > 0` → `No hace falta: te alcanza para ~N días` (N = cobertura; 1 → `~1 día`)
4. con predicción y `vendido == 0` → `No hace falta: no vendiste en las últimas 4 semanas`
5. sin predicción → `Tienes <stock>. Todavía no sé cuánto vendes; vuelve a preguntar en unos días`

Ninguna plantilla agrega punto final: el punto de `… y tienes 4 unid.` en el `.feature` es el de la abreviatura `unid.` (con kg queda `… y tienes 2 kg`).

**AnalisisConsultable:** `situacion(id)` / `situaciones()` (solo activos) arman `SituacionDeProducto` con todo lo anterior; `vecesVendido(desde, hasta)`; `totalesDelDia(dia)`; `resumenesDeTienda(desde, hasta)` (solo días con ventas, mermas o ajustes ≠ 0).

**Rendimiento (RN-SIS-09):** `situaciones()` hace **una** lectura `entre(hoy − 60, hoy)` y agrupa por producto en memoria; `primerDiaDe` por producto (índice compuesto en Dexie, Ola 3).

---

### Tarea 1: Proyección `ResumenDiario`

**Archivos:** `domain/resumen-diario.ts`, `application/puertos.ts`, `application/proyeccion.ts`, `infrastructure/memoria/repositorios.ts` + specs.

Tests: venta de tres líneas suma bien por producto y día (ventas 7.00/5.00/2.63, costo 4.80/3.44/1.76); merma suma `costoMermas`; ajuste −1 de Lejía → `valorAjustes = −240`; `alAnular` de una venta de hoy deja métricas en 0 y `cambioNeto` neto 0; anulación de una venta de ayer hecha hoy: métricas de ayer en 0, `cambioNeto` −2 ayer y +2 hoy; `reconstruir` produce lo mismo que aplicar uno por uno; operación con fecha pasada (RN-OP-09) cae en su día.

- [ ] Rojo → verde → commit `feat(analisis): proyección de resúmenes diarios por producto`.

### Tarea 2: Predicción, cobertura, estado y cantidad sugerida

**Archivos:** `domain/prediccion.ts`, `domain/estado.ts`, `domain/compras.ts` + specs. Incluir un **constructor de historiales de prueba** en `domain/__pruebas__/historial.ts` (`historial().primerMovimiento('2026-08-01').vendio(56, '2026-09-17', '2026-10-14').agotadoDias(8, …)`), que los specs reutilizan.

Tests con `hoy = '2026-10-15'` (casos de `torre-de-control.feature`): RN-AN-04 (56 en 28 → 2; 40 con 8 agotados → 20 días, 2; nuevo desde 10-05 con 15 → 10 días, 1.5; desde 10-10 → sin predicción; ventas de hoy no cuentan); RN-AN-05 (todas las filas del esquema); estados de `alertas.feature` (RN-AL-01: stock 0/1/3/4 con mínimo 3 sin predicción; stock 6 con VPD 2 → cobertura 3 → POR_ACABARSE); RN-AN-06 (cuatro filas del esquema: 12 unid., 11 unid., 1.5 kg, 0.5 kg; sin predicción 2 → 4 unid.; agotado con mínimo 0 → 1 unid.); RN-AN-07 (la lista del escenario completo: orden Bolsas, Lejía, Jabón, Carbón; Detergente fuera; total S/ 37.78); `textoParaCompartir` (texto exacto del escenario, total S/ 32.93).

- [ ] Rojo → verde → commit `feat(analisis): predicción de venta, estado de stock y cantidad sugerida`.

### Tarea 3: Periodos y observaciones

**Archivos:** `domain/periodos.ts`, `domain/observaciones.ts`, `domain/necesito-comprar.ts` + specs.

Tests: RN-AN-02 (resumen de "Hoy" del escenario: 14.00 / 9.60 / 4.40 / 2.40 / 2.00 / −2.40), RN-AN-03 (cuatro periodos: 10.50 / 7.00 / 21.00 / 56.00), RN-AN-09 (tablas del escenario de más vendidos), RN-AN-10 (Cera roja 0.50, Desatorador 0.00), RN-AN-11 (Escoba 24.00 con 45 días, Trapeador 16.00, Recogedor y Lejía fuera, total 40.00), RN-AN-12 (▲ 12 % más / ▼ 10 % menos; sin datos), RN-AN-13 (sábado S/ 200.00, domingo S/ 0.00, resto S/ 100.00, mejor sábado; menos de 14 días → mensaje), RN-AN-14 (`10, 12, 9, 14, 15, 13, 16, 18`), RN-AN-16 (las cuatro respuestas del feature, más el caso 4).

- [ ] Rojo → verde → commit `feat(analisis): resumen por periodo y observaciones de la torre de control`.

### Tarea 4: Casos de uso, lista editable y API para otros módulos

**Archivos:** `application/situaciones.ts`, `torre.ts`, `lista-de-compras.ts`, `producto.ts`, `modulo.ts`, `index.ts` + specs.

Dobles: catálogo e inventario falsos (mapas), tienda falsa con `diasEntreCompras 7`, `diasAnticipacion 3`, `nombreTienda 'Bodega Rosita'`; `RelojFijo('2026-10-15T23:00:00.000Z')` (18:00 en Lima).

Tests: `consultarTorre()` arma todas las secciones con datos vacíos sin fallar (mensajes de vacío vienen de los tipos `sin-datos`/`insuficiente`); RN-AN-08 (cambiar a 24 → la lista muestra 24; al día siguiente (`reloj.fijar`) vuelve a 12; quitar un producto; `lineasParaRegistrarLlegada` devuelve cantidades y costos `2.40` / `2.75`); `necesitoComprar` devuelve también stock y último ingreso; `consultable.situaciones()` excluye archivados; `totalesDelDia` y `resumenesDeTienda`; RN-AN-15 (ningún caso de uso usa red: solo puertos locales).

- [ ] Rojo → verde → verificación final de la rama → commit `feat(analisis): torre de control, lista para comprar y consultas para otros módulos`.

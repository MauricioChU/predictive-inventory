import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero, redondearMitadLejosDeCero } from '@/shared/domain/dinero'
import { diaDeLaSemana, diasEntre, sumarDias, type Dia } from '@/shared/domain/fecha'
import { estaEnRango, resumenDePeriodo, type RangoDeDias } from './periodos'
import type { ResumenDiario } from './resumen-diario'

function porNombre(a: { nombre: string }, b: { nombre: string }): number {
  return a.nombre.localeCompare(b.nombre, 'es')
}

// ───────────── Más vendidos (RN-AN-09) ─────────────

export const MAXIMO_DE_MAS_VENDIDOS = 5

export interface FilaMasVendido {
  productoId: string
  nombre: string
  unidad: Unidad
  /** Número de líneas de venta. */
  veces: number
  cantidad: Cantidad
  ventas: Dinero
  ganancia: Dinero
}

export interface MasVendidos {
  porVeces: FilaMasVendido[]
  porGanancia: FilaMasVendido[]
}

export function masVendidos(
  filas: readonly ResumenDiario[],
  productos: readonly Pick<ProductoResumido, 'id' | 'nombre' | 'unidad'>[],
  rango: RangoDeDias,
): MasVendidos {
  const porId = new Map(productos.map((p) => [p.id, p]))
  const acumulado = new Map<string, FilaMasVendido>()
  for (const fila of filas) {
    const producto = porId.get(fila.productoId)
    if (!producto || !estaEnRango(fila.dia, rango)) continue
    const previa = acumulado.get(producto.id) ?? {
      productoId: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      veces: 0,
      cantidad: Cantidad.cero(),
      ventas: Dinero.cero(),
      ganancia: Dinero.cero(),
    }
    acumulado.set(producto.id, {
      ...previa,
      veces: previa.veces + fila.lineasVendidas,
      cantidad: previa.cantidad.sumar(fila.cantidadVendida),
      ventas: previa.ventas.sumar(fila.ventas),
      ganancia: previa.ganancia.sumar(fila.gananciaBruta),
    })
  }
  const vendidos = [...acumulado.values()].filter((f) => f.veces > 0)
  const porVentas = (a: FilaMasVendido, b: FilaMasVendido) => b.ventas.compararCon(a.ventas)
  return {
    porVeces: [...vendidos]
      .sort((a, b) => b.veces - a.veces || porVentas(a, b) || porNombre(a, b))
      .slice(0, MAXIMO_DE_MAS_VENDIDOS),
    porGanancia: [...vendidos]
      .sort((a, b) => b.ganancia.compararCon(a.ganancia) || porVentas(a, b) || porNombre(a, b))
      .slice(0, MAXIMO_DE_MAS_VENDIDOS),
  }
}

/** Líneas de venta (no anuladas) de cada producto en el rango; solo productos con alguna. */
export function vecesVendido(
  filas: readonly ResumenDiario[],
  rango: RangoDeDias,
): Map<string, number> {
  const veces = new Map<string, number>()
  for (const fila of filas) {
    if (!fila.tieneVentas || !estaEnRango(fila.dia, rango)) continue
    veces.set(fila.productoId, (veces.get(fila.productoId) ?? 0) + fila.lineasVendidas)
  }
  return veces
}

// ───────────── Precios para revisar (RN-AN-10) ─────────────

export interface PrecioParaRevisar {
  productoId: string
  nombre: string
  perdidaPorUnidad: Dinero
}

export function preciosParaRevisar(productos: readonly ProductoResumido[]): PrecioParaRevisar[] {
  return productos
    .filter((p) => p.activo && p.precioVenta.menorOIgualQue(p.precioCompra))
    .map((p) => ({
      productoId: p.id,
      nombre: p.nombre,
      perdidaPorUnidad: p.precioCompra.restar(p.precioVenta),
    }))
    .sort((a, b) => b.perdidaPorUnidad.compararCon(a.perdidaPorUnidad) || porNombre(a, b))
}

// ───────────── Productos parados (RN-AN-11) ─────────────

/** Sin ventas en los últimos 30 días (incluye hoy) y con el primer movimiento hace 30 días o más. */
export const DIAS_PARA_ESTAR_PARADO = 30

export const SUGERENCIA_PARA_PARADOS = 'Ponlo a la vista u ofrécelo con descuento'

export interface ProductoParado {
  productoId: string
  nombre: string
  unidad: Unidad
  stock: Cantidad
  diasSinVender: number
  dineroInmovilizado: Dinero
}

export interface ProductosParados {
  productos: ProductoParado[]
  total: Dinero
}

/** Último día (hasta hoy) con alguna línea vendida entre las filas dadas. */
export function ultimoDiaConVenta(filas: readonly ResumenDiario[], hoy: Dia): Dia | null {
  let ultimo: Dia | null = null
  for (const fila of filas) {
    if (!fila.tieneVentas || fila.dia > hoy) continue
    if (ultimo === null || fila.dia > ultimo) ultimo = fila.dia
  }
  return ultimo
}

export interface DatosDeParado {
  hoy: Dia
  stock: Cantidad
  primerDia: Dia | null
}

/** Tiene stock y su primer movimiento fue hace 30 días o más (falta ver sus ventas). */
export function podriaEstarParado(d: DatosDeParado): boolean {
  return (
    d.stock.esPositiva() &&
    d.primerDia !== null &&
    d.primerDia <= sumarDias(d.hoy, -DIAS_PARA_ESTAR_PARADO)
  )
}

/** RN-AN-11: días desde la última venta (o desde el primer movimiento), o null si no está parado. */
export function diasSinVender(d: DatosDeParado & { ultimoDiaConVenta: Dia | null }): number | null {
  const { primerDia, ultimoDiaConVenta: ultimaVenta } = d
  if (primerDia === null || !podriaEstarParado(d)) return null
  if (ultimaVenta !== null && ultimaVenta > sumarDias(d.hoy, -DIAS_PARA_ESTAR_PARADO)) return null
  return diasEntre(ultimaVenta ?? primerDia, d.hoy)
}

export function productosParados(
  entradas: readonly {
    producto: Pick<ProductoResumido, 'id' | 'nombre' | 'unidad' | 'precioCompra'>
    stock: Cantidad
    diasSinVender: number
  }[],
): ProductosParados {
  const productos = entradas
    .map(({ producto, stock, diasSinVender: dias }) => ({
      productoId: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      stock,
      diasSinVender: dias,
      dineroInmovilizado: producto.precioCompra.multiplicarPor(stock),
    }))
    .sort((a, b) => b.dineroInmovilizado.compararCon(a.dineroInmovilizado) || porNombre(a, b))
  return { productos, total: Dinero.sumarTodos(productos.map((p) => p.dineroInmovilizado)) }
}

// ───────────── Semana contra semana (RN-AN-12) ─────────────

export const SIN_DATOS_DE_LA_SEMANA_ANTERIOR = 'Sin datos de la semana anterior'

export interface FilaComparacion {
  concepto: 'Ventas' | 'Ganancia neta'
  actual: Dinero
  anterior: Dinero
  cambio: string
}

export type ComparacionSemanal =
  | { tipo: 'sin-datos'; mensaje: typeof SIN_DATOS_DE_LA_SEMANA_ANTERIOR }
  | { tipo: 'comparacion'; filas: FilaComparacion[] }

/** Cambio % = (actual − anterior) ÷ |anterior| × 100, redondeado al entero (mitad lejos de cero). */
export function textoDeCambio(actual: Dinero, anterior: Dinero): string {
  if (anterior.esCero()) return SIN_DATOS_DE_LA_SEMANA_ANTERIOR
  const porcentaje = redondearMitadLejosDeCero(
    (actual.centimos - anterior.centimos) * 100,
    Math.abs(anterior.centimos),
  )
  if (porcentaje > 0) return `▲ ${porcentaje} % más`
  if (porcentaje < 0) return `▼ ${-porcentaje} % menos`
  return '= igual'
}

function fila(concepto: FilaComparacion['concepto'], actual: Dinero, anterior: Dinero) {
  return { concepto, actual, anterior, cambio: textoDeCambio(actual, anterior) }
}

/** Últimos 7 días completos contra los 7 anteriores a esos. */
export function semanaContraSemana(filas: readonly ResumenDiario[], hoy: Dia): ComparacionSemanal {
  const actual = resumenDePeriodo(filas, { desde: sumarDias(hoy, -7), hasta: sumarDias(hoy, -1) })
  const anterior = resumenDePeriodo(filas, {
    desde: sumarDias(hoy, -14),
    hasta: sumarDias(hoy, -8),
  })
  if (anterior.ventas.esCero())
    return { tipo: 'sin-datos', mensaje: SIN_DATOS_DE_LA_SEMANA_ANTERIOR }
  return {
    tipo: 'comparacion',
    filas: [
      fila('Ventas', actual.ventas, anterior.ventas),
      fila('Ganancia neta', actual.gananciaNeta, anterior.gananciaNeta),
    ],
  }
}

// ───────────── Mejor día de la semana (RN-AN-13) ─────────────

export const NOMBRES_DE_DIA = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const
export type NombreDeDia = (typeof NOMBRES_DE_DIA)[number]

export const MENSAJE_SIN_HISTORIA_SUFICIENTE = 'Necesito al menos 2 semanas de ventas para saberlo'
/** Con historia suficiente pero sin ninguna venta: no hay un "mejor día" que marcar. */
export const MENSAJE_SIN_VENTAS_PARA_MEJOR_DIA = 'Todavía no hay ventas para saberlo'
/** Días de historia que hacen falta. */
export const DIAS_PARA_MEJOR_DIA = 14
/** Días completos que se miran. */
export const DIAS_DE_HISTORIA_DEL_MEJOR_DIA = 56

export type MejorDia =
  | {
      tipo: 'insuficiente'
      mensaje: typeof MENSAJE_SIN_HISTORIA_SUFICIENTE | typeof MENSAJE_SIN_VENTAS_PARA_MEJOR_DIA
    }
  | { tipo: 'calculado'; promedios: { dia: NombreDeDia; promedio: Dinero }[]; mejor: NombreDeDia }

export function mejorDiaDeLaSemana(
  filas: readonly ResumenDiario[],
  hoy: Dia,
  primerDiaDeLaTienda: Dia | null,
): MejorDia {
  if (primerDiaDeLaTienda === null || diasEntre(primerDiaDeLaTienda, hoy) < DIAS_PARA_MEJOR_DIA) {
    return { tipo: 'insuficiente', mensaje: MENSAJE_SIN_HISTORIA_SUFICIENTE }
  }
  const inicio = sumarDias(hoy, -DIAS_DE_HISTORIA_DEL_MEJOR_DIA)
  const rango = {
    desde: primerDiaDeLaTienda > inicio ? primerDiaDeLaTienda : inicio,
    hasta: sumarDias(hoy, -1),
  }
  const ventasPorDia = new Map<Dia, number>()
  for (const f of filas) {
    if (estaEnRango(f.dia, rango)) {
      ventasPorDia.set(f.dia, (ventasPorDia.get(f.dia) ?? 0) + f.ventas.centimos)
    }
  }
  // Con 14 días o más de historia, cada día de la semana ocurre al menos 2 veces en el rango.
  const promedios = NOMBRES_DE_DIA.map((dia, i) => {
    let suma = 0
    let veces = 0
    for (let d = rango.desde; d <= rango.hasta; d = sumarDias(d, 1)) {
      if (diaDeLaSemana(d) !== i + 1) continue
      suma += ventasPorDia.get(d) ?? 0
      veces += 1
    }
    return { dia, promedio: Dinero.deCentimos(redondearMitadLejosDeCero(suma, veces)) }
  })
  const mejor = promedios.reduce((m, p) => (p.promedio.mayorQue(m.promedio) ? p : m))
  if (mejor.promedio.esCero()) {
    return { tipo: 'insuficiente', mensaje: MENSAJE_SIN_VENTAS_PARA_MEJOR_DIA }
  }
  return { tipo: 'calculado', promedios, mejor: mejor.dia }
}

// ───────────── Tendencia (RN-AN-14) ─────────────

export const BLOQUES_DE_TENDENCIA = 8

/** Cantidad vendida en cada uno de los últimos 8 bloques de 7 días completos, del más antiguo al más reciente. */
export function tendencia(filas: readonly ResumenDiario[], hoy: Dia): Cantidad[] {
  return Array.from({ length: BLOQUES_DE_TENDENCIA }, (_, k) => {
    const desde = sumarDias(hoy, -7 * (BLOQUES_DE_TENDENCIA - k))
    const rango = { desde, hasta: sumarDias(desde, 6) }
    return Cantidad.sumarTodas(
      filas.filter((f) => estaEnRango(f.dia, rango)).map((f) => f.cantidadVendida),
    )
  })
}

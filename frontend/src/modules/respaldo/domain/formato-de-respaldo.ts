import { RANGOS_DE_CONFIGURACION } from '../../../shared/contratos/configuracion'
import { UNIDADES } from '../../../shared/domain/cantidad'
import { diaDe, type Dia, type Instante } from '../../../shared/domain/fecha'
import { ErrorDeDominio } from '../../../shared/domain/errores'
import { formatearDia, formatearEntero, plural } from '../../../shared/domain/formato'
import type {
  AvisoRegistro,
  CategoriaRegistro,
  ConfiguracionRegistro,
  OperacionRegistro,
  ProductoRegistro,
} from '../../../shared/contratos/registros'

export const VERSION_DE_FORMATO = 1
export const NOMBRE_DE_APP = 'predictive-inventory'

const MENSAJE_INVALIDA = 'Este archivo no es una copia válida de la app'
const MENSAJE_VERSION_FUTURA = 'Actualiza la app para abrir este respaldo'

/** Todo lo que guarda y restaura un respaldo completo (RN-RE-02). Las proyecciones
 * (existencias, resúmenes diarios, lista de compras, conteo) no viven aquí: se reconstruyen. */
export interface DatosDelRespaldo {
  configuracion: ConfiguracionRegistro | null
  categorias: CategoriaRegistro[]
  productos: ProductoRegistro[]
  operaciones: OperacionRegistro[]
  avisos: AvisoRegistro[]
  fotos: { productoId: string; tipo: string; base64: string }[]
}

export interface ControlDeRespaldo {
  productos: number
  operaciones: number
  /** Milésimas de cada producto, por id. */
  stockPorProducto: Record<string, number>
}

export interface RespaldoV1 {
  versionDeFormato: 1
  app: typeof NOMBRE_DE_APP
  creadoEn: Instante
  control: ControlDeRespaldo
  datos: DatosDelRespaldo
}

export interface ResumenDeCopia {
  productos: number
  operaciones: number
  desde: Dia | null
  hasta: Dia | null
  texto: string
}

/** Stock de cada producto según el libro de operaciones (suma de movimientos, ADR-0002).
 * Todos los productos del respaldo aparecen, también los que no tienen movimientos (0). */
export function stockDesdeElLibro(
  productos: readonly ProductoRegistro[],
  operaciones: readonly OperacionRegistro[],
): Record<string, number> {
  const stock: Record<string, number> = {}
  for (const producto of productos) stock[producto.id] = 0
  for (const operacion of operaciones) {
    for (const movimiento of operacion.movimientos) {
      stock[movimiento.productoId] = (stock[movimiento.productoId] ?? 0) + movimiento.cantidad
    }
  }
  return stock
}

/**
 * Arma un respaldo v1 (RN-RE-02). El control sale del mismo libro de operaciones que se
 * guarda, no de la proyección de existencias: así la copia siempre cuadra consigo misma.
 */
export function crearRespaldo(datos: DatosDelRespaldo, creadoEn: Instante): RespaldoV1 {
  return {
    versionDeFormato: VERSION_DE_FORMATO,
    app: NOMBRE_DE_APP,
    creadoEn,
    control: {
      productos: datos.productos.length,
      operaciones: datos.operaciones.length,
      stockPorProducto: stockDesdeElLibro(datos.productos, datos.operaciones),
    },
    datos,
  }
}

type Plano = Record<string, unknown>

function esPlano(valor: unknown): valor is Plano {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}
function esTexto(v: unknown): v is string {
  return typeof v === 'string'
}
function esEntero(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v)
}
const PATRON_INSTANTE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/

/** ISO-8601 estricto con zona, fecha real del calendario y año entre 2000 y 2100. */
function esInstante(v: unknown): boolean {
  if (typeof v !== 'string') return false
  const m = PATRON_INSTANTE.exec(v)
  if (!m) return false
  const [anio, mes, dia, hora, minuto, segundo] = m.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  if (anio < 2000 || anio > 2100) return false
  if (hora > 23 || minuto > 59 || segundo > 59) return false
  if (m[9] !== undefined && (Number(m[9]) > 23 || Number(m[10]) > 59)) return false
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  )
}
function esTextoONulo(v: unknown): boolean {
  return v === null || esTexto(v)
}
function esUnoDe(lista: readonly string[], v: unknown): boolean {
  return typeof v === 'string' && lista.includes(v)
}
function todos(v: unknown, esValido: (x: unknown) => boolean): boolean {
  return Array.isArray(v) && v.every(esValido)
}

const TIPOS_DE_OPERACION = ['STOCK_INICIAL', 'INGRESO', 'VENTA', 'MERMA', 'AJUSTE', 'ANULACION']
const ESTADOS_DE_STOCK = ['AGOTADO', 'POR_ACABARSE', 'NORMAL']
const TAMANOS_DE_LETRA = ['NORMAL', 'GRANDE', 'MUY_GRANDE']

function categoriaValida(c: unknown): boolean {
  return esPlano(c) && esTexto(c.id) && esTexto(c.nombre) && esTexto(c.nombreNormalizado)
}

function productoValido(p: unknown): boolean {
  return (
    esPlano(p) &&
    esTexto(p.id) &&
    esTexto(p.nombre) &&
    esTexto(p.nombreNormalizado) &&
    esTexto(p.categoriaId) &&
    esUnoDe(UNIDADES, p.unidad) &&
    esEntero(p.precioCompra) &&
    esEntero(p.precioVenta) &&
    esEntero(p.stockMinimo) &&
    typeof p.tieneFoto === 'boolean' &&
    esUnoDe(['ACTIVO', 'ARCHIVADO'], p.estado) &&
    esInstante(p.creadoEn) &&
    esInstante(p.actualizadoEn)
  )
}

function movimientoValido(m: unknown): boolean {
  return (
    esPlano(m) &&
    esTexto(m.productoId) &&
    esEntero(m.cantidad) &&
    esEntero(m.costoUnitario) &&
    (m.precioUnitario === null || esEntero(m.precioUnitario))
  )
}

function operacionValida(o: unknown): boolean {
  return (
    esPlano(o) &&
    esTexto(o.id) &&
    esUnoDe(TIPOS_DE_OPERACION, o.tipo) &&
    todos(o.movimientos, movimientoValido) &&
    todos(o.productoIds, esTexto) &&
    esInstante(o.ocurridaEn) &&
    esInstante(o.registradaEn) &&
    esTextoONulo(o.motivo) &&
    esTextoONulo(o.nota) &&
    esTextoONulo(o.anulaA) &&
    esTexto(o.dispositivoId)
  )
}

function avisoValido(a: unknown): boolean {
  return esPlano(a) && esTexto(a.productoId) && esUnoDe(ESTADOS_DE_STOCK, a.ultimoEstadoAvisado)
}

const PATRON_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const TIPOS_DE_FOTO = ['image/webp', 'image/jpeg', 'image/png']

function fotoValida(f: unknown): boolean {
  return (
    esPlano(f) &&
    esTexto(f.productoId) &&
    esUnoDe(TIPOS_DE_FOTO, f.tipo) &&
    esTexto(f.base64) &&
    f.base64.length > 0 &&
    PATRON_BASE64.test(f.base64)
  )
}

function configuracionValida(c: unknown): boolean {
  return (
    c === null ||
    (esPlano(c) &&
      c.clave === 'negocio' &&
      esTexto(c.nombreTienda) &&
      esEntero(c.diasEntreCompras) &&
      esEntero(c.diasAnticipacion) &&
      esEntero(c.diasMaximosDeCompra) &&
      esUnoDe(TAMANOS_DE_LETRA, c.tamanoDeLetra) &&
      typeof c.notificacionesActivas === 'boolean')
  )
}

function controlValido(c: unknown): boolean {
  return (
    esPlano(c) &&
    esEntero(c.productos) &&
    esEntero(c.operaciones) &&
    esPlano(c.stockPorProducto) &&
    Object.values(c.stockPorProducto).every(esEntero)
  )
}

function sinRepetidos(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length
}

function enRango(valor: number, rango: { min: number; max: number }): boolean {
  return valor >= rango.min && valor <= rango.max
}

/** Reglas entre registros que un archivo bien formado todavía podría romper. */
function invariantesDelLibro(d: DatosDelRespaldo): boolean {
  const idsDeProductos = new Set(d.productos.map((p) => p.id))
  const idsDeCategorias = new Set(d.categorias.map((c) => c.id))
  const idsDeOperaciones = new Set(d.operaciones.map((o) => o.id))

  if (
    !sinRepetidos(d.productos.map((p) => p.id)) ||
    !sinRepetidos(d.categorias.map((c) => c.id)) ||
    !sinRepetidos(d.operaciones.map((o) => o.id)) ||
    !sinRepetidos(d.avisos.map((a) => a.productoId)) ||
    !sinRepetidos(d.fotos.map((f) => f.productoId))
  ) {
    return false
  }

  const productosOk = d.productos.every(
    (p) =>
      idsDeCategorias.has(p.categoriaId) &&
      p.precioCompra >= 0 &&
      p.precioVenta >= 1 &&
      p.stockMinimo >= 0,
  )
  const operacionesOk = d.operaciones.every((o) => {
    if (o.movimientos.length === 0) return false
    const preciosOk = o.movimientos.every((m) =>
      o.tipo === 'VENTA'
        ? m.precioUnitario !== null && m.precioUnitario >= 1
        : m.precioUnitario === null,
    )
    const anulaOk =
      o.tipo === 'ANULACION'
        ? o.anulaA !== null && idsDeOperaciones.has(o.anulaA)
        : o.anulaA === null
    return preciosOk && anulaOk && o.movimientos.every((m) => idsDeProductos.has(m.productoId))
  })
  const referenciasOk =
    d.avisos.every((a) => idsDeProductos.has(a.productoId)) &&
    d.fotos.every((f) => idsDeProductos.has(f.productoId))

  const c = d.configuracion
  // El nombre puede estar vacío: es el de CONFIGURACION_INICIAL, que la app guarda tal cual si
  // se cambia otra cosa antes de completar la primera vez (y la copia de ese estado vale).
  const nombreTienda = { min: 0, max: RANGOS_DE_CONFIGURACION.nombreTienda.max }
  const configuracionOk =
    c === null ||
    (enRango(c.nombreTienda.length, nombreTienda) &&
      enRango(c.diasEntreCompras, RANGOS_DE_CONFIGURACION.diasEntreCompras) &&
      enRango(c.diasAnticipacion, RANGOS_DE_CONFIGURACION.diasAnticipacion) &&
      enRango(c.diasMaximosDeCompra, RANGOS_DE_CONFIGURACION.diasMaximosDeCompra))

  const stockOk = Object.values(stockDesdeElLibro(d.productos, d.operaciones)).every((n) => n >= 0)

  return productosOk && operacionesOk && referenciasOk && configuracionOk && stockOk
}

function datosValidos(d: unknown): boolean {
  return (
    esPlano(d) &&
    configuracionValida(d.configuracion) &&
    todos(d.categorias, categoriaValida) &&
    todos(d.productos, productoValido) &&
    todos(d.operaciones, operacionValida) &&
    todos(d.avisos, avisoValido) &&
    todos(d.fotos, fotoValida) &&
    invariantesDelLibro(d as unknown as DatosDelRespaldo)
  )
}

/** Punto de extensión para versiones futuras: v1 es la única que existe hoy, así que
 * migrar() es la identidad (RN-RE-05). */
function migrar(bruto: Plano): Plano {
  return bruto
}

/**
 * Lee y valida un respaldo ANTES de pedir confirmaciones (RN-RE-03/04/05). Lanza
 * ErrorDeDominio con el mensaje exacto de la spec. La versión se revisa justo después de
 * "app": un respaldo futuro puede tener otra estructura y debe pedir actualizar la app.
 */
export function leerRespaldo(texto: string): RespaldoV1 {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }

  if (!esPlano(bruto) || bruto.app !== NOMBRE_DE_APP) {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }

  const version = bruto.versionDeFormato
  if (!esEntero(version) || version < 1)
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  if (version > VERSION_DE_FORMATO) {
    throw new ErrorDeDominio('COPIA_VERSION_FUTURA', MENSAJE_VERSION_FUTURA)
  }

  const migrado = migrar(bruto)
  if (
    !esInstante(migrado.creadoEn) ||
    !controlValido(migrado.control) ||
    !datosValidos(migrado.datos)
  ) {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }

  const respaldo = migrado as unknown as RespaldoV1
  if (
    respaldo.control.productos !== respaldo.datos.productos.length ||
    respaldo.control.operaciones !== respaldo.datos.operaciones.length
  ) {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }

  return respaldo
}

/**
 * Plan 17, ronda 1: los instantes de las operaciones en la forma que escribe la app (ISO UTC de
 * `toISOString`: "2026-10-01T15:30:00.000Z"). Una copia puede traer otra zona ("…-05:00") o no
 * traer milisegundos; es el mismo instante, pero el Historial pagina por el TEXTO de
 * `ocurridaEn` (índice de Dexie) y solo en esta forma el orden del texto es el del tiempo.
 */
export function conInstantesCanonicos(datos: DatosDelRespaldo): DatosDelRespaldo {
  const canonico = (instante: string) => new Date(instante).toISOString()
  return {
    ...datos,
    operaciones: datos.operaciones.map((o) => ({
      ...o,
      ocurridaEn: canonico(o.ocurridaEn),
      registradaEn: canonico(o.registradaEn),
    })),
  }
}

/** RN-RE-03: lo que se le muestra al usuario antes de confirmar la restauración. */
export function resumenDeCopia(
  control: Pick<ControlDeRespaldo, 'productos' | 'operaciones'>,
  operaciones: readonly OperacionRegistro[],
): ResumenDeCopia {
  const productos = `${formatearEntero(control.productos)} ${plural(control.productos, 'producto', 'productos')}`
  if (operaciones.length === 0) {
    return {
      productos: control.productos,
      operaciones: control.operaciones,
      desde: null,
      hasta: null,
      texto: `${productos}, sin movimientos`,
    }
  }

  const dias = operaciones.map((op) => diaDe(op.ocurridaEn))
  const desde = dias.reduce((a, b) => (a < b ? a : b))
  const hasta = dias.reduce((a, b) => (a > b ? a : b))
  const movimientos = `${formatearEntero(control.operaciones)} ${plural(control.operaciones, 'movimiento', 'movimientos')}`
  const texto = `${productos}, ${movimientos}, del ${formatearDia(desde)} al ${formatearDia(hasta)}`

  return { productos: control.productos, operaciones: control.operaciones, desde, hasta, texto }
}

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
function esInstante(v: unknown): boolean {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v))
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

function fotoValida(f: unknown): boolean {
  return esPlano(f) && esTexto(f.productoId) && esTexto(f.tipo) && esTexto(f.base64)
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

function datosValidos(d: unknown): boolean {
  return (
    esPlano(d) &&
    configuracionValida(d.configuracion) &&
    todos(d.categorias, categoriaValida) &&
    todos(d.productos, productoValido) &&
    todos(d.operaciones, operacionValida) &&
    todos(d.avisos, avisoValido) &&
    todos(d.fotos, fotoValida)
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
  if (typeof version !== 'number') throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  if (version > VERSION_DE_FORMATO) {
    throw new ErrorDeDominio('COPIA_VERSION_FUTURA', MENSAJE_VERSION_FUTURA)
  }

  const migrado = version < VERSION_DE_FORMATO ? migrar(bruto) : bruto
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

import type { Cantidad } from '../../../shared/domain/cantidad'
import { diaDe, type Dia, type Instante } from '../../../shared/domain/fecha'
import { ErrorDeDominio } from '../../../shared/domain/errores'
import { formatearDia, formatearEntero } from '../../../shared/domain/formato'
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

/** Arma un respaldo v1 a partir de los datos actuales y las existencias (RN-RE-02). */
export function crearRespaldo(
  datos: DatosDelRespaldo,
  existencias: ReadonlyMap<string, Cantidad>,
  creadoEn: Instante,
): RespaldoV1 {
  const stockPorProducto: Record<string, number> = {}
  for (const [productoId, cantidad] of existencias) {
    stockPorProducto[productoId] = cantidad.milesimas
  }
  return {
    versionDeFormato: VERSION_DE_FORMATO,
    app: NOMBRE_DE_APP,
    creadoEn,
    control: {
      productos: datos.productos.length,
      operaciones: datos.operaciones.length,
      stockPorProducto,
    },
    datos,
  }
}

function esRegistroPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Punto de extensión para versiones futuras: v1 es la única que existe hoy, así que
 * migrar() es la identidad (RN-RE-05). */
function migrar(bruto: Record<string, unknown>): RespaldoV1 {
  return bruto as unknown as RespaldoV1
}

/**
 * Lee y valida un respaldo (RN-RE-03/04/05). Lanza ErrorDeDominio con el mensaje exacto de
 * la spec si el formato es inválido o si es de una versión más nueva que la de la app.
 */
export function leerRespaldo(texto: string): RespaldoV1 {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }

  if (!esRegistroPlano(bruto)) throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  if (bruto.app !== NOMBRE_DE_APP) throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  if (!esRegistroPlano(bruto.control) || !esRegistroPlano(bruto.datos)) {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }

  const versionDeFormato = bruto.versionDeFormato
  if (typeof versionDeFormato !== 'number') {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }
  if (versionDeFormato > VERSION_DE_FORMATO) {
    throw new ErrorDeDominio('COPIA_VERSION_FUTURA', MENSAJE_VERSION_FUTURA)
  }

  const respaldo =
    versionDeFormato < VERSION_DE_FORMATO ? migrar(bruto) : (bruto as unknown as RespaldoV1)

  const { control, datos } = respaldo
  if (!Array.isArray(datos.productos) || !Array.isArray(datos.operaciones)) {
    throw new ErrorDeDominio('COPIA_INVALIDA', MENSAJE_INVALIDA)
  }
  if (
    control.productos !== datos.productos.length ||
    control.operaciones !== datos.operaciones.length
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
  if (operaciones.length === 0) {
    return {
      productos: control.productos,
      operaciones: control.operaciones,
      desde: null,
      hasta: null,
      texto: `${formatearEntero(control.productos)} productos, sin movimientos`,
    }
  }

  const dias = operaciones.map((op) => diaDe(op.ocurridaEn))
  const desde = dias.reduce((a, b) => (a < b ? a : b))
  const hasta = dias.reduce((a, b) => (a > b ? a : b))
  const texto =
    `${formatearEntero(control.productos)} productos, ` +
    `${formatearEntero(control.operaciones)} movimientos, ` +
    `del ${formatearDia(desde)} al ${formatearDia(hasta)}`

  return { productos: control.productos, operaciones: control.operaciones, desde, hasta, texto }
}

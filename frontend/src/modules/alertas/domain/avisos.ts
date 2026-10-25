import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import { GRAVEDAD_DE_ESTADO, type EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import { formatearCantidad } from '@/shared/domain/formato'

/** Ruta de Productos ya filtrado por "Se acaban" (RN-AL-06, RN-AL-07, RN-CAT-16). */
export const RUTA_SE_ACABAN = '/productos?estado=se-acaban'
/** Los avisos de Inicio abren Productos ya filtrado (RN-CAT-16). */
export const RUTA_AGOTADOS = '/productos?estado=agotados'
export const RUTA_QUEDA_POCO = '/productos?estado=queda-poco'

/** Ruta de la pantalla de un producto (adonde apunta un aviso individual). */
export function rutaDeProducto(productoId: string): string {
  return `/productos/${productoId}`
}

/** RN-AL-03/04: hay aviso solo cuando el estado es MÁS grave que el guardado. */
export function empeoro(anterior: EstadoDeStock, actual: EstadoDeStock): boolean {
  return GRAVEDAD_DE_ESTADO[actual] > GRAVEDAD_DE_ESTADO[anterior]
}

function textoDeCobertura(dias: number): string {
  if (dias <= 0) return 'se acaba hoy'
  if (dias === 1) return 'se acaba en ~1 día'
  return `se acaba en ~${dias} días`
}

/** Texto exacto del aviso de UN producto (RN-AL-03). Solo se llama con AGOTADO o POR_ACABARSE. */
export function textoDeAviso(situacion: SituacionDeProducto): string {
  switch (situacion.estado) {
    case 'AGOTADO':
      return `Se acabó: ${situacion.nombre}`
    case 'POR_ACABARSE': {
      const stock = formatearCantidad(situacion.stock, situacion.unidad)
      const cobertura =
        situacion.diasDeCobertura === null ? '' : `, ${textoDeCobertura(situacion.diasDeCobertura)}`
      return `Queda poco: ${situacion.nombre} (${stock}${cobertura})`
    }
    case 'NORMAL':
      // Invariante: quien llama solo pasa productos cuyo estado empeoró (empeoro() nunca es
      // true cuando el estado actual es NORMAL, porque es la gravedad mínima).
      throw new Error('textoDeAviso: un producto NORMAL no genera aviso')
  }
}

/** Lo que se envía a un Notificador: mismo formato que `Notificacion` (application/puertos.ts),
 * pero el dominio no importa la capa de aplicación (ADR-0005). */
export interface AvisoNotificable {
  texto: string
  url: string
}

/** RN-AL-07: uno o ninguno se notifica tal cual; dos o más se agrupan en un solo aviso. */
export function agruparAvisos(situaciones: readonly SituacionDeProducto[]): AvisoNotificable[] {
  // Desestructura con resto en vez de indexar `situaciones[0]` (que con
  // `noUncheckedIndexedAccess` sería `SituacionDeProducto | undefined`): así `primera === undefined`
  // y `resto.length > 0` narrowan el tipo explícitamente, sin asertar con `!`, y cada rama queda
  // cubierta por un caso real (0, 2+, exactamente 1), sin ninguna rama muerta.
  const [primera, ...resto] = situaciones
  if (primera === undefined) return []
  if (resto.length > 0) {
    return [{ texto: `${situaciones.length} productos se están acabando`, url: RUTA_SE_ACABAN }]
  }
  return [{ texto: textoDeAviso(primera), url: rutaDeProducto(primera.productoId) }]
}

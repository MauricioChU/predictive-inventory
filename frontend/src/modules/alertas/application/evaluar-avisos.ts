import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import { agruparAvisos, empeoro } from '../domain/avisos'
import type { DependenciasDeAlertas } from './modulo'
import type { Notificacion } from './puertos'

/**
 * RN-AL-01 a RN-AL-07: recalcula, para cada producto activo, si su estado empeoró desde el
 * último aviso; limpia el registro de los productos archivados; guarda SIEMPRE el estado
 * actual (para poder rearmar el aviso si luego vuelve a empeorar, RN-AL-04); y notifica por
 * el canal del sistema solo si la configuración y el permiso del navegador lo permiten.
 */
export async function evaluarAvisos(
  d: Pick<DependenciasDeAlertas, 'avisos' | 'notificador' | 'uow' | 'analisis' | 'tienda'>,
): Promise<Notificacion[]> {
  const situaciones = await d.analisis().situaciones()
  const idsActivos = new Set(situaciones.map((s) => s.productoId))

  const notificaciones = await d.uow.ejecutar(async () => {
    const registrados = await d.avisos.todos()
    const estadoAnteriorDe = new Map(registrados.map((r) => [r.productoId, r.ultimoEstadoAvisado]))

    // RN-AL-01: un producto que ya no aparece en situaciones() está archivado: sin estado,
    // sin avisos, y su registro desaparece.
    for (const registro of registrados) {
      if (!idsActivos.has(registro.productoId)) await d.avisos.eliminar(registro.productoId)
    }

    const empeoraron: SituacionDeProducto[] = []
    for (const situacion of situaciones) {
      const anterior = estadoAnteriorDe.get(situacion.productoId) ?? 'NORMAL'
      if (empeoro(anterior, situacion.estado)) empeoraron.push(situacion)
      // Siempre se guarda el estado actual, incluso sin empeorar: así, si vuelve a NORMAL,
      // el aviso queda rearmado para la próxima vez que empeore (RN-AL-04).
      await d.avisos.guardar({
        productoId: situacion.productoId,
        ultimoEstadoAvisado: situacion.estado,
      })
    }

    return agruparAvisos(empeoraron)
  })

  if (notificaciones.length === 0) return []

  const configuracion = await d.tienda().configuracion()
  const permitido = configuracion.notificacionesActivas && (await d.notificador.permitido())
  if (!permitido) return []

  for (const notificacion of notificaciones) await d.notificador.mostrar(notificacion)
  return notificaciones
}

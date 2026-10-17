import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import { agruparAvisos, empeoro } from '../domain/avisos'
import type { DependenciasDeAlertas } from './modulo'
import { notificacionesPermitidas } from './permiso'
import type { Notificacion } from './puertos'

/**
 * RN-AL-01 a RN-AL-07: recalcula, para cada producto activo, si su estado empeoró desde el
 * último aviso; limpia el registro de los productos archivados; guarda SIEMPRE el estado
 * actual (para poder rearmar el aviso si luego vuelve a empeorar, RN-AL-04); y notifica por
 * el canal del sistema solo si la configuración y el permiso del navegador lo permiten.
 *
 * Ola 3, ruling 1: las notificaciones salen con `uow.alConfirmar`, después de confirmar la
 * unidad de trabajo MÁS EXTERNA; si esa falla, no se muestra nada (y el registro tampoco quedó).
 * Devuelve lo que de verdad se notificó; dentro de otra unidad de trabajo todavía no salió nada
 * al volver, así que devuelve `[]` y las notificaciones salen al confirmar la externa.
 *
 * RN-SIS-09: `alLeer` recibe las situaciones apenas se leyeron, para que otros (el resumen de
 * atención del botón Control) usen el MISMO cálculo en vez de volver a leerlas.
 */
export async function evaluarAvisos(
  d: Pick<DependenciasDeAlertas, 'avisos' | 'notificador' | 'uow' | 'analisis' | 'tienda'>,
  alLeer?: (situaciones: readonly SituacionDeProducto[]) => void,
): Promise<Notificacion[]> {
  const situaciones = await d.analisis().situaciones()
  alLeer?.(situaciones)
  const idsActivos = new Set(situaciones.map((s) => s.productoId))
  const mostradas: Notificacion[] = []

  await d.uow.ejecutar(async () => {
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
      // Siempre se guarda el estado actual cuando CAMBIÓ, incluso sin empeorar: así, si vuelve
      // a NORMAL, el aviso queda rearmado para la próxima vez que empeore (RN-AL-04). Si no
      // cambió, no hay nada que escribir (evita escrituras redundantes en cada re-evaluación).
      if (anterior !== situacion.estado) {
        await d.avisos.guardar({
          productoId: situacion.productoId,
          ultimoEstadoAvisado: situacion.estado,
        })
      }
    }

    const notificaciones = agruparAvisos(empeoraron)
    if (notificaciones.length === 0) return
    d.uow.alConfirmar(async () => {
      if (!(await notificacionesPermitidas(d))) return
      for (const notificacion of notificaciones) {
        await d.notificador.mostrar(notificacion)
        mostradas.push(notificacion)
      }
    })
  })

  return [...mostradas]
}

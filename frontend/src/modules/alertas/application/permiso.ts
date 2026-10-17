import type { DependenciasDeAlertas } from './modulo'

/**
 * RN-AL-06c: el canal del sistema solo está permitido si la configuración de la tienda lo
 * tiene activo Y el navegador concedió el permiso. Único lugar donde se calcula esta
 * combinación: la usan tanto `evaluarAvisos` (para decidir si notifica) como
 * `ModuloAlertas.notificacionesPermitidas` (para que Ajustes lo muestre).
 */
export async function notificacionesPermitidas(
  d: Pick<DependenciasDeAlertas, 'tienda' | 'notificador'>,
): Promise<boolean> {
  const configuracion = await d.tienda().configuracion()
  return configuracion.notificacionesActivas && (await d.notificador.permitido())
}

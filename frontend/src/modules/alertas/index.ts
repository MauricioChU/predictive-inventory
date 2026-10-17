// API pública del módulo de Alertas (RN-AL): el resto de la app solo importa desde aquí
// (@/modules/alertas), nunca un archivo interno (ADR-0005).

export { RUTA_PARA_COMPRAR, rutaDeProducto } from './domain/avisos'

export { crearModuloAlertas } from './application/modulo'
export type {
  DependenciasDeAlertas,
  ModuloAlertas,
  ResumenDeAtencion,
  ResumenDelDia,
} from './application/modulo'
export type { Notificacion, Notificador, RepositorioDeAvisos } from './application/puertos'

export {
  NotificadorEnMemoria,
  RepositorioDeAvisosEnMemoria,
} from './infrastructure/memoria/repositorios'
export { RepositorioDeAvisosDexie } from './infrastructure/dexie/repositorios'
export {
  NotificadorDelSistema,
  soportaNotificaciones,
} from './infrastructure/navegador/notificador-del-sistema'

// Ola 4, plan 14: "Avisos en tu celular" (RN-AL-08), cargada al navegar.
export const VistaAvisos = () => import('./ui/VistaAvisos.vue')

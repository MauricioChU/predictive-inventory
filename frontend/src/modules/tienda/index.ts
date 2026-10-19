export { crearModuloTienda, type ModuloTienda } from './application/modulo'
export type { DependenciasDeTienda, RepositorioDeConfiguracion } from './application/puertos'
export { RepositorioDeConfiguracionEnMemoria } from './infrastructure/memoria/repositorio'
export { RepositorioDeConfiguracionDexie } from './infrastructure/dexie/repositorio'

// Ola 4, plan 14: pantallas (cargadas al navegar).
export const VistaInicio = () => import('./ui/VistaInicio.vue')
export const VistaPrimeraVez = () => import('./ui/VistaPrimeraVez.vue')
export const VistaAjustes = () => import('./ui/VistaAjustes.vue')
export const VistaDatosDeLaTienda = () => import('./ui/VistaDatosDeLaTienda.vue')

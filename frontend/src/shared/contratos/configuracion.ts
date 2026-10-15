export type TamanoDeLetra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'

export interface ConfiguracionDeNegocio {
  nombreTienda: string
  diasEntreCompras: number
  diasAnticipacion: number
  diasMaximosDeCompra: number
  tamanoDeLetra: TamanoDeLetra
  notificacionesActivas: boolean
}

export const CONFIGURACION_INICIAL: ConfiguracionDeNegocio = {
  nombreTienda: '',
  diasEntreCompras: 7,
  diasAnticipacion: 3,
  diasMaximosDeCompra: 30,
  tamanoDeLetra: 'GRANDE',
  notificacionesActivas: false,
}

export const RANGOS_DE_CONFIGURACION = {
  nombreTienda: { min: 1, max: 40 },
  diasEntreCompras: { min: 1, max: 60 },
  diasAnticipacion: { min: 1, max: 14 },
  diasMaximosDeCompra: { min: 7, max: 180 },
} as const

export type EstadoDeAlmacenamiento = 'DESCONOCIDO' | 'CONCEDIDO' | 'RECHAZADO'

/** Estado técnico de la instalación (no es configuración del negocio). */
export interface EstadoDelSistema {
  dispositivoId: string
  primeraVezCompletada: boolean
  ultimoRespaldoEn: string | null
  almacenamientoPersistente: EstadoDeAlmacenamiento
  ultimoResumenDelDiaMostrado: string | null
}

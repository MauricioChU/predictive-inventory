export type TamanoDeLetra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'

/** Costo del local (RN-AN-17). Los días de QUINCENAL van ordenados y son distintos. */
export type AlquilerDelLocal =
  | { tipo: 'NO_PAGA' }
  | { tipo: 'MENSUAL'; montoCentimos: number; dias: [number] }
  | { tipo: 'QUINCENAL'; montoCentimos: number; dias: [number, number] }

/** Tope del monto de cada pago del alquiler: S/ 99 999.99. */
export const MONTO_MAXIMO_DEL_ALQUILER_CENTIMOS = 9_999_999

export interface ConfiguracionDeNegocio {
  nombreTienda: string
  diasEntreCompras: number
  diasAnticipacion: number
  diasMaximosDeCompra: number
  tamanoDeLetra: TamanoDeLetra
  notificacionesActivas: boolean
  /** `null` = sin configurar. */
  alquilerDelLocal: AlquilerDelLocal | null
}

export const CONFIGURACION_INICIAL: ConfiguracionDeNegocio = {
  nombreTienda: '',
  diasEntreCompras: 7,
  diasAnticipacion: 3,
  diasMaximosDeCompra: 30,
  tamanoDeLetra: 'GRANDE',
  notificacionesActivas: false,
  alquilerDelLocal: null,
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
  /** Dia del último pago del local ya avisado (RN-AL-11). */
  ultimoPagoDelLocalAvisado: string | null
}

export type TipoDeOperacion =
  'STOCK_INICIAL' | 'INGRESO' | 'VENTA' | 'MERMA' | 'AJUSTE' | 'ANULACION'

export const MOTIVOS_DE_MERMA = ['Se dañó o rompió', 'Se derramó', 'Se venció', 'Otro'] as const
export type MotivoDeMerma = (typeof MOTIVOS_DE_MERMA)[number]

export const MOTIVO_PRODUCTO_RETIRADO = 'Producto retirado'
export const MOTIVO_CONTEO = 'Conteo de stock'

/**
 * RN-OP-18: "Deshacer" se ofrece durante 10 segundos. Una sola constante para la regla (el
 * Deshacer de Inventario) y para lo que se ve (AvisoDeshacer): M9 / M8 del plan 12.
 */
export const SEGUNDOS_PARA_DESHACER = 10

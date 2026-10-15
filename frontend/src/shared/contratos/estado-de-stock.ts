/** Estado de stock de un producto activo (03-alertas). */
export type EstadoDeStock = 'AGOTADO' | 'POR_ACABARSE' | 'NORMAL'

/** Mayor número = más grave. */
export const GRAVEDAD_DE_ESTADO: Record<EstadoDeStock, number> = { NORMAL: 0, POR_ACABARSE: 1, AGOTADO: 2 }

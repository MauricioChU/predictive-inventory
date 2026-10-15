import type { EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import type { Cantidad } from '@/shared/domain/cantidad'

export interface DatosDeEstado {
  stock: Cantidad
  stockMinimo: Cantidad
  /** RN-AN-05; null sin predicción o con VPD 0 (entonces solo cuenta el mínimo). */
  diasDeCobertura: number | null
  diasAnticipacion: number
}

/** Tabla de estados de 03-alertas (RN-AL-01). */
export function estadoDeStock(d: DatosDeEstado): EstadoDeStock {
  if (d.stock.milesimas <= 0) return 'AGOTADO'
  const porCobertura = d.diasDeCobertura !== null && d.diasDeCobertura <= d.diasAnticipacion
  if (d.stock.menorOIgualQue(d.stockMinimo) || porCobertura) return 'POR_ACABARSE'
  return 'NORMAL'
}

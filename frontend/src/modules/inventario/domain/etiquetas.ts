import {
  MOTIVO_CONTEO,
  MOTIVO_PRODUCTO_RETIRADO,
  type TipoDeOperacion,
} from '@/shared/contratos/operaciones'

const ETIQUETAS: Record<Exclude<TipoDeOperacion, 'MERMA' | 'AJUSTE'>, string> = {
  STOCK_INICIAL: 'Stock inicial',
  INGRESO: 'Llegó mercadería',
  VENTA: 'Venta',
  ANULACION: 'Anulado',
}

/** Cómo se muestra cada tipo de operación (spec 02, tabla de tipos). */
export function etiquetaDeOperacion(tipo: TipoDeOperacion, motivo: string | null): string {
  switch (tipo) {
    case 'MERMA':
      // Guía de palabras (06): "Merma" no se dice en pantalla.
      return motivo ?? 'Pérdida'
    case 'AJUSTE':
      return motivo === MOTIVO_PRODUCTO_RETIRADO ? MOTIVO_PRODUCTO_RETIRADO : MOTIVO_CONTEO
    default:
      return ETIQUETAS[tipo]
  }
}

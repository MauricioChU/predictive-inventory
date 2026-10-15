import { describe, expect, it } from 'vitest'
import { MOTIVO_CONTEO, MOTIVO_PRODUCTO_RETIRADO } from '@/shared/contratos/operaciones'
import { etiquetaDeOperacion } from './etiquetas'

describe('etiquetaDeOperacion', () => {
  it.each([
    ['STOCK_INICIAL', null, 'Stock inicial'],
    ['INGRESO', null, 'Llegó mercadería'],
    ['VENTA', null, 'Venta'],
    ['MERMA', 'Se derramó', 'Se derramó'],
    ['MERMA', 'Otro', 'Otro'],
    ['MERMA', null, 'Merma'],
    ['AJUSTE', MOTIVO_CONTEO, 'Conteo de stock'],
    ['AJUSTE', MOTIVO_PRODUCTO_RETIRADO, 'Producto retirado'],
    ['AJUSTE', null, 'Conteo de stock'],
    ['ANULACION', 'Me equivoqué', 'Anulado'],
  ] as const)('%s con motivo %s se muestra como "%s"', (tipo, motivo, etiqueta) => {
    expect(etiquetaDeOperacion(tipo, motivo)).toBe(etiqueta)
  })
})

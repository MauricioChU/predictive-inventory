import { describe, expect, it } from 'vitest'
import type { HojaDeExcel } from '../../domain/hojas-de-excel'
import { GeneradorDeExcelDelNavegador, LectorDeExcelDelNavegador } from './excel'

describe('Excel real (ida y vuelta, entrada de navegador bajo jsdom)', () => {
  it('RN-RE-01/07: lo que se genera se puede volver a leer como texto', async () => {
    const hojas: HojaDeExcel[] = [
      {
        nombre: 'Productos',
        columnas: ['nombre', 'precio de compra', 'stock'],
        filas: [
          [{ valor: 'Lejía 1 L' }, { valor: 2.4, formato: '0.00' }, { valor: 8, formato: '0.###' }],
        ],
      },
      { nombre: 'Otra', columnas: ['x'], filas: [] },
    ]
    const blob = await new GeneradorDeExcelDelNavegador().generar(hojas)
    const filas = await new LectorDeExcelDelNavegador().leerPrimeraHoja(blob)
    expect(filas).toEqual([
      ['nombre', 'precio de compra', 'stock'],
      ['Lejía 1 L', '2.4', '8'],
    ])
  })
})

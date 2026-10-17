import { describe, expect, it } from 'vitest'
import { ErrorDeDominio } from '../../../../shared/domain/errores'
import type { HojaDeExcel } from '../../domain/hojas-de-excel'
import { GeneradorDeExcelDelNavegador, LectorDeExcelDelNavegador } from './excel'

describe('Excel real (ida y vuelta, entrada de navegador bajo jsdom)', () => {
  it('RN-RE-01/07: lo que se genera se puede volver a leer como texto', async () => {
    const hojas: HojaDeExcel[] = [
      {
        nombre: 'Productos',
        columnas: ['nombre', 'precio de compra', 'stock'],
        filas: [[{ valor: 'Lejía 1 L' }, { valor: 2.4, formato: '0.00' }, { valor: 8 }]],
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

  it('prefiere la hoja "Productos" aunque no sea la primera', async () => {
    const hojas: HojaDeExcel[] = [
      { nombre: 'Instrucciones', columnas: ['columna'], filas: [[{ valor: 'x' }]] },
      { nombre: 'PRODUCTOS', columnas: ['nombre'], filas: [[{ valor: 'Jabón' }]] },
    ]
    const blob = await new GeneradorDeExcelDelNavegador().generar(hojas)
    expect(await new LectorDeExcelDelNavegador().leerPrimeraHoja(blob)).toEqual([
      ['nombre'],
      ['Jabón'],
    ])
  })

  it('sin hoja "Productos" lee la primera', async () => {
    const hojas: HojaDeExcel[] = [
      { nombre: 'Hoja1', columnas: ['nombre'], filas: [[{ valor: 'Jabón' }]] },
      { nombre: 'Otra', columnas: ['y'], filas: [] },
    ]
    const blob = await new GeneradorDeExcelDelNavegador().generar(hojas)
    expect((await new LectorDeExcelDelNavegador().leerPrimeraHoja(blob))[1]).toEqual(['Jabón'])
  })

  it('un archivo que no es un .xlsx da un error simple', async () => {
    const lector = new LectorDeExcelDelNavegador()
    const error = await lector.leerPrimeraHoja(new Blob(['no soy un excel'])).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorDeDominio)
    expect(error.codigo).toBe('EXCEL_INVALIDO')
    expect(error.message).toBe('Este archivo no es un Excel (.xlsx). Usa la plantilla.')
  })

  it('una celda vacía se lee como texto vacío', async () => {
    const hojas: HojaDeExcel[] = [
      { nombre: 'Productos', columnas: ['a', 'b'], filas: [[{ valor: 'x' }, { valor: '' }]] },
    ]
    const blob = await new GeneradorDeExcelDelNavegador().generar(hojas)
    const filas = await new LectorDeExcelDelNavegador().leerPrimeraHoja(blob)
    expect(filas[1]?.[0]).toBe('x')
    expect(filas[1]?.[1] ?? '').toBe('')
  })
})

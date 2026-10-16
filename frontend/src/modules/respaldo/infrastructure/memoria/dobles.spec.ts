import { describe, expect, it } from 'vitest'
import type { HojaDeExcel } from '../../domain/hojas-de-excel'
import {
  AlmacenamientoPersistenteEnMemoria,
  GeneradorDeExcelEnMemoria,
  LectorDeExcelEnMemoria,
} from './dobles'

describe('GeneradorDeExcelEnMemoria', () => {
  it('guarda las hojas recibidas y devuelve un Blob', async () => {
    const generador = new GeneradorDeExcelEnMemoria()
    const hojas: HojaDeExcel[] = [{ nombre: 'Productos', columnas: ['nombre'], filas: [] }]
    const blob = await generador.generar(hojas)
    expect(blob).toBeInstanceOf(Blob)
    expect(generador.hojasGeneradas).toBe(hojas)
  })
})

describe('LectorDeExcelEnMemoria', () => {
  it('devuelve las filas fijadas', async () => {
    const lector = new LectorDeExcelEnMemoria()
    lector.fijarFilas([['nombre'], ['Lejía 1 L']])
    expect(await lector.leerPrimeraHoja(new Blob())).toEqual([['nombre'], ['Lejía 1 L']])
  })

  it('empieza sin filas', async () => {
    const lector = new LectorDeExcelEnMemoria()
    expect(await lector.leerPrimeraHoja(new Blob())).toEqual([])
  })
})

describe('AlmacenamientoPersistenteEnMemoria', () => {
  it('devuelve el resultado fijado (concedido por defecto)', async () => {
    const almacenamiento = new AlmacenamientoPersistenteEnMemoria()
    expect(await almacenamiento.solicitar()).toBe(true)
  })

  it('se puede fijar como rechazado', async () => {
    const almacenamiento = new AlmacenamientoPersistenteEnMemoria()
    almacenamiento.fijarResultado(false)
    expect(await almacenamiento.solicitar()).toBe(false)
  })
})

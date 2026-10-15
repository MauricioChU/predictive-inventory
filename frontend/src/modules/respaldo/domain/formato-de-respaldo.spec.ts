import { describe, expect, it } from 'vitest'
import { Cantidad } from '../../../shared/domain/cantidad'
import type { OperacionRegistro, ProductoRegistro } from '../../../shared/contratos/registros'
import {
  crearRespaldo,
  leerRespaldo,
  resumenDeCopia,
  type DatosDelRespaldo,
} from './formato-de-respaldo'

function operacion(parciales: Partial<OperacionRegistro>): OperacionRegistro {
  return {
    id: 'op-1',
    tipo: 'VENTA',
    movimientos: [],
    productoIds: [],
    ocurridaEn: '2026-10-15T20:30:00.000Z',
    registradaEn: '2026-10-15T20:30:00.000Z',
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'dispositivo-1',
    ...parciales,
  }
}

function producto(parciales: Partial<ProductoRegistro>): ProductoRegistro {
  return {
    id: 'prod-1',
    nombre: 'Lejía 1 L',
    nombreNormalizado: 'lejia 1 l',
    categoriaId: 'cat-1',
    unidad: 'UNIDAD',
    precioCompra: 240,
    precioVenta: 350,
    stockMinimo: 3000,
    tieneFoto: false,
    estado: 'ACTIVO',
    creadoEn: '2026-10-01T00:00:00.000Z',
    actualizadoEn: '2026-10-01T00:00:00.000Z',
    ...parciales,
  }
}

const DATOS_VACIOS: DatosDelRespaldo = {
  configuracion: null,
  categorias: [],
  productos: [],
  operaciones: [],
  avisos: [],
  fotos: [],
}

describe('crearRespaldo (RN-RE-02)', () => {
  it('arma el control con la cantidad de productos, de operaciones y el stock por producto', () => {
    const datos: DatosDelRespaldo = {
      ...DATOS_VACIOS,
      productos: [producto({ id: 'lejia' }), producto({ id: 'carbon', nombre: 'Carbón' })],
      operaciones: [operacion({ id: 'op-1' }), operacion({ id: 'op-2' })],
    }
    const existencias = new Map([
      ['lejia', Cantidad.deMilesimas(10000)],
      ['carbon', Cantidad.deMilesimas(12500)],
    ])

    const respaldo = crearRespaldo(datos, existencias, '2026-10-15T20:30:00-05:00')

    expect(respaldo.versionDeFormato).toBe(1)
    expect(respaldo.app).toBe('predictive-inventory')
    expect(respaldo.creadoEn).toBe('2026-10-15T20:30:00-05:00')
    expect(respaldo.control).toEqual({
      productos: 2,
      operaciones: 2,
      stockPorProducto: { lejia: 10000, carbon: 12500 },
    })
    expect(respaldo.datos).toBe(datos)
  })

  it('no incluye existencias ni resúmenes diarios: solo lo que trae DatosDelRespaldo', () => {
    const respaldo = crearRespaldo(DATOS_VACIOS, new Map(), '2026-10-15T20:30:00-05:00')
    expect(Object.keys(respaldo.datos)).toEqual([
      'configuracion',
      'categorias',
      'productos',
      'operaciones',
      'avisos',
      'fotos',
    ])
  })
})

describe('leerRespaldo', () => {
  function respaldoValido() {
    return crearRespaldo(
      { ...DATOS_VACIOS, productos: [producto({})], operaciones: [operacion({})] },
      new Map([['prod-1', Cantidad.cero()]]),
      '2026-10-15T20:30:00-05:00',
    )
  }

  it('lee un respaldo válido', () => {
    const texto = JSON.stringify(respaldoValido())
    expect(leerRespaldo(texto).control.productos).toBe(1)
  })

  it('RN-RE-03: un JSON roto no es una copia válida', () => {
    expect(() => leerRespaldo('{ esto no es json')).toThrow(
      'Este archivo no es una copia válida de la app',
    )
  })

  it('RN-RE-03: un "app" ajeno no es una copia válida', () => {
    const ajeno = { ...respaldoValido(), app: 'otra-app' }
    expect(() => leerRespaldo(JSON.stringify(ajeno))).toThrow(
      'Este archivo no es una copia válida de la app',
    )
  })

  it('RN-RE-03: sin "datos" no es una copia válida', () => {
    const sinDatos = { ...respaldoValido() } as Record<string, unknown>
    delete sinDatos.datos
    expect(() => leerRespaldo(JSON.stringify(sinDatos))).toThrow(
      'Este archivo no es una copia válida de la app',
    )
  })

  it('RN-RE-03: sin "control" no es una copia válida', () => {
    const sinControl = { ...respaldoValido() } as Record<string, unknown>
    delete sinControl.control
    expect(() => leerRespaldo(JSON.stringify(sinControl))).toThrow(
      'Este archivo no es una copia válida de la app',
    )
  })

  it('RN-RE-04: control.productos que no coincide con el largo real no es una copia válida', () => {
    const dañado = respaldoValido()
    dañado.control.productos = 99
    expect(() => leerRespaldo(JSON.stringify(dañado))).toThrow(
      'Este archivo no es una copia válida de la app',
    )
  })

  it('RN-RE-04: control.operaciones que no coincide con el largo real no es una copia válida', () => {
    const dañado = respaldoValido()
    dañado.control.operaciones = 99
    expect(() => leerRespaldo(JSON.stringify(dañado))).toThrow(
      'Este archivo no es una copia válida de la app',
    )
  })

  it('RN-RE-05: una versión de formato más nueva se rechaza', () => {
    const futuro = { ...respaldoValido(), versionDeFormato: 2 }
    expect(() => leerRespaldo(JSON.stringify(futuro))).toThrow(
      'Actualiza la app para abrir este respaldo',
    )
  })
})

describe('resumenDeCopia (RN-RE-03)', () => {
  it('con operaciones: "152 productos, 3 840 movimientos, del 01/10/2026 al 15/12/2026"', () => {
    const control = { productos: 152, operaciones: 3840, stockPorProducto: {} }
    const operaciones = [
      operacion({ ocurridaEn: '2026-12-15T12:00:00.000Z' }),
      operacion({ ocurridaEn: '2026-10-01T06:00:00.000Z' }),
      operacion({ ocurridaEn: '2026-11-20T06:00:00.000Z' }),
    ]
    const resumen = resumenDeCopia(control, operaciones)
    expect(resumen.texto).toBe('152 productos, 3 840 movimientos, del 01/10/2026 al 15/12/2026')
    expect(resumen.desde).toBe('2026-10-01')
    expect(resumen.hasta).toBe('2026-12-15')
    expect(resumen.productos).toBe(152)
    expect(resumen.operaciones).toBe(3840)
  })

  it('sin operaciones: "N productos, sin movimientos"', () => {
    const control = { productos: 5, operaciones: 0, stockPorProducto: {} }
    const resumen = resumenDeCopia(control, [])
    expect(resumen.texto).toBe('5 productos, sin movimientos')
    expect(resumen.desde).toBeNull()
    expect(resumen.hasta).toBeNull()
  })
})

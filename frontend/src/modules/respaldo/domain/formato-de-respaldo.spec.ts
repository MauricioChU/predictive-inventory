import { describe, expect, it } from 'vitest'
import type { OperacionRegistro, ProductoRegistro } from '../../../shared/contratos/registros'
import {
  crearRespaldo,
  leerRespaldo,
  resumenDeCopia,
  type DatosDelRespaldo,
} from './formato-de-respaldo'

const INVALIDA = 'Este archivo no es una copia válida de la app'

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

function mov(productoId: string, cantidad: number) {
  return { productoId, cantidad, costoUnitario: 240, precioUnitario: null }
}

describe('crearRespaldo (RN-RE-02)', () => {
  it('el control sale del libro de operaciones: productos, operaciones y stock por producto', () => {
    const datos: DatosDelRespaldo = {
      ...DATOS_VACIOS,
      productos: [
        producto({ id: 'lejia' }),
        producto({ id: 'carbon', nombre: 'Carbón' }),
        producto({ id: 'sin-movimientos' }),
      ],
      operaciones: [
        operacion({ id: 'op-1', tipo: 'STOCK_INICIAL', movimientos: [mov('lejia', 10000)] }),
        operacion({ id: 'op-2', tipo: 'STOCK_INICIAL', movimientos: [mov('carbon', 12500)] }),
        operacion({ id: 'op-3', movimientos: [mov('lejia', -2000)] }),
      ],
    }

    const respaldo = crearRespaldo(datos, '2026-10-15T20:30:00-05:00')

    expect(respaldo.versionDeFormato).toBe(1)
    expect(respaldo.app).toBe('predictive-inventory')
    expect(respaldo.creadoEn).toBe('2026-10-15T20:30:00-05:00')
    expect(respaldo.control).toEqual({
      productos: 3,
      operaciones: 3,
      stockPorProducto: { lejia: 8000, carbon: 12500, 'sin-movimientos': 0 },
    })
    expect(respaldo.datos).toBe(datos)
  })

  it('no incluye existencias ni resúmenes diarios: solo lo que trae DatosDelRespaldo', () => {
    const respaldo = crearRespaldo(DATOS_VACIOS, '2026-10-15T20:30:00-05:00')
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

function respaldoValido() {
  return crearRespaldo(
    {
      configuracion: {
        clave: 'negocio',
        nombreTienda: 'Bodega Rosita',
        diasEntreCompras: 7,
        diasAnticipacion: 3,
        diasMaximosDeCompra: 30,
        tamanoDeLetra: 'GRANDE',
        notificacionesActivas: false,
      },
      categorias: [{ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' }],
      productos: [producto({})],
      operaciones: [
        operacion({
          tipo: 'STOCK_INICIAL',
          productoIds: ['prod-1'],
          movimientos: [mov('prod-1', 1000)],
        }),
      ],
      avisos: [{ productoId: 'prod-1', ultimoEstadoAvisado: 'NORMAL' }],
      fotos: [{ productoId: 'prod-1', tipo: 'image/png', base64: 'AAAA' }],
    },
    '2026-10-15T20:30:00-05:00',
  )
}

type Plano = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

describe('leerRespaldo', () => {
  it('lee un respaldo válido completo', () => {
    const leido = leerRespaldo(JSON.stringify(respaldoValido()))
    expect(leido.control.productos).toBe(1)
    expect(leido.datos.configuracion?.nombreTienda).toBe('Bodega Rosita')
  })

  it('un JSON roto, o que no es un objeto, no es una copia válida', () => {
    expect(() => leerRespaldo('{ esto no es json')).toThrow(INVALIDA)
    expect(() => leerRespaldo('[1,2]')).toThrow(INVALIDA)
  })

  it('un "app" ajeno no es una copia válida', () => {
    expect(() => leerRespaldo(JSON.stringify({ ...respaldoValido(), app: 'otra-app' }))).toThrow(
      INVALIDA,
    )
  })

  it.each<[string, (r: Plano) => void]>([
    ['sin datos', (r) => delete r.datos],
    ['sin control', (r) => delete r.control],
    ['sin datos.categorias', (r) => delete r.datos.categorias],
    ['avisos que no es arreglo', (r) => (r.datos.avisos = {})],
    ['fotos que no es arreglo', (r) => (r.datos.fotos = 'x')],
    ['sin control.stockPorProducto', (r) => delete r.control.stockPorProducto],
    ['stockPorProducto con decimales', (r) => (r.control.stockPorProducto['prod-1'] = 1.5)],
    ['stockPorProducto que es un arreglo', (r) => (r.control.stockPorProducto = [])],
    ['control.productos que no coincide', (r) => (r.control.productos = 99)],
    ['control.operaciones que no coincide', (r) => (r.control.operaciones = 99)],
    ['ocurridaEn que no es fecha', (r) => (r.datos.operaciones[0].ocurridaEn = 'ayer')],
    ['creadoEn que no es fecha', (r) => (r.creadoEn = 'hoy')],
    ['precioVenta "tres soles"', (r) => (r.datos.productos[0].precioVenta = 'tres soles')],
    ['stockMinimo decimal', (r) => (r.datos.productos[0].stockMinimo = 1.5)],
    ['unidad desconocida', (r) => (r.datos.productos[0].unidad = 'CAJA')],
    ['estado desconocido', (r) => (r.datos.productos[0].estado = 'BORRADO')],
    ['producto sin nombre', (r) => delete r.datos.productos[0].nombre],
    ['tipo de operación desconocido', (r) => (r.datos.operaciones[0].tipo = 'RARO')],
    [
      'movimiento con cantidad decimal',
      (r) => (r.datos.operaciones[0].movimientos[0].cantidad = 0.5),
    ],
    ['movimientos que no es arreglo', (r) => (r.datos.operaciones[0].movimientos = null)],
    ['operación sin dispositivoId', (r) => delete r.datos.operaciones[0].dispositivoId],
    ['aviso con estado desconocido', (r) => (r.datos.avisos[0].ultimoEstadoAvisado = 'X')],
    ['foto sin base64', (r) => delete r.datos.fotos[0].base64],
    ['categoría sin id', (r) => delete r.datos.categorias[0].id],
    ['configuracion con clave "sistema"', (r) => (r.datos.configuracion.clave = 'sistema')],
    ['configuracion con días de texto', (r) => (r.datos.configuracion.diasEntreCompras = '7')],
    ['configuracion que no es objeto', (r) => (r.datos.configuracion = 5)],
  ])('copia dañada: %s', (_nombre, danar) => {
    const r = JSON.parse(JSON.stringify(respaldoValido())) as Plano
    danar(r)
    expect(() => leerRespaldo(JSON.stringify(r))).toThrow(INVALIDA)
  })

  it('RN-RE-05: una versión de formato más nueva se rechaza', () => {
    const futuro = { ...respaldoValido(), versionDeFormato: 2 }
    expect(() => leerRespaldo(JSON.stringify(futuro))).toThrow(
      'Actualiza la app para abrir este respaldo',
    )
  })

  it('RN-RE-05: una versión 2 con otra estructura (sin control) también pide actualizar', () => {
    const futuro = { versionDeFormato: 2, app: 'predictive-inventory', cosas: [] }
    expect(() => leerRespaldo(JSON.stringify(futuro))).toThrow(
      'Actualiza la app para abrir este respaldo',
    )
  })

  it('RN-RE-05: una versión sin número no es válida', () => {
    expect(() =>
      leerRespaldo(JSON.stringify({ ...respaldoValido(), versionDeFormato: 'uno' })),
    ).toThrow(INVALIDA)
  })

  it('RN-RE-05: una versión anterior se migra (identidad) y se sigue validando', () => {
    const r = leerRespaldo(JSON.stringify({ ...respaldoValido(), versionDeFormato: 0 }))
    expect(r.control.productos).toBe(1)
  })

  it('acepta configuracion null', () => {
    const r = JSON.parse(JSON.stringify(respaldoValido())) as Plano
    r.datos.configuracion = null
    expect(leerRespaldo(JSON.stringify(r)).datos.configuracion).toBeNull()
  })
})

describe('resumenDeCopia (RN-RE-03)', () => {
  it('con operaciones: "152 productos, 3 840 movimientos, del 01/10/2026 al 15/12/2026"', () => {
    const control = { productos: 152, operaciones: 3840 }
    const operaciones = [
      operacion({ ocurridaEn: '2026-12-15T12:00:00.000Z' }),
      operacion({ ocurridaEn: '2026-10-01T06:00:00.000Z' }),
      operacion({ ocurridaEn: '2026-11-20T06:00:00.000Z' }),
    ]
    const resumen = resumenDeCopia(control, operaciones)
    expect(resumen.texto).toBe('152 productos, 3 840 movimientos, del 01/10/2026 al 15/12/2026')
    expect(resumen.desde).toBe('2026-10-01')
    expect(resumen.hasta).toBe('2026-12-15')
  })

  it('usa el día de Lima, no el de UTC (2026-10-16T03:00Z es el 15/10 en Lima)', () => {
    const resumen = resumenDeCopia({ productos: 2, operaciones: 1 }, [
      operacion({ ocurridaEn: '2026-10-16T03:00:00.000Z' }),
    ])
    expect(resumen.texto).toBe('2 productos, 1 movimiento, del 15/10/2026 al 15/10/2026')
  })

  it('singular: "1 producto, 1 movimiento"', () => {
    const resumen = resumenDeCopia({ productos: 1, operaciones: 1 }, [operacion({})])
    expect(resumen.texto).toBe('1 producto, 1 movimiento, del 15/10/2026 al 15/10/2026')
  })

  it('sin operaciones: "N productos, sin movimientos"', () => {
    const resumen = resumenDeCopia({ productos: 5, operaciones: 0 }, [])
    expect(resumen.texto).toBe('5 productos, sin movimientos')
    expect(resumen.desde).toBeNull()
    expect(resumen.hasta).toBeNull()
    expect(resumenDeCopia({ productos: 1, operaciones: 0 }, []).texto).toBe(
      '1 producto, sin movimientos',
    )
  })
})

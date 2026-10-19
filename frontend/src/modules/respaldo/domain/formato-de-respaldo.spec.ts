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

    expect(respaldo.versionDeFormato).toBe(2)
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
        alquilerDelLocal: null,
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
    const futuro = { ...respaldoValido(), versionDeFormato: 3 }
    expect(() => leerRespaldo(JSON.stringify(futuro))).toThrow(
      'Actualiza la app para abrir este respaldo',
    )
  })

  it('RN-RE-05: una versión 3 con otra estructura (sin control) también pide actualizar', () => {
    const futuro = { versionDeFormato: 3, app: 'predictive-inventory', cosas: [] }
    expect(() => leerRespaldo(JSON.stringify(futuro))).toThrow(
      'Actualiza la app para abrir este respaldo',
    )
  })

  it('RN-RE-05: una versión sin número no es válida', () => {
    expect(() =>
      leerRespaldo(JSON.stringify({ ...respaldoValido(), versionDeFormato: 'uno' })),
    ).toThrow(INVALIDA)
  })

  it('RN-RE-05: la versión 2 (la de esta app) se lee tal cual', () => {
    expect(leerRespaldo(JSON.stringify(respaldoValido())).versionDeFormato).toBe(2)
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

type AlquilerPlano = Record<string, unknown>

function conAlquiler(alquiler: unknown): string {
  const r = JSON.parse(JSON.stringify(respaldoValido())) as Plano
  r.datos.configuracion.alquilerDelLocal = alquiler
  return JSON.stringify(r)
}

function copiaV1(): Plano {
  const r = JSON.parse(JSON.stringify(respaldoValido())) as Plano
  r.versionDeFormato = 1
  delete r.datos.configuracion.alquilerDelLocal
  return r
}

describe('leerRespaldo: costo del local (RN-RE-11)', () => {
  it('una copia de la versión 1 se migra con el local sin configurar (null) y queda en la 2', () => {
    const leida = leerRespaldo(JSON.stringify(copiaV1()))
    expect(leida.versionDeFormato).toBe(2)
    expect(leida.datos.configuracion?.alquilerDelLocal).toBeNull()
  })

  it('una copia de la versión 1 sin configuración también se lee', () => {
    const r = copiaV1()
    r.datos.configuracion = null
    const leida = leerRespaldo(JSON.stringify(r))
    expect(leida.versionDeFormato).toBe(2)
    expect(leida.datos.configuracion).toBeNull()
  })

  it('una copia de la versión 1 con otra cosa dañada sigue siendo inválida', () => {
    const r = copiaV1()
    r.datos.productos = 'no son productos'
    expect(() => leerRespaldo(JSON.stringify(r))).toThrow(INVALIDA)
  })

  it.each<[string, AlquilerPlano | null]>([
    ['sin configurar (null)', null],
    ['NO_PAGA', { tipo: 'NO_PAGA' }],
    ['MENSUAL', { tipo: 'MENSUAL', montoCentimos: 120000, dias: [31] }],
    ['QUINCENAL', { tipo: 'QUINCENAL', montoCentimos: 60000, dias: [5, 20] }],
    ['el monto máximo', { tipo: 'MENSUAL', montoCentimos: 9_999_999, dias: [1] }],
  ])('acepta el local %s y lo conserva', (_nombre, alquiler) => {
    const leida = leerRespaldo(conAlquiler(alquiler))
    expect(leida.datos.configuracion?.alquilerDelLocal).toEqual(alquiler)
  })

  it('ida y vuelta: crear y leer conserva el QUINCENAL de S/ 600.00 con días 5 y 20', () => {
    const original = respaldoValido()
    const datos = {
      ...original.datos,
      configuracion: {
        ...original.datos.configuracion!,
        alquilerDelLocal: { tipo: 'QUINCENAL', montoCentimos: 60000, dias: [5, 20] },
      },
    } as DatosDelRespaldo
    const texto = JSON.stringify(crearRespaldo(datos, '2026-10-15T20:30:00-05:00'))
    expect(leerRespaldo(texto).datos.configuracion?.alquilerDelLocal).toEqual({
      tipo: 'QUINCENAL',
      montoCentimos: 60000,
      dias: [5, 20],
    })
  })

  it.each<[string, unknown]>([
    ['la clave falta en una copia 2', undefined],
    ['no es un objeto', 5],
    ['es un texto', 'QUINCENAL'],
    ['es una lista', []],
    ['el tipo no existe', { tipo: 'SEMANAL', montoCentimos: 100, dias: [1] }],
    ['no trae tipo', { montoCentimos: 100, dias: [1] }],
    ['el monto es 0', { tipo: 'MENSUAL', montoCentimos: 0, dias: [5] }],
    ['el monto es negativo', { tipo: 'MENSUAL', montoCentimos: -1, dias: [5] }],
    ['el monto pasa del máximo', { tipo: 'MENSUAL', montoCentimos: 10_000_000, dias: [5] }],
    ['el monto tiene decimales', { tipo: 'MENSUAL', montoCentimos: 100.5, dias: [5] }],
    ['el monto es texto', { tipo: 'MENSUAL', montoCentimos: '600', dias: [5] }],
    ['el monto falta', { tipo: 'MENSUAL', dias: [5] }],
    ['los días faltan', { tipo: 'MENSUAL', montoCentimos: 100 }],
    ['los días no son una lista', { tipo: 'MENSUAL', montoCentimos: 100, dias: 5 }],
    ['los días están vacíos', { tipo: 'MENSUAL', montoCentimos: 100, dias: [] }],
    ['los días de un MENSUAL son dos', { tipo: 'MENSUAL', montoCentimos: 100, dias: [5, 20] }],
    ['los días de un QUINCENAL son uno', { tipo: 'QUINCENAL', montoCentimos: 100, dias: [5] }],
    [
      'los días de un QUINCENAL son iguales',
      { tipo: 'QUINCENAL', montoCentimos: 100, dias: [5, 5] },
    ],
    ['un día es 0', { tipo: 'MENSUAL', montoCentimos: 100, dias: [0] }],
    ['un día es 32', { tipo: 'MENSUAL', montoCentimos: 100, dias: [32] }],
    ['un día es decimal', { tipo: 'MENSUAL', montoCentimos: 100, dias: [5.5] }],
    ['un día es texto', { tipo: 'MENSUAL', montoCentimos: 100, dias: ['5'] }],
    ['un día es nulo', { tipo: 'QUINCENAL', montoCentimos: 100, dias: [5, null] }],
  ])('rechaza una copia 2 cuando %s', (_nombre, alquiler) => {
    const r = JSON.parse(JSON.stringify(respaldoValido())) as Plano
    if (alquiler === undefined) delete r.datos.configuracion.alquilerDelLocal
    else r.datos.configuracion.alquilerDelLocal = alquiler
    expect(() => leerRespaldo(JSON.stringify(r))).toThrow(INVALIDA)
  })
})

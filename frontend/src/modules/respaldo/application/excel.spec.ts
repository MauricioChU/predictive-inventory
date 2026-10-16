import { describe, expect, it } from 'vitest'
import { Cantidad } from '../../../shared/domain/cantidad'
import { Dinero } from '../../../shared/domain/dinero'
import { RelojFijo } from '../../../shared/domain/reloj'
import { instanteLocal } from '../../../shared/domain/fecha'
import { AlmacenEnMemoria } from '../../../shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '../../../shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import type { OperacionRegistro } from '../../../shared/contratos/registros'
import { AlmacenDeRespaldoEnMemoria } from '../infrastructure/memoria/almacen-de-respaldo'
import {
  AlmacenamientoPersistenteEnMemoria,
  GeneradorDeExcelEnMemoria,
  LectorDeExcelEnMemoria,
} from '../infrastructure/memoria/dobles'
import {
  AnalisisDePrueba,
  CatalogoDePrueba,
  InventarioDePrueba,
  ReconstructorDePrueba,
  TiendaDePrueba,
} from './__pruebas__/dobles'
import { descargarPlantilla, exportarExcel } from './excel'
import type { DependenciasDeRespaldo } from './puertos'

function venta(parciales: Partial<OperacionRegistro>): OperacionRegistro {
  return {
    id: 'op',
    tipo: 'VENTA',
    movimientos: [],
    productoIds: [],
    ocurridaEn: '2026-10-15T20:00:00.000Z',
    registradaEn: '2026-10-15T20:00:00.000Z',
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'dispositivo-1',
    ...parciales,
  }
}

function crearContexto() {
  const almacenEnMemoria = new AlmacenEnMemoria()
  const uow = new UnidadDeTrabajoEnMemoria(almacenEnMemoria)
  const inventario = new InventarioDePrueba(almacenEnMemoria)
  const tienda = new TiendaDePrueba()
  const catalogo = new CatalogoDePrueba()
  const analisis = new AnalisisDePrueba()
  const reloj = new RelojFijo(instanteLocal('2026-10-15 20:30'))
  const generadorDeExcel = new GeneradorDeExcelEnMemoria()

  tienda.fijarConfiguracion({ nombreTienda: 'Bodega Rosita' })

  const deps: DependenciasDeRespaldo = {
    almacen: new AlmacenDeRespaldoEnMemoria(almacenEnMemoria),
    reconstructor: new ReconstructorDePrueba(almacenEnMemoria),
    generadorDeExcel,
    lectorDeExcel: new LectorDeExcelEnMemoria(),
    almacenamiento: new AlmacenamientoPersistenteEnMemoria(),
    uow,
    reloj,
    catalogo: () => catalogo,
    inventario: () => inventario,
    analisis: () => analisis,
    tienda: () => tienda,
  }

  return { deps, almacenEnMemoria, catalogo, analisis, reloj }
}

describe('exportarExcel (RN-RE-01)', () => {
  it('arma el inventario con Lejía vendida 2, sus movimientos y el resumen del día', async () => {
    const { deps, almacenEnMemoria, catalogo, analisis } = crearContexto()

    const categoriaOtros = { id: 'cat-otros', nombre: 'Otros', nombreNormalizado: 'otros' }
    catalogo.agregarProducto({
      id: 'lejia',
      nombre: 'Lejía 1 L',
      categoriaId: categoriaOtros.id,
      categoriaNombre: categoriaOtros.nombre,
      unidad: 'UNIDAD',
      precioCompra: Dinero.deTexto('2.40'),
      precioVenta: Dinero.deTexto('3.50'),
      stockMinimo: Cantidad.deEntero(3),
    })
    catalogo.agregarProducto({
      id: 'carbon',
      nombre: 'Carbón',
      categoriaId: categoriaOtros.id,
      categoriaNombre: categoriaOtros.nombre,
      unidad: 'KILO',
      precioCompra: Dinero.deTexto('2.75'),
      precioVenta: Dinero.deTexto('4.00'),
      stockMinimo: Cantidad.deEntero(3),
    })
    analisis.fijarEstado('lejia', 'NORMAL')
    analisis.fijarEstado('carbon', 'NORMAL')
    analisis.resumenesDisponibles = [
      {
        dia: '2026-10-15',
        ventas: Dinero.deTexto('7.00'),
        costoVendido: Dinero.deTexto('4.80'),
        gananciaBruta: Dinero.deTexto('2.20'),
        mermas: Dinero.cero(),
        gananciaNeta: Dinero.deTexto('2.20'),
        diferenciasDeConteo: Dinero.cero(),
      },
    ]

    almacenEnMemoria.guardar('existencias', { productoId: 'lejia', cantidad: 8000 })
    almacenEnMemoria.guardar('existencias', { productoId: 'carbon', cantidad: 12500 })
    almacenEnMemoria.guardar(
      'operaciones',
      venta({
        id: 'op-stock-lejia',
        tipo: 'STOCK_INICIAL',
        ocurridaEn: '2026-10-01T05:00:00.000Z',
        productoIds: ['lejia'],
        movimientos: [
          { productoId: 'lejia', cantidad: 10000, costoUnitario: 240, precioUnitario: null },
        ],
      }),
    )
    almacenEnMemoria.guardar(
      'operaciones',
      venta({
        id: 'op-stock-carbon',
        tipo: 'STOCK_INICIAL',
        ocurridaEn: '2026-10-01T05:00:00.000Z',
        productoIds: ['carbon'],
        movimientos: [
          { productoId: 'carbon', cantidad: 12500, costoUnitario: 275, precioUnitario: null },
        ],
      }),
    )
    almacenEnMemoria.guardar(
      'operaciones',
      venta({
        id: 'op-venta-lejia',
        productoIds: ['lejia'],
        movimientos: [
          { productoId: 'lejia', cantidad: -2000, costoUnitario: 240, precioUnitario: 350 },
        ],
      }),
    )

    const archivo = await exportarExcel(deps)

    expect(archivo.nombre).toBe('inventario-bodega-rosita-2026-10-15.xlsx')
    expect(archivo.hojas.map((h) => h.nombre)).toEqual([
      'Productos',
      'Movimientos',
      'Resumen diario',
    ])

    const filaLejia = archivo.hojas[0]!.filas.find((f) => f[0]?.valor === 'Lejía 1 L')
    expect(filaLejia).toEqual([
      { valor: 'Lejía 1 L' },
      { valor: 'Otros' },
      { valor: 'unid.' },
      { valor: 2.4, formato: '0.00' },
      { valor: 3.5, formato: '0.00' },
      { valor: 8 },
      { valor: 3 },
      { valor: 'Bien' },
      { valor: 'activo' },
    ])

    expect(archivo.hojas[1]!.filas).toHaveLength(3)

    expect(archivo.hojas[2]!.filas).toEqual([
      [
        { valor: '15/10/2026' },
        { valor: 7, formato: '0.00' },
        { valor: 2.2, formato: '0.00' },
        { valor: 0, formato: '0.00' },
        { valor: 2.2, formato: '0.00' },
      ],
    ])
  })

  it('usa resumenesDeTienda(hoy-89, hoy): los últimos 90 días', async () => {
    const { deps, analisis } = crearContexto()
    let rango: [string, string] | null = null
    analisis.resumenesDeTienda = async (desde: string, hasta: string) => {
      rango = [desde, hasta]
      return []
    }

    await exportarExcel(deps)

    expect(rango).toEqual(['2026-07-18', '2026-10-15'])
  })
})

describe('descargarPlantilla (RN-RE-07)', () => {
  it('genera un archivo con las hojas de la plantilla', async () => {
    const { deps } = crearContexto()
    const archivo = await descargarPlantilla(deps)
    expect(archivo.hojas.map((h) => h.nombre)).toEqual(['Productos', 'Instrucciones'])
    expect(archivo.hojas[0]!.columnas).toEqual([
      'nombre',
      'categoría',
      'unidad',
      'precio de compra',
      'precio de venta',
      'stock mínimo',
      'stock inicial',
    ])
  })
})

describe('exportarExcel: movimientos y productos archivados', () => {
  it('muestra tipo como en pantalla, importe, anulada y nota de cada movimiento', async () => {
    const { deps, almacenEnMemoria, catalogo } = crearContexto()
    catalogo.agregarProducto({
      id: 'lejia',
      nombre: 'Lejía 1 L',
      categoriaId: 'c',
      categoriaNombre: 'Otros',
    })
    const op = (id: string, parciales: Partial<OperacionRegistro>) =>
      almacenEnMemoria.guardar('operaciones', venta({ id, productoIds: ['lejia'], ...parciales }))
    op('v1', {
      movimientos: [
        { productoId: 'lejia', cantidad: -2000, costoUnitario: 240, precioUnitario: 350 },
      ],
    })
    op('a1', {
      tipo: 'ANULACION',
      anulaA: 'v1',
      movimientos: [
        { productoId: 'lejia', cantidad: 2000, costoUnitario: 240, precioUnitario: null },
      ],
    })
    op('i1', {
      tipo: 'INGRESO',
      nota: 'Del mayorista',
      movimientos: [
        { productoId: 'lejia', cantidad: 5500, costoUnitario: 240, precioUnitario: null },
      ],
    })
    op('m1', {
      tipo: 'MERMA',
      motivo: 'Se derramó',
      movimientos: [
        { productoId: 'lejia', cantidad: -500, costoUnitario: 240, precioUnitario: null },
      ],
    })
    op('x1', {
      movimientos: [
        { productoId: 'desconocido', cantidad: -1000, costoUnitario: 100, precioUnitario: 150 },
      ],
    })

    const filas = (await exportarExcel(deps)).hojas[1]!.filas
    const resumen = filas.map((f) => ({
      tipo: f[1]!.valor,
      producto: f[2]!.valor,
      cantidad: f[3]!.valor,
      importe: f[6]!.valor,
      anulada: f[7]!.valor,
      nota: f[8]!.valor,
    }))
    expect(resumen).toEqual([
      { tipo: 'Venta', producto: 'Lejía 1 L', cantidad: -2, importe: 7, anulada: 'sí', nota: '' },
      {
        tipo: 'Anulado',
        producto: 'Lejía 1 L',
        cantidad: 2,
        importe: 4.8,
        anulada: 'no',
        nota: '',
      },
      {
        tipo: 'Llegó mercadería',
        producto: 'Lejía 1 L',
        cantidad: 5.5,
        importe: 13.2,
        anulada: 'no',
        nota: 'Del mayorista',
      },
      {
        tipo: 'Se derramó',
        producto: 'Lejía 1 L',
        cantidad: -0.5,
        importe: 1.2,
        anulada: 'no',
        nota: '',
      },
      { tipo: 'Venta', producto: '', cantidad: -1, importe: 1.5, anulada: 'no', nota: '' },
    ])
    expect(filas[0]![3]).toEqual({ valor: -2 })
  })

  it('un producto archivado sale sin estado de stock y con stock 0 si no tiene existencia', async () => {
    const { deps, catalogo } = crearContexto()
    catalogo.agregarProducto({
      id: 'viejo',
      nombre: 'Viejo',
      categoriaId: 'c',
      categoriaNombre: 'Otros',
      activo: false,
    })
    const fila = (await exportarExcel(deps)).hojas[0]!.filas[0]!
    expect(fila[5]).toEqual({ valor: 0 })
    expect(fila[7]).toEqual({ valor: '' })
    expect(fila[8]).toEqual({ valor: 'archivado' })
  })

  it('usa el día de Lima: 2026-10-16T03:00Z es el 15/10 (nombre y rango de 90 días)', async () => {
    const { deps, analisis, reloj } = crearContexto()
    reloj.fijar('2026-10-16T03:00:00.000Z')
    let rango: [string, string] | null = null
    analisis.resumenesDeTienda = async (desde: string, hasta: string) => {
      rango = [desde, hasta]
      return []
    }
    const archivo = await exportarExcel(deps)
    expect(archivo.nombre).toBe('inventario-bodega-rosita-2026-10-15.xlsx')
    expect(rango).toEqual(['2026-07-18', '2026-10-15'])
  })
})

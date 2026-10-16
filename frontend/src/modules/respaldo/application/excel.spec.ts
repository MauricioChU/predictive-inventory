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

  return { deps, almacenEnMemoria, catalogo, analisis }
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
      { valor: 8, formato: '0.###' },
      { valor: 3, formato: '0.###' },
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

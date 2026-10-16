import { describe, expect, it } from 'vitest'
import { RelojFijo } from '../../../shared/domain/reloj'
import { instanteLocal } from '../../../shared/domain/fecha'
import { AlmacenEnMemoria } from '../../../shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '../../../shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import type { OperacionRegistro, ProductoRegistro } from '../../../shared/contratos/registros'
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
import type { DependenciasDeRespaldo } from './puertos'
import {
  CONFIRMACIONES_PARA_RESTAURAR,
  guardarCopia,
  prepararRestauracion,
  restaurarCopia,
} from './copia'

function producto(parciales: Partial<ProductoRegistro>): ProductoRegistro {
  return {
    id: 'prod',
    nombre: 'Producto',
    nombreNormalizado: 'producto',
    categoriaId: 'cat-1',
    unidad: 'UNIDAD',
    precioCompra: 100,
    precioVenta: 200,
    stockMinimo: 3000,
    tieneFoto: false,
    estado: 'ACTIVO',
    creadoEn: '2026-10-01T00:00:00.000Z',
    actualizadoEn: '2026-10-01T00:00:00.000Z',
    ...parciales,
  }
}

function stockInicial(parciales: Partial<OperacionRegistro>): OperacionRegistro {
  return {
    id: 'op',
    tipo: 'STOCK_INICIAL',
    movimientos: [],
    productoIds: [],
    ocurridaEn: '2026-10-01T05:00:00.000Z',
    registradaEn: '2026-10-01T05:00:00.000Z',
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
  const reconstructor = new ReconstructorDePrueba(almacenEnMemoria)
  const inventario = new InventarioDePrueba(almacenEnMemoria)
  const tienda = new TiendaDePrueba()
  const catalogo = new CatalogoDePrueba()
  const analisis = new AnalisisDePrueba()
  const reloj = new RelojFijo(instanteLocal('2026-10-15 20:30'))

  tienda.fijarConfiguracion({ nombreTienda: 'Bodega Rosita' })

  const deps: DependenciasDeRespaldo = {
    almacen: new AlmacenDeRespaldoEnMemoria(almacenEnMemoria),
    reconstructor,
    generadorDeExcel: new GeneradorDeExcelEnMemoria(),
    lectorDeExcel: new LectorDeExcelEnMemoria(),
    almacenamiento: new AlmacenamientoPersistenteEnMemoria(),
    uow,
    reloj,
    catalogo: () => catalogo,
    inventario: () => inventario,
    analisis: () => analisis,
    tienda: () => tienda,
  }

  function seedProductosYOperaciones(): void {
    almacenEnMemoria.guardar('productos', producto({ id: 'lejia', nombre: 'Lejía 1 L' }))
    almacenEnMemoria.guardar(
      'productos',
      producto({ id: 'carbon', nombre: 'Carbón', unidad: 'KILO' }),
    )
    almacenEnMemoria.guardar(
      'operaciones',
      stockInicial({
        id: 'op-lejia',
        productoIds: ['lejia'],
        movimientos: [
          { productoId: 'lejia', cantidad: 10000, costoUnitario: 240, precioUnitario: null },
        ],
      }),
    )
    almacenEnMemoria.guardar(
      'operaciones',
      stockInicial({
        id: 'op-carbon',
        productoIds: ['carbon'],
        movimientos: [
          { productoId: 'carbon', cantidad: 12500, costoUnitario: 275, precioUnitario: null },
        ],
      }),
    )
  }

  return { deps, almacenEnMemoria, reconstructor, tienda, reloj, seedProductosYOperaciones }
}

describe('guardarCopia (RN-RE-02)', () => {
  it('genera "respaldo-bodega-rosita-2026-10-15-2030.json" y actualiza ultimoRespaldoEn', async () => {
    const { deps, seedProductosYOperaciones, reconstructor, tienda, reloj } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()

    const archivo = await guardarCopia(deps)

    expect(archivo.nombre).toBe('respaldo-bodega-rosita-2026-10-15-2030.json')
    expect(archivo.tipo).toBe('application/json')

    const estado = await tienda.estadoDelSistema()
    expect(estado.ultimoRespaldoEn).toBe(reloj.ahora())
  })

  it('el contenido tiene el control con 2 productos, 2 operaciones y el stock de Carbón', async () => {
    const { deps, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()

    const archivo = await guardarCopia(deps)
    const respaldo = JSON.parse(await archivo.contenido.text())

    expect(respaldo.control.productos).toBe(2)
    expect(respaldo.control.operaciones).toBe(2)
    expect(respaldo.control.stockPorProducto.carbon).toBe(12500)
  })
})

describe('prepararRestauracion / restaurarCopia (RN-RE-03)', () => {
  it('prepararRestauracion devuelve el resumen y las dos confirmaciones', async () => {
    const { deps, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    const archivo = await guardarCopia(deps)
    const texto = await archivo.contenido.text()

    const { resumen, confirmaciones } = await prepararRestauracion(deps, texto)

    expect(resumen.productos).toBe(2)
    expect(confirmaciones).toEqual(CONFIRMACIONES_PARA_RESTAURAR)
  })

  it('restaurarCopia con menos de 2 confirmaciones rechaza y no toca nada', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    const archivo = await guardarCopia(deps)
    const texto = await archivo.contenido.text()

    almacenEnMemoria.guardar('productos', producto({ id: 'agregado-despues', nombre: 'Nuevo' }))

    await expect(restaurarCopia(deps, texto, { confirmaciones: 1 })).rejects.toThrow(
      'Confirma dos veces para restaurar',
    )
    expect(almacenEnMemoria.todos('productos')).toHaveLength(3)
  })

  it('restaurarCopia con 2 confirmaciones reemplaza los datos', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    const archivo = await guardarCopia(deps)
    const texto = await archivo.contenido.text()

    almacenEnMemoria.guardar('productos', producto({ id: 'agregado-despues', nombre: 'Nuevo' }))
    expect(almacenEnMemoria.todos('productos')).toHaveLength(3)

    await restaurarCopia(deps, texto, { confirmaciones: 2 })

    expect(almacenEnMemoria.todos('productos')).toHaveLength(2)
    expect(
      almacenEnMemoria
        .todos('productos')
        .map((p) => p.id)
        .sort(),
    ).toEqual(['carbon', 'lejia'])
  })

  it('RN-RE-03: una copia dañada no toca los datos actuales', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()

    await expect(restaurarCopia(deps, '{ esto no es json', { confirmaciones: 2 })).rejects.toThrow(
      'Este archivo no es una copia válida de la app',
    )

    expect(almacenEnMemoria.todos('productos')).toHaveLength(2)
  })

  it('RN-RE-04: si el control no coincide tras reconstruir, se revierte todo', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()

    const copiaConControlIncorrecto = {
      versionDeFormato: 1,
      app: 'predictive-inventory',
      creadoEn: '2026-10-15T20:30:00-05:00',
      control: { productos: 1, operaciones: 1, stockPorProducto: { carbon: 99000 } },
      datos: {
        configuracion: null,
        categorias: [],
        productos: [producto({ id: 'carbon', nombre: 'Carbón', unidad: 'KILO' })],
        operaciones: [
          stockInicial({
            id: 'op-carbon-2',
            productoIds: ['carbon'],
            movimientos: [
              { productoId: 'carbon', cantidad: 12500, costoUnitario: 275, precioUnitario: null },
            ],
          }),
        ],
        avisos: [],
        fotos: [],
      },
    }

    await expect(
      restaurarCopia(deps, JSON.stringify(copiaConControlIncorrecto), { confirmaciones: 2 }),
    ).rejects.toThrow('La copia tiene datos que no cuadran. No se cambió nada')

    // Todo vuelve como estaba: los 2 productos originales, no el de la copia rota.
    expect(
      almacenEnMemoria
        .todos('productos')
        .map((p) => p.id)
        .sort(),
    ).toEqual(['carbon', 'lejia'])
    expect(almacenEnMemoria.todos('operaciones')).toHaveLength(2)
  })
})

import { describe, expect, it, vi } from 'vitest'
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
  marcarCopiaGuardada,
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
    almacen: new AlmacenDeRespaldoEnMemoria(almacenEnMemoria, uow),
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
    almacenEnMemoria.guardar('categorias', {
      id: 'cat-1',
      nombre: 'Otros',
      nombreNormalizado: 'otros',
    })
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

  return { deps, almacenEnMemoria, reconstructor, tienda, reloj, uow, seedProductosYOperaciones }
}

describe('guardarCopia (RN-RE-02)', () => {
  it('genera "respaldo-bodega-rosita-2026-10-15-2030.json" y NO marca todavía el último respaldo', async () => {
    const { deps, seedProductosYOperaciones, reconstructor, tienda } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()

    const archivo = await guardarCopia(deps)

    expect(archivo.nombre).toBe('respaldo-bodega-rosita-2026-10-15-2030.json')
    expect(archivo.tipo).toBe('application/json')

    const estado = await tienda.estadoDelSistema()
    expect(estado.ultimoRespaldoEn).toBeNull()
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
        categorias: [{ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' }],
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

// Ola 3, ruling 1: lo que la reconstrucción deja con alConfirmar (en la composición, lo que
// publiquen Inventario o Análisis) sale solo si la restauración entera confirma.
describe('restaurarCopia en una sola unidad de trabajo', () => {
  async function prepararConPendientes() {
    const contexto = crearContexto()
    const { deps, seedProductosYOperaciones, reconstructor } = contexto
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    const respaldo = JSON.parse(await (await guardarCopia(deps)).contenido.text())
    const pendientes: string[] = []
    const reconstruir = reconstructor.reconstruirTodo.bind(reconstructor)
    reconstructor.reconstruirTodo = async () => {
      await reconstruir()
      deps.uow.alConfirmar(() => {
        pendientes.push('después de reconstruir')
      })
    }
    return { ...contexto, respaldo, pendientes }
  }

  it('RN-RE-04: si el control no cuadra, se revierte todo y no corre nada de lo pendiente', async () => {
    const { deps, respaldo, pendientes } = await prepararConPendientes()
    respaldo.control.stockPorProducto.carbon = 99000

    await expect(
      restaurarCopia(deps, JSON.stringify(respaldo), { confirmaciones: 2 }),
    ).rejects.toThrow('La copia tiene datos que no cuadran. No se cambió nada')

    expect(pendientes).toEqual([])
  })

  it('ADR-0002: si la restauración confirma, lo pendiente corre después', async () => {
    const { deps, respaldo, pendientes } = await prepararConPendientes()

    await restaurarCopia(deps, JSON.stringify(respaldo), { confirmaciones: 2 })

    expect(pendientes).toEqual(['después de reconstruir'])
  })
})

describe('copia consistente (RN-RE-02/03/04)', () => {
  it('el nombre usa la hora de Lima: 2026-10-16T03:00Z es 15/10 a las 22:00', async () => {
    const { deps, reloj } = crearContexto()
    reloj.fijar('2026-10-16T03:00:00.000Z')
    const archivo = await guardarCopia(deps)
    expect(archivo.nombre).toBe('respaldo-bodega-rosita-2026-10-15-2200.json')
  })

  it('si la proyección de existencias se desvió, la copia guardada igual se puede restaurar', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    almacenEnMemoria.guardar('existencias', { productoId: 'lejia', cantidad: 5000 })

    const archivo = await guardarCopia(deps)
    const texto = await archivo.contenido.text()
    expect(JSON.parse(texto).control.stockPorProducto.lejia).toBe(10000)

    await expect(restaurarCopia(deps, texto, { confirmaciones: 2 })).resolves.toBeUndefined()
    expect(almacenEnMemoria.obtener('existencias', 'lejia')?.cantidad).toBe(10000)
  })

  it('una operación confirmada al mismo tiempo no deja un archivo incoherente', async () => {
    const { deps, almacenEnMemoria, uow, seedProductosYOperaciones, reconstructor } =
      crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()

    const [archivo] = await Promise.all([
      guardarCopia(deps),
      uow.ejecutar(async () => {
        almacenEnMemoria.guardar(
          'operaciones',
          stockInicial({
            id: 'op-nueva',
            tipo: 'INGRESO',
            productoIds: ['lejia'],
            movimientos: [
              { productoId: 'lejia', cantidad: 4000, costoUnitario: 240, precioUnitario: null },
            ],
          }),
        )
      }),
    ])
    const texto = await archivo.contenido.text()
    const respaldo = JSON.parse(texto)
    const suma = respaldo.datos.operaciones
      .flatMap((o: OperacionRegistro) => o.movimientos)
      .filter((m: { productoId: string }) => m.productoId === 'lejia')
      .reduce((total: number, m: { cantidad: number }) => total + m.cantidad, 0)
    expect(respaldo.control.stockPorProducto.lejia).toBe(suma)
    await expect(restaurarCopia(deps, texto, { confirmaciones: 2 })).resolves.toBeUndefined()
  })

  it('marcarCopiaGuardada guarda el momento como último respaldo', async () => {
    const { deps, tienda, reloj } = crearContexto()
    await marcarCopiaGuardada(deps)
    expect((await tienda.estadoDelSistema()).ultimoRespaldoEn).toBe(reloj.ahora())
  })

  it('RN-RE-04: tras restaurar, las existencias reconstruidas igualan la suma de movimientos', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    const texto = await (await guardarCopia(deps)).contenido.text()

    almacenEnMemoria.guardar(
      'operaciones',
      stockInicial({
        id: 'venta-despues',
        tipo: 'VENTA',
        productoIds: ['lejia'],
        movimientos: [
          { productoId: 'lejia', cantidad: -5000, costoUnitario: 240, precioUnitario: 350 },
        ],
      }),
    )
    await reconstructor.reconstruirTodo()
    expect(almacenEnMemoria.obtener('existencias', 'lejia')?.cantidad).toBe(5000)

    await restaurarCopia(deps, texto, { confirmaciones: 2 })

    expect(almacenEnMemoria.obtener('existencias', 'lejia')?.cantidad).toBe(10000)
    expect(almacenEnMemoria.obtener('existencias', 'carbon')?.cantidad).toBe(12500)
  })

  it('RN-RE-04: un producto con stock reconstruido que falta en el control revierte todo', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    const respaldo = JSON.parse(await (await guardarCopia(deps)).contenido.text())
    delete respaldo.control.stockPorProducto.lejia
    almacenEnMemoria.guardar('productos', producto({ id: 'agregado-despues', nombre: 'Nuevo' }))

    await expect(
      restaurarCopia(deps, JSON.stringify(respaldo), { confirmaciones: 2 }),
    ).rejects.toThrow('La copia tiene datos que no cuadran. No se cambió nada')
    expect(almacenEnMemoria.todos('productos')).toHaveLength(3)
  })

  it('una copia con datos mal formados se rechaza al preparar, antes de pedir confirmaciones', async () => {
    const { deps, seedProductosYOperaciones, reconstructor } = crearContexto()
    seedProductosYOperaciones()
    await reconstructor.reconstruirTodo()
    const respaldo = JSON.parse(await (await guardarCopia(deps)).contenido.text())
    respaldo.datos.productos[0].precioVenta = 'tres soles'

    await expect(prepararRestauracion(deps, JSON.stringify(respaldo))).rejects.toThrow(
      'Este archivo no es una copia válida de la app',
    )
  })
})

describe('guardarCopia toma la foto con el almacén, fuera de una unidad de trabajo', () => {
  it('RN-RE-02: no abre una unidad de trabajo: el almacén lee todo en una sola transacción y convierte las fotos fuera de ella', async () => {
    const { deps, almacenEnMemoria, seedProductosYOperaciones } = crearContexto()
    seedProductosYOperaciones()
    const delCasoDeUso = new UnidadDeTrabajoEnMemoria(almacenEnMemoria)
    const ejecutar = vi.spyOn(delCasoDeUso, 'ejecutar')
    const leerTodo = vi.spyOn(deps.almacen, 'leerTodo')

    const archivo = await guardarCopia({ ...deps, uow: delCasoDeUso })

    expect(leerTodo).toHaveBeenCalledTimes(1)
    expect(ejecutar).not.toHaveBeenCalled()
    expect(JSON.parse(await archivo.contenido.text()).control.productos).toBe(2)
  })
})

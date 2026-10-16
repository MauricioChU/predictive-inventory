import { beforeEach, describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { BusEnMemoria } from '@/shared/domain/eventos'
import { RelojFijo } from '@/shared/domain/reloj'
import { IdsSecuenciales } from '@/shared/domain/ids'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import type { InventarioParaCatalogo } from '@/shared/contratos/entre-modulos'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeFotosEnMemoria,
  RepositorioDeProductosEnMemoria,
} from '../infrastructure/memoria/repositorios'
import { crearModuloCatalogo, type DependenciasDeCatalogo, type ModuloCatalogo } from './modulo'

class InventarioFalso implements InventarioParaCatalogo {
  readonly stock = new Map<string, Cantidad>()
  llamadasAStockDe = 0
  async stockDe(productoId: string): Promise<Cantidad> {
    this.llamadasAStockDe += 1
    return this.stock.get(productoId) ?? Cantidad.cero()
  }
  async existencias(): Promise<Map<string, Cantidad>> {
    return new Map(this.stock)
  }
  async tieneOperaciones(): Promise<boolean> {
    return false
  }
  async ultimoIngresoDe(): Promise<null> {
    return null
  }
  async operaciones(): Promise<OperacionRegistro[]> {
    return []
  }
  async registrarStockInicial(productoId: string, cantidad: Cantidad): Promise<void> {
    this.stock.set(productoId, cantidad)
  }
  async retirarStock(productoId: string): Promise<void> {
    this.stock.set(productoId, Cantidad.cero())
  }
}

function construirModulo(): {
  modulo: ModuloCatalogo
  deps: DependenciasDeCatalogo
  inventario: InventarioFalso
} {
  const almacen = new AlmacenEnMemoria()
  const deps: DependenciasDeCatalogo = {
    productos: new RepositorioDeProductosEnMemoria(almacen),
    categorias: new RepositorioDeCategoriasEnMemoria(almacen),
    fotos: new RepositorioDeFotosEnMemoria(almacen),
    procesadorDeFotos: { reducir: async (imagen) => imagen },
    uow: new UnidadDeTrabajoEnMemoria(almacen),
    reloj: new RelojFijo('2026-10-15T10:00:00.000Z'),
    ids: new IdsSecuenciales('p'),
    bus: new BusEnMemoria(),
    inventario: () => inventario,
    ventas: () => ({ vecesVendido: async () => new Map() }),
  }
  const inventario = new InventarioFalso()
  return { modulo: crearModuloCatalogo(deps), deps, inventario }
}

describe('crearModuloCatalogo: delega en los casos de uso', () => {
  let modulo: ModuloCatalogo

  beforeEach(async () => {
    ;({ modulo } = construirModulo())
    await modulo.sembrarCategoriasIniciales()
  })

  it('sembrarCategoriasIniciales + listarCategorias', async () => {
    const categorias = await modulo.listarCategorias()
    expect(categorias).toHaveLength(10)
    // Por nombre (listarCategorias), no por orden de creación.
    expect(categorias[0]?.nombre).toBe('Ambientadores e insecticidas')
  })

  it('crearCategoria, renombrarCategoria y eliminarCategoria', async () => {
    const id = await modulo.crearCategoria('Mi categoría')
    await modulo.renombrarCategoria(id, 'Mi categoría renombrada')
    const categorias = await modulo.listarCategorias()
    expect(categorias.find((c) => c.id === id)?.nombre).toBe('Mi categoría renombrada')
    await modulo.eliminarCategoria(id)
    expect((await modulo.listarCategorias()).find((c) => c.id === id)).toBeUndefined()
  })

  it('crearProducto, obtenerProducto, editarProducto, archivarProducto y reactivarProducto', async () => {
    const categoriaId = await modulo.crearCategoria('Lejías')
    const creado = await modulo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    const { productoId } = creado.valor

    const vista = await modulo.obtenerProducto(productoId)
    expect(vista?.nombre).toBe('Lejía 1 L')

    await modulo.editarProducto({ productoId, nombre: 'Lejía Tradicional 1 L' })
    expect((await modulo.obtenerProducto(productoId))?.nombre).toBe('Lejía Tradicional 1 L')

    await modulo.archivarProducto({ productoId })
    expect((await modulo.obtenerProducto(productoId))?.activo).toBe(false)

    await modulo.reactivarProducto(productoId)
    expect((await modulo.obtenerProducto(productoId))?.activo).toBe(true)
  })

  it('buscarProductos', async () => {
    const categoriaId = await modulo.crearCategoria('Lejías')
    await modulo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    const resultados = await modulo.buscarProductos({ texto: 'lejia' })
    expect(resultados.map((p) => p.nombre)).toEqual(['Lejía 1 L'])
  })

  it('guardarFoto, obtenerFoto y quitarFoto', async () => {
    const categoriaId = await modulo.crearCategoria('Lejías')
    const creado = await modulo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    const { productoId } = creado.valor

    await modulo.guardarFoto(productoId, new Blob([new Uint8Array([1])]))
    expect(await modulo.obtenerFoto(productoId)).not.toBeNull()
    await modulo.quitarFoto(productoId)
    expect(await modulo.obtenerFoto(productoId)).toBeNull()
  })
})

describe('ModuloCatalogo.consultable', () => {
  it('producto() devuelve un ProductoResumido (sin stock ni gananciaPorUnidad)', async () => {
    const { modulo } = construirModulo()
    const categoriaId = await modulo.crearCategoria('Lejías')
    const creado = await modulo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')

    const resumen = await modulo.consultable.producto(creado.valor.productoId)
    expect(resumen).toEqual({
      id: creado.valor.productoId,
      nombre: 'Lejía 1 L',
      unidad: 'UNIDAD',
      categoriaId,
      categoriaNombre: 'Lejías',
      precioCompra: Dinero.deTexto('2.40'),
      precioVenta: Dinero.deTexto('3.50'),
      stockMinimo: Cantidad.deEntero(3),
      activo: true,
      tieneFoto: false,
    })
  })

  it('producto() no consulta el stock a Inventario', async () => {
    const { modulo, inventario } = construirModulo()
    const categoriaId = await modulo.crearCategoria('Lejías')
    const creado = await modulo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    await modulo.consultable.producto(creado.valor.productoId)
    expect(inventario.llamadasAStockDe).toBe(0)
  })

  it('producto() es null si no existe', async () => {
    const { modulo } = construirModulo()
    expect(await modulo.consultable.producto('no-existe')).toBeNull()
  })

  it('productos({ soloActivos: true }) solo devuelve productos activos', async () => {
    const { modulo } = construirModulo()
    const categoriaId = await modulo.crearCategoria('Otros')
    const activo = await modulo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    const archivado = await modulo.crearProducto({
      nombre: 'Escoba',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '6.00',
      precioVenta: '9.00',
      stockMinimo: '2',
    })
    if (activo.tipo !== 'hecho' || archivado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    await modulo.archivarProducto({ productoId: archivado.valor.productoId })

    const soloActivos = await modulo.consultable.productos({ soloActivos: true })
    expect(soloActivos.map((p) => p.nombre)).toEqual(['Lejía 1 L'])

    const todos = await modulo.consultable.productos()
    expect(todos).toHaveLength(2)
  })

  it('actualizarPrecioCompra actualiza el precio de compra', async () => {
    const { modulo } = construirModulo()
    const categoriaId = await modulo.crearCategoria('Lejías')
    const creado = await modulo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')

    await modulo.consultable.actualizarPrecioCompra(creado.valor.productoId, Dinero.deTexto('2.80'))
    const resumen = await modulo.consultable.producto(creado.valor.productoId)
    expect(resumen?.precioCompra.igualA(Dinero.deTexto('2.80'))).toBe(true)
  })
})

describe('ModuloCatalogo.importacion', () => {
  it('validarNuevo delega en el caso de uso', async () => {
    const { modulo } = construirModulo()
    const error = await modulo.importacion.validarNuevo({
      nombre: '',
      categoriaId: 'x',
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    expect(error).toEqual({ codigo: 'NOMBRE_VACIO', mensaje: 'Escribe el nombre del producto' })
  })

  it('crearCategoria y categoriaPorNombre', async () => {
    const { modulo } = construirModulo()
    const id = await modulo.importacion.crearCategoria('Carbón y combustibles')
    expect(await modulo.importacion.categoriaPorNombre('carbon y combustibles')).toBe(id)
    expect(await modulo.importacion.categoriaPorNombre('no existe')).toBeNull()
  })

  it('crear guarda el producto confirmado y devuelve su id', async () => {
    const { modulo } = construirModulo()
    const categoriaId = await modulo.importacion.crearCategoria('Lejías')
    const productoId = await modulo.importacion.crear({
      nombre: 'Lejía con pérdida',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '5.00',
      precioVenta: '4.50',
      stockMinimo: '3',
    })
    const vista = await modulo.obtenerProducto(productoId)
    expect(vista?.nombre).toBe('Lejía con pérdida')
  })

  it('crear lanza si el nombre ya existe (nombre duplicado)', async () => {
    const { modulo } = construirModulo()
    const categoriaId = await modulo.importacion.crearCategoria('Lejías')
    await modulo.importacion.crear({
      nombre: 'Lejía 1 L',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
    })
    await expect(
      modulo.importacion.crear({
        nombre: 'lejia 1 l',
        categoriaId,
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      }),
    ).rejects.toThrow('Ya existe un producto con ese nombre')
  })

  it('crear lanza (en vez de ofrecer reactivar) si el nombre coincide con uno ARCHIVADO', async () => {
    const { modulo } = construirModulo()
    const categoriaId = await modulo.importacion.crearCategoria('Otros')
    const productoId = await modulo.importacion.crear({
      nombre: 'Escoba',
      categoriaId,
      unidad: 'UNIDAD',
      precioCompra: '6.00',
      precioVenta: '9.00',
      stockMinimo: '2',
    })
    await modulo.archivarProducto({ productoId })

    await expect(
      modulo.importacion.crear({
        nombre: 'escoba',
        categoriaId,
        unidad: 'UNIDAD',
        precioCompra: '6.00',
        precioVenta: '9.00',
        stockMinimo: '2',
      }),
    ).rejects.toThrow('Ya existe un producto con ese nombre')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { BusEnMemoria } from '@/shared/domain/eventos'
import type { EventoDeDominio } from '@/shared/domain/eventos'
import { RelojFijo } from '@/shared/domain/reloj'
import { IdsSecuenciales } from '@/shared/domain/ids'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import type { CategoriaRegistro, OperacionRegistro } from '@/shared/contratos/registros'
import type { InventarioParaCatalogo } from '@/shared/contratos/entre-modulos'
import type { Instante } from '@/shared/domain/fecha'
import {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeProductosEnMemoria,
} from '../infrastructure/memoria/repositorios'
import type { DependenciasDeCatalogo } from './modulo'
import {
  archivarProducto,
  buscarProductos,
  crearProducto,
  editarProducto,
  obtenerProducto,
  reactivarProducto,
  validarNuevo,
} from './productos'

const AHORA = '2026-10-15T10:00:00.000Z'

/** Doble simple de Inventario: stock por producto, registra llamadas, responde tieneOperaciones. */
class InventarioFalso implements InventarioParaCatalogo {
  readonly stock = new Map<string, Cantidad>()
  readonly productosConOperaciones = new Set<string>()
  readonly llamadasARegistrarStockInicial: {
    productoId: string
    cantidad: Cantidad
    costo: Dinero
  }[] = []
  readonly llamadasARetirarStock: string[] = []
  lanzarAlRegistrarStockInicial = false

  async stockDe(productoId: string): Promise<Cantidad> {
    return this.stock.get(productoId) ?? Cantidad.cero()
  }
  async existencias(): Promise<Map<string, Cantidad>> {
    return new Map(this.stock)
  }
  async tieneOperaciones(productoId: string): Promise<boolean> {
    return this.productosConOperaciones.has(productoId)
  }
  async ultimoIngresoDe(_productoId: string): Promise<Instante | null> {
    return null
  }
  async operaciones(): Promise<OperacionRegistro[]> {
    return []
  }
  async registrarStockInicial(
    productoId: string,
    cantidad: Cantidad,
    costoUnitario: Dinero,
  ): Promise<void> {
    this.llamadasARegistrarStockInicial.push({ productoId, cantidad, costo: costoUnitario })
    this.stock.set(productoId, cantidad)
    this.productosConOperaciones.add(productoId)
    if (this.lanzarAlRegistrarStockInicial) throw new Error('Falla simulada de Inventario')
  }
  async retirarStock(productoId: string): Promise<void> {
    this.llamadasARetirarStock.push(productoId)
    this.stock.set(productoId, Cantidad.cero())
  }
}

function construirDependencias() {
  const almacen = new AlmacenEnMemoria()
  const productos = new RepositorioDeProductosEnMemoria(almacen)
  const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
  const uow = new UnidadDeTrabajoEnMemoria(almacen)
  const reloj = new RelojFijo(AHORA)
  const ids = new IdsSecuenciales('p')
  const eventosPublicados: EventoDeDominio[] = []
  const bus = new BusEnMemoria()
  bus.suscribir('ProductoCreado', (e) => void eventosPublicados.push(e))
  bus.suscribir('ProductoActualizado', (e) => void eventosPublicados.push(e))
  bus.suscribir('ProductoArchivado', (e) => void eventosPublicados.push(e))
  bus.suscribir('ProductoReactivado', (e) => void eventosPublicados.push(e))
  const inventario = new InventarioFalso()
  const vecesVendidoFijo = new Map<string, number>()
  const ventas = { vecesVendido: async () => vecesVendidoFijo }
  const deps: DependenciasDeCatalogo = {
    productos,
    categorias,
    // No se usan en estos casos de uso, pero completan el tipo (fotos: Tarea 5).
    fotos: { guardar: async () => {}, obtener: async () => null, eliminar: async () => {} },
    procesadorDeFotos: { reducir: async (b) => b },
    uow,
    reloj,
    ids,
    bus,
    inventario: () => inventario,
    ventas: () => ventas,
  }
  return {
    deps,
    productos,
    categorias,
    inventario,
    eventosPublicados,
    vecesVendidoFijo,
    reloj,
    almacen,
  }
}

async function crearCategoriaDePrueba(
  categorias: RepositorioDeCategoriasEnMemoria,
  id: string,
  nombre: string,
): Promise<CategoriaRegistro> {
  const registro: CategoriaRegistro = { id, nombre, nombreNormalizado: nombre.toLowerCase() }
  await categorias.guardar(registro)
  return registro
}

describe('crearProducto', () => {
  let ctx: ReturnType<typeof construirDependencias>
  beforeEach(async () => {
    ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Lejías y desinfectantes')
  })

  const datosBase = () => ({
    nombre: 'Lejía 1 L',
    categoriaId: 'c1',
    unidad: 'UNIDAD' as const,
    precioCompra: '2.40',
    precioVenta: '3.50',
    stockMinimo: '3',
  })

  it('RN-CAT-01: crea el producto y publica ProductoCreado', async () => {
    const resultado = await crearProducto(datosBase(), ctx.deps)
    expect(resultado.tipo).toBe('hecho')
    if (resultado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    const guardado = await ctx.productos.porId(resultado.valor.productoId)
    expect(guardado?.nombre).toBe('Lejía 1 L')
    expect(guardado?.estado).toBe('ACTIVO')
    expect(ctx.eventosPublicados).toEqual([
      { tipo: 'ProductoCreado', productoId: resultado.valor.productoId },
    ])
  })

  it('RN-CAT-01: rechaza un nombre duplicado de un producto ACTIVO', async () => {
    await crearProducto({ ...datosBase(), nombre: 'Lejía 2 L' }, ctx.deps)
    await expect(crearProducto({ ...datosBase(), nombre: 'lejia 2 l' }, ctx.deps)).rejects.toThrow(
      'Ya existe un producto con ese nombre',
    )
  })

  it('RN-CAT-02: un nombre que coincide con un producto ARCHIVADO no crea nada y ofrece reactivar', async () => {
    const creado = await crearProducto({ ...datosBase(), nombre: 'Escoba' }, ctx.deps)
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    await archivarProducto({ productoId: creado.valor.productoId }, ctx.deps)

    const resultado = await crearProducto({ ...datosBase(), nombre: 'escoba' }, ctx.deps)
    expect(resultado).toEqual({
      tipo: 'reactivar',
      productoId: creado.valor.productoId,
      nombre: 'Escoba',
    })
    expect(await ctx.productos.todos()).toHaveLength(1)
  })

  it('rechaza categoriaId inexistente con "Elige una categoría"', async () => {
    await expect(
      crearProducto({ ...datosBase(), categoriaId: 'no-existe' }, ctx.deps),
    ).rejects.toThrow('Elige una categoría')
  })

  it('RN-CAT-05: pide confirmar si hay pérdida y crea tras confirmar', async () => {
    const datos = { ...datosBase(), precioCompra: '5.00', precioVenta: '4.50' }
    const pedido = await crearProducto(datos, ctx.deps)
    expect(pedido).toEqual({ tipo: 'confirmar', mensaje: 'Vas a perder S/ 0.50 por cada unidad' })
    expect(await ctx.productos.todos()).toHaveLength(0)

    const confirmado = await crearProducto({ ...datos, confirmado: true }, ctx.deps)
    expect(confirmado.tipo).toBe('hecho')
    expect(await ctx.productos.todos()).toHaveLength(1)
  })

  it('RN-CAT-08: con stock inicial > 0 registra STOCK_INICIAL con el precio de compra', async () => {
    const resultado = await crearProducto({ ...datosBase(), stockInicial: '12' }, ctx.deps)
    if (resultado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    expect(ctx.inventario.llamadasARegistrarStockInicial).toEqual([
      {
        productoId: resultado.valor.productoId,
        cantidad: Cantidad.deEntero(12),
        costo: Dinero.deTexto('2.40'),
      },
    ])
  })

  it('RN-CAT-08: sin stock inicial (vacío o "0") no registra ninguna operación', async () => {
    await crearProducto({ ...datosBase(), stockInicial: '0' }, ctx.deps)
    await crearProducto({ ...datosBase(), nombre: 'Lejía 2 L' }, ctx.deps)
    expect(ctx.inventario.llamadasARegistrarStockInicial).toHaveLength(0)
  })

  it('RN-CAT-08 + RN-OP-06: si registrarStockInicial lanza, el producto no queda guardado', async () => {
    ctx.inventario.lanzarAlRegistrarStockInicial = true
    await expect(crearProducto({ ...datosBase(), stockInicial: '12' }, ctx.deps)).rejects.toThrow(
      'Falla simulada de Inventario',
    )
    expect(await ctx.productos.todos()).toHaveLength(0)
    expect(ctx.eventosPublicados).toHaveLength(0)
  })

  it('no publica ningún evento si la UoW falla', async () => {
    ctx.inventario.lanzarAlRegistrarStockInicial = true
    await expect(crearProducto({ ...datosBase(), stockInicial: '12' }, ctx.deps)).rejects.toThrow()
    expect(ctx.eventosPublicados).toHaveLength(0)
  })
})

describe('editarProducto', () => {
  let ctx: ReturnType<typeof construirDependencias>
  let productoId: string

  beforeEach(async () => {
    ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Carbón y combustibles')
    await crearCategoriaDePrueba(ctx.categorias, 'c2', 'Otros')
    const creado = await crearProducto(
      {
        nombre: 'Carbón',
        categoriaId: 'c1',
        unidad: 'KILO',
        precioCompra: '2.75',
        precioVenta: '4.00',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    productoId = creado.valor.productoId
  })

  it('lanza "No encontramos ese producto" si el id no existe', async () => {
    await expect(editarProducto({ productoId: 'no-existe' }, ctx.deps)).rejects.toThrow(
      'No encontramos ese producto',
    )
  })

  it('RN-CAT-03: rechaza cambiar la unidad si el producto ya tiene operaciones', async () => {
    ctx.inventario.productosConOperaciones.add(productoId)
    await expect(editarProducto({ productoId, unidad: 'UNIDAD' }, ctx.deps)).rejects.toThrow(
      'No puedes cambiar la unidad de un producto que ya tiene movimientos',
    )
  })

  it('RN-CAT-03: cambia la unidad si el producto no tiene operaciones', async () => {
    const resultado = await editarProducto({ productoId, unidad: 'UNIDAD' }, ctx.deps)
    expect(resultado.tipo).toBe('hecho')
    const actualizado = await ctx.productos.porId(productoId)
    expect(actualizado?.unidad).toBe('UNIDAD')
  })

  it('no valida la unidad si no cambia, aunque el producto tenga operaciones', async () => {
    ctx.inventario.productosConOperaciones.add(productoId)
    const resultado = await editarProducto({ productoId, unidad: 'KILO' }, ctx.deps)
    expect(resultado.tipo).toBe('hecho')
  })

  it('cambia el nombre, publica ProductoActualizado', async () => {
    const resultado = await editarProducto({ productoId, nombre: 'Carbón vegetal' }, ctx.deps)
    expect(resultado.tipo).toBe('hecho')
    expect((await ctx.productos.porId(productoId))?.nombre).toBe('Carbón vegetal')
    expect(ctx.eventosPublicados.at(-1)).toEqual({ tipo: 'ProductoActualizado', productoId })
  })

  it('rechaza un nombre que ya usa OTRO producto', async () => {
    await crearProducto(
      {
        nombre: 'Escoba',
        categoriaId: 'c2',
        unidad: 'UNIDAD',
        precioCompra: '6.00',
        precioVenta: '9.00',
        stockMinimo: '2',
      },
      ctx.deps,
    )
    await expect(editarProducto({ productoId, nombre: 'escoba' }, ctx.deps)).rejects.toThrow(
      'Ya existe un producto con ese nombre',
    )
  })

  it('permite guardar el mismo nombre que ya tenía (sin chocar con sí mismo)', async () => {
    const resultado = await editarProducto({ productoId, nombre: 'Carbón' }, ctx.deps)
    expect(resultado.tipo).toBe('hecho')
  })

  it('rechaza una categoría inexistente', async () => {
    await expect(
      editarProducto({ productoId, categoriaId: 'no-existe' }, ctx.deps),
    ).rejects.toThrow('Elige una categoría')
  })

  it('cambia la categoría', async () => {
    await editarProducto({ productoId, categoriaId: 'c2' }, ctx.deps)
    expect((await ctx.productos.porId(productoId))?.categoriaId).toBe('c2')
  })

  it('RN-CAT-05: pide confirmar si el nuevo precio deja pérdida', async () => {
    const resultado = await editarProducto(
      { productoId, precioCompra: '5.00', precioVenta: '4.50' },
      ctx.deps,
    )
    expect(resultado).toEqual({ tipo: 'confirmar', mensaje: 'Vas a perder S/ 0.50 por cada kilo' })
    expect((await ctx.productos.porId(productoId))?.precioCompra).toBe(275)
  })

  it('RN-CAT-05: confirmado guarda el nuevo precio con pérdida', async () => {
    const resultado = await editarProducto(
      { productoId, precioCompra: '5.00', precioVenta: '4.50', confirmado: true },
      ctx.deps,
    )
    expect(resultado.tipo).toBe('hecho')
    expect((await ctx.productos.porId(productoId))?.precioCompra).toBe(500)
  })

  it('cambia solo el precio de venta, conservando el de compra', async () => {
    await editarProducto({ productoId, precioVenta: '5.00' }, ctx.deps)
    const guardado = await ctx.productos.porId(productoId)
    expect(guardado?.precioVenta).toBe(500)
    expect(guardado?.precioCompra).toBe(275)
  })

  it('cambia el stock mínimo', async () => {
    await editarProducto({ productoId, stockMinimo: '2.5' }, ctx.deps)
    expect((await ctx.productos.porId(productoId))?.stockMinimo).toBe(2500)
  })

  it('RN-CAT-06: respeta la precisión de la unidad actual (o la nueva, si cambia) al validar el stock mínimo', async () => {
    await expect(
      editarProducto({ productoId, unidad: 'UNIDAD', stockMinimo: '2.5' }, ctx.deps),
    ).rejects.toThrow('Este producto se cuenta por unidades enteras')
  })
})

describe('archivarProducto (RN-CAT-11)', () => {
  let ctx: ReturnType<typeof construirDependencias>
  let productoId: string

  beforeEach(async () => {
    ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Otros')
    const creado = await crearProducto(
      {
        nombre: 'Escoba',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '6.00',
        precioVenta: '9.00',
        stockMinimo: '2',
      },
      ctx.deps,
    )
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    productoId = creado.valor.productoId
  })

  it('lanza "No encontramos ese producto" si no existe', async () => {
    await expect(archivarProducto({ productoId: 'no-existe' }, ctx.deps)).rejects.toThrow(
      'No encontramos ese producto',
    )
  })

  it('con stock 0 archiva directo, sin pedir confirmación', async () => {
    const resultado = await archivarProducto({ productoId }, ctx.deps)
    expect(resultado.tipo).toBe('hecho')
    expect((await ctx.productos.porId(productoId))?.estado).toBe('ARCHIVADO')
    expect(ctx.inventario.llamadasARetirarStock).toHaveLength(0)
    expect(ctx.eventosPublicados.at(-1)).toEqual({ tipo: 'ProductoArchivado', productoId })
  })

  it('con stock > 0 pide confirmar con el mensaje de retiro', async () => {
    ctx.inventario.stock.set(productoId, Cantidad.deEntero(4))
    const pedido = await archivarProducto({ productoId }, ctx.deps)
    expect(pedido).toEqual({
      tipo: 'confirmar',
      mensaje: 'Aún quedan 4 unid. ¿Las retiramos del stock?',
    })
    expect((await ctx.productos.porId(productoId))?.estado).toBe('ACTIVO')
  })

  it('confirmado con stock > 0 retira el stock y archiva', async () => {
    ctx.inventario.stock.set(productoId, Cantidad.deEntero(4))
    const resultado = await archivarProducto({ productoId, confirmado: true }, ctx.deps)
    expect(resultado.tipo).toBe('hecho')
    expect(ctx.inventario.llamadasARetirarStock).toEqual([productoId])
    expect((await ctx.productos.porId(productoId))?.estado).toBe('ARCHIVADO')
  })
})

describe('reactivarProducto', () => {
  it('reactiva un producto archivado y publica ProductoReactivado', async () => {
    const ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Otros')
    const creado = await crearProducto(
      {
        nombre: 'Escoba',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '6.00',
        precioVenta: '9.00',
        stockMinimo: '2',
      },
      ctx.deps,
    )
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    await archivarProducto({ productoId: creado.valor.productoId }, ctx.deps)

    await reactivarProducto(creado.valor.productoId, ctx.deps)
    expect((await ctx.productos.porId(creado.valor.productoId))?.estado).toBe('ACTIVO')
    expect(ctx.eventosPublicados.at(-1)).toEqual({
      tipo: 'ProductoReactivado',
      productoId: creado.valor.productoId,
    })
  })

  it('lanza "No encontramos ese producto" si no existe', async () => {
    const ctx = construirDependencias()
    await expect(reactivarProducto('no-existe', ctx.deps)).rejects.toThrow(
      'No encontramos ese producto',
    )
  })
})

describe('obtenerProducto', () => {
  it('devuelve null si no existe', async () => {
    const ctx = construirDependencias()
    expect(await obtenerProducto('no-existe', ctx.deps)).toBeNull()
  })

  it('arma la vista con categoría, stock y ganancia por unidad', async () => {
    const ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Lejías y desinfectantes')
    const creado = await crearProducto(
      {
        nombre: 'Lejía 1 L',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    if (creado.tipo !== 'hecho') throw new Error('se esperaba hecho')
    ctx.inventario.stock.set(creado.valor.productoId, Cantidad.deEntero(7))

    const vista = await obtenerProducto(creado.valor.productoId, ctx.deps)
    expect(vista).toMatchObject({
      id: creado.valor.productoId,
      nombre: 'Lejía 1 L',
      categoriaNombre: 'Lejías y desinfectantes',
      activo: true,
      tieneFoto: false,
    })
    expect(vista?.stock.igualA(Cantidad.deEntero(7))).toBe(true)
    expect(vista?.gananciaPorUnidad.igualA(Dinero.deTexto('1.10'))).toBe(true)
  })
})

describe('buscarProductos (RN-CAT-10, RN-CAT-12)', () => {
  it('solo activos por defecto; archivados: true solo archivados', async () => {
    const ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Otros')
    const activo = await crearProducto(
      {
        nombre: 'Lejía 1 L',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    const archivadoRes = await crearProducto(
      {
        nombre: 'Escoba',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '6.00',
        precioVenta: '9.00',
        stockMinimo: '2',
      },
      ctx.deps,
    )
    if (activo.tipo !== 'hecho' || archivadoRes.tipo !== 'hecho')
      throw new Error('se esperaba hecho')
    await archivarProducto({ productoId: archivadoRes.valor.productoId }, ctx.deps)

    const activos = await buscarProductos({ texto: '' }, ctx.deps)
    expect(activos.map((p) => p.nombre)).toEqual(['Lejía 1 L'])

    const archivados = await buscarProductos({ texto: '', archivados: true }, ctx.deps)
    expect(archivados.map((p) => p.nombre)).toEqual(['Escoba'])
  })

  it('RN-CAT-12: encuentra por palabras en cualquier orden, sin tildes', async () => {
    const ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Lejías y desinfectantes')
    await crearProducto(
      {
        nombre: 'Lejía Tradicional 1 L',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    await crearProducto(
      {
        nombre: 'Lejía Tradicional 2 L',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '4.30',
        precioVenta: '6.20',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    const resultado = await buscarProductos({ texto: '1 l lejia' }, ctx.deps)
    expect(resultado.map((p) => p.nombre)).toEqual(['Lejía Tradicional 1 L'])
    expect(await buscarProductos({ texto: 'detergente' }, ctx.deps)).toHaveLength(0)
  })

  it('RN-CAT-12: ordena por veces vendido en los últimos 30 días, luego por nombre', async () => {
    const ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Lejías y desinfectantes')
    const p1 = await crearProducto(
      {
        nombre: 'Lejía Tradicional 1 L',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    const p2 = await crearProducto(
      {
        nombre: 'Lejía Tradicional 2 L',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '4.30',
        precioVenta: '6.20',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    if (p1.tipo !== 'hecho' || p2.tipo !== 'hecho') throw new Error('se esperaba hecho')
    ctx.vecesVendidoFijo.set(p1.valor.productoId, 1)
    ctx.vecesVendidoFijo.set(p2.valor.productoId, 6)

    const resultado = await buscarProductos({ texto: 'lejia' }, ctx.deps)
    expect(resultado.map((p) => p.nombre)).toEqual([
      'Lejía Tradicional 2 L',
      'Lejía Tradicional 1 L',
    ])
  })
})

describe('validarNuevo', () => {
  it('devuelve el código NOMBRE_DUPLICADO con el nombre existente', async () => {
    const ctx = construirDependencias()
    await crearCategoriaDePrueba(ctx.categorias, 'c1', 'Lejías y desinfectantes')
    await crearProducto(
      {
        nombre: 'Lejía 1 L',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.deps,
    )
    const error = await validarNuevo(
      {
        nombre: 'lejia 1 l',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.productos,
    )
    expect(error).toEqual({
      codigo: 'NOMBRE_DUPLICADO',
      mensaje: 'Ya existe un producto con ese nombre',
      nombreExistente: 'Lejía 1 L',
    })
    expect(await ctx.productos.todos()).toHaveLength(1)
  })

  it('devuelve el código CANTIDAD_ENTERA para un mínimo con decimales en UNIDAD', async () => {
    const ctx = construirDependencias()
    const error = await validarNuevo(
      {
        nombre: 'Nuevo producto',
        categoriaId: 'no-existe',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '1.5',
      },
      ctx.productos,
    )
    expect(error).toEqual({
      codigo: 'CANTIDAD_ENTERA',
      mensaje: 'Este producto se cuenta por unidades enteras',
    })
  })

  it('devuelve null si es válido y no valida que la categoría exista', async () => {
    const ctx = construirDependencias()
    const error = await validarNuevo(
      {
        nombre: 'Nuevo producto',
        categoriaId: 'no-existe',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.productos,
    )
    expect(error).toBeNull()
    expect(await ctx.productos.todos()).toHaveLength(0)
  })

  it('devuelve el error de nombre si está vacío', async () => {
    const ctx = construirDependencias()
    const error = await validarNuevo(
      {
        nombre: '',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.productos,
    )
    expect(error).toEqual({ codigo: 'NOMBRE_VACIO', mensaje: 'Escribe el nombre del producto' })
  })

  it('devuelve el error de precio de compra inválido', async () => {
    const ctx = construirDependencias()
    const error = await validarNuevo(
      {
        nombre: 'Nuevo producto',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '-1.00',
        precioVenta: '3.50',
        stockMinimo: '3',
      },
      ctx.productos,
    )
    expect(error).toEqual({
      codigo: 'PRECIO_COMPRA_NEGATIVO',
      mensaje: 'El precio de compra no puede ser negativo',
    })
  })

  it('devuelve el error de precio de venta inválido', async () => {
    const ctx = construirDependencias()
    const error = await validarNuevo(
      {
        nombre: 'Nuevo producto',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '0.00',
        stockMinimo: '3',
      },
      ctx.productos,
    )
    expect(error?.codigo).toBe('PRECIO_VENTA_INVALIDO')
  })

  it('devuelve el error de stock inicial negativo', async () => {
    const ctx = construirDependencias()
    const error = await validarNuevo(
      {
        nombre: 'Nuevo producto',
        categoriaId: 'c1',
        unidad: 'UNIDAD',
        precioCompra: '2.40',
        precioVenta: '3.50',
        stockMinimo: '3',
        stockInicial: '-1',
      },
      ctx.productos,
    )
    expect(error?.codigo).toBe('STOCK_INICIAL_NEGATIVO')
  })
})

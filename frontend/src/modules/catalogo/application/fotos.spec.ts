import { beforeEach, describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { BusEnMemoria } from '@/shared/domain/eventos'
import { RelojFijo } from '@/shared/domain/reloj'
import { IdsSecuenciales } from '@/shared/domain/ids'
import { Cantidad } from '@/shared/domain/cantidad'
import type { InventarioParaCatalogo } from '@/shared/contratos/entre-modulos'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeFotosEnMemoria,
  RepositorioDeProductosEnMemoria,
} from '../infrastructure/memoria/repositorios'
import type { DependenciasDeCatalogo } from './modulo'
import { crearProducto, editarProducto } from './productos'
import { guardarFoto, obtenerFoto, quitarFoto } from './fotos'

/** Doble mínimo de Inventario: ninguno de estos tests registra stock inicial. */
class InventarioFalso implements InventarioParaCatalogo {
  async stockDe(): Promise<Cantidad> {
    return Cantidad.cero()
  }
  async existencias(): Promise<Map<string, Cantidad>> {
    return new Map()
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
  async registrarStockInicial(): Promise<void> {}
  async retirarStock(): Promise<void> {}
}

function construirDependencias() {
  const almacen = new AlmacenEnMemoria()
  const productos = new RepositorioDeProductosEnMemoria(almacen)
  const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
  const fotos = new RepositorioDeFotosEnMemoria(almacen)
  const uow = new UnidadDeTrabajoEnMemoria(almacen)
  const reloj = new RelojFijo('2026-10-15T10:00:00.000Z')
  const ids = new IdsSecuenciales('p')
  const bus = new BusEnMemoria()
  const inventario = new InventarioFalso()
  const deps: DependenciasDeCatalogo = {
    productos,
    categorias,
    fotos,
    procesadorDeFotos: {
      reducir: async (imagen: Blob) => new Blob([imagen], { type: 'image/webp' }),
    },
    uow,
    reloj,
    ids,
    bus,
    inventario: () => inventario,
    ventas: () => ({ vecesVendido: async () => new Map() }),
  }
  return { deps, productos, categorias, fotos }
}

describe('guardarFoto / obtenerFoto / quitarFoto (RN-CAT-14)', () => {
  let ctx: ReturnType<typeof construirDependencias>
  let productoId: string

  beforeEach(async () => {
    ctx = construirDependencias()
    await ctx.categorias.guardar({ id: 'c1', nombre: 'Otros', nombreNormalizado: 'otros' })
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

  it('obtenerFoto es null antes de guardar una', async () => {
    expect(await obtenerFoto(productoId, ctx.deps)).toBeNull()
  })

  it('guardarFoto reduce la imagen con el procesador y marca tieneFoto', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3])])
    await guardarFoto(productoId, original, ctx.deps)

    const guardada = await obtenerFoto(productoId, ctx.deps)
    expect(guardada?.type).toBe('image/webp')
    expect((await ctx.productos.porId(productoId))?.tieneFoto).toBe(true)
  })

  it('guardarFoto lanza "No encontramos ese producto" si no existe', async () => {
    await expect(guardarFoto('no-existe', new Blob([]), ctx.deps)).rejects.toThrow(
      'No encontramos ese producto',
    )
  })

  it('quitarFoto elimina la foto y desmarca tieneFoto', async () => {
    await guardarFoto(productoId, new Blob([new Uint8Array([1])]), ctx.deps)
    await quitarFoto(productoId, ctx.deps)

    expect(await obtenerFoto(productoId, ctx.deps)).toBeNull()
    expect((await ctx.productos.porId(productoId))?.tieneFoto).toBe(false)
  })

  it('quitarFoto lanza "No encontramos ese producto" si no existe', async () => {
    await expect(quitarFoto('no-existe', ctx.deps)).rejects.toThrow('No encontramos ese producto')
  })

  it('guardarFoto concurrente con editarProducto conserva la edición', async () => {
    let liberar!: () => void
    const compuerta = new Promise<void>((r) => (liberar = r))
    const lenta: DependenciasDeCatalogo = {
      ...ctx.deps,
      procesadorDeFotos: {
        reducir: async (imagen) => {
          await compuerta
          return imagen
        },
      },
    }
    const guardando = guardarFoto(productoId, new Blob([new Uint8Array([1])]), lenta)
    await editarProducto({ productoId, nombre: 'Escoba reforzada' }, ctx.deps)
    liberar()
    await guardando

    const final = await ctx.productos.porId(productoId)
    expect(final?.nombre).toBe('Escoba reforzada')
    expect(final?.tieneFoto).toBe(true)
  })

  it('guardarFoto reduce la imagen ANTES de abrir la unidad de trabajo', async () => {
    const orden: string[] = []
    const espia: DependenciasDeCatalogo = {
      ...ctx.deps,
      procesadorDeFotos: {
        reducir: async (imagen) => {
          orden.push('reducir')
          return imagen
        },
      },
      uow: {
        ejecutar: (trabajo) => {
          orden.push('uow')
          return ctx.deps.uow.ejecutar(trabajo)
        },
        alConfirmar: (accion) => ctx.deps.uow.alConfirmar(accion),
      },
    }
    await guardarFoto(productoId, new Blob([new Uint8Array([1])]), espia)
    expect(orden).toEqual(['reducir', 'uow'])
  })

  it('quitarFoto relee el producto dentro de la unidad de trabajo y conserva ediciones intermedias', async () => {
    await guardarFoto(productoId, new Blob([new Uint8Array([1])]), ctx.deps)
    const interferente: DependenciasDeCatalogo = {
      ...ctx.deps,
      uow: {
        ejecutar: async (trabajo) => {
          await editarProducto({ productoId, nombre: 'Escoba nueva' }, ctx.deps)
          return ctx.deps.uow.ejecutar(trabajo)
        },
        alConfirmar: (accion) => ctx.deps.uow.alConfirmar(accion),
      },
    }
    await quitarFoto(productoId, interferente)
    const final = await ctx.productos.porId(productoId)
    expect(final?.nombre).toBe('Escoba nueva')
    expect(final?.tieneFoto).toBe(false)
  })
})

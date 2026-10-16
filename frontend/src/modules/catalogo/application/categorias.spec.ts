import { beforeEach, describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { IdsSecuenciales } from '@/shared/domain/ids'
import {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeProductosEnMemoria,
} from '../infrastructure/memoria/repositorios'
import {
  categoriaPorNombre,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
  renombrarCategoria,
  sembrarCategoriasIniciales,
} from './categorias'
import type { RepositorioDeCategorias } from './puertos'

describe('crearCategoria (RN-CAT-15)', () => {
  let categorias: RepositorioDeCategoriasEnMemoria
  let uow: UnidadDeTrabajoEnMemoria
  let ids: IdsSecuenciales

  beforeEach(() => {
    const almacen = new AlmacenEnMemoria()
    categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    uow = new UnidadDeTrabajoEnMemoria(almacen)
    ids = new IdsSecuenciales('c')
  })

  it('crea la categoría y devuelve su id', async () => {
    const id = await crearCategoria(categorias, ids, uow, 'Bolsas')
    expect(id).toBe('c-1')
    expect((await categorias.porId('c-1'))?.nombre).toBe('Bolsas')
  })

  it('rechaza un nombre fuera de rango (2 a 40 letras)', async () => {
    await expect(crearCategoria(categorias, ids, uow, 'B')).rejects.toThrow(
      'El nombre de la categoría debe tener entre 2 y 40 letras',
    )
  })

  it('rechaza un nombre que ya existe (comparación normalizada)', async () => {
    await crearCategoria(categorias, ids, uow, 'Carbón y combustibles')
    await expect(crearCategoria(categorias, ids, uow, 'carbon y combustibles')).rejects.toThrow(
      'Ya existe una categoría con ese nombre',
    )
  })
})

describe('renombrarCategoria', () => {
  it('cambia el nombre', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    const id = await crearCategoria(categorias, ids, uow, 'Bolsas')
    await renombrarCategoria(categorias, uow, id, 'Bolsas y envoltorios')
    expect((await categorias.porId(id))?.nombre).toBe('Bolsas y envoltorios')
  })

  it('lanza "No encontramos esa categoría" si no existe', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(renombrarCategoria(categorias, uow, 'no-existe', 'Nueva')).rejects.toThrow(
      'No encontramos esa categoría',
    )
  })

  it('rechaza renombrar a un nombre que ya usa OTRA categoría', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    await crearCategoria(categorias, ids, uow, 'Bolsas')
    const otraId = await crearCategoria(categorias, ids, uow, 'Otros')
    await expect(renombrarCategoria(categorias, uow, otraId, 'bolsas')).rejects.toThrow(
      'Ya existe una categoría con ese nombre',
    )
  })

  it('permite guardar el mismo nombre que ya tenía', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    const id = await crearCategoria(categorias, ids, uow, 'Bolsas')
    await expect(renombrarCategoria(categorias, uow, id, 'Bolsas')).resolves.toBeUndefined()
  })
})

describe('eliminarCategoria (RN-CAT-15)', () => {
  it('lanza "No encontramos esa categoría" si no existe', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const productos = new RepositorioDeProductosEnMemoria(almacen)
    await expect(eliminarCategoria(categorias, productos, uow, 'no-existe')).rejects.toThrow(
      'No encontramos esa categoría',
    )
  })

  it('rechaza eliminar una categoría con productos (activos o archivados)', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const productos = new RepositorioDeProductosEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    const id = await crearCategoria(categorias, ids, uow, 'Otros')
    await productos.guardar({
      id: 'p1',
      nombre: 'Escoba',
      nombreNormalizado: 'escoba',
      categoriaId: id,
      unidad: 'UNIDAD',
      precioCompra: 600,
      precioVenta: 900,
      stockMinimo: 2000,
      tieneFoto: false,
      estado: 'ARCHIVADO',
      creadoEn: '2026-10-15T10:00:00.000Z',
      actualizadoEn: '2026-10-15T10:00:00.000Z',
    })
    await expect(eliminarCategoria(categorias, productos, uow, id)).rejects.toThrow(
      'La categoría tiene productos. Puedes cambiarle el nombre',
    )
  })

  it('elimina una categoría sin productos', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const productos = new RepositorioDeProductosEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    const id = await crearCategoria(categorias, ids, uow, 'Otros')
    await eliminarCategoria(categorias, productos, uow, id)
    expect(await categorias.porId(id)).toBeNull()
  })
})

describe('sembrarCategoriasIniciales', () => {
  it('crea las 10 categorías iniciales en orden si no hay ninguna', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    await sembrarCategoriasIniciales(categorias, ids, uow)
    const todas = await categorias.todas()
    expect(todas).toHaveLength(10)
    expect(todas.map((c) => c.nombre)).toEqual([
      'Lejías y desinfectantes',
      'Detergentes y jabones',
      'Lavavajillas',
      'Limpiadores y ceras',
      'Papel y descartables',
      'Bolsas',
      'Escobas, trapeadores y accesorios',
      'Ambientadores e insecticidas',
      'Carbón y combustibles',
      'Otros',
    ])
  })

  it('no hace nada si ya hay alguna categoría', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    await crearCategoria(categorias, ids, uow, 'Mi categoría')
    await sembrarCategoriasIniciales(categorias, ids, uow)
    expect(await categorias.todas()).toHaveLength(1)
  })
})

describe('listarCategorias', () => {
  it('devuelve id y nombre de cada categoría', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    const id = await crearCategoria(categorias, ids, uow, 'Bolsas')
    expect(await listarCategorias(categorias)).toEqual([{ id, nombre: 'Bolsas' }])
  })
})

describe('categoriaPorNombre', () => {
  it('encuentra el id por el nombre normalizado', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    const id = await crearCategoria(categorias, ids, uow, 'Carbón y combustibles')
    expect(await categoriaPorNombre(categorias, 'carbon y combustibles')).toBe(id)
  })
  it('devuelve null si no existe', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    expect(await categoriaPorNombre(categorias, 'no existe')).toBeNull()
  })
})

describe('sembrarCategoriasIniciales: atomicidad (UoW)', () => {
  it('si un guardado falla a mitad, no queda ninguna categoría y un reintento siembra las 10', async () => {
    const almacen = new AlmacenEnMemoria()
    const real = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    let guardados = 0
    let fallar = true
    const inestable: RepositorioDeCategorias = {
      guardar: async (r) => {
        guardados += 1
        if (fallar && guardados === 5) throw new Error('disco lleno')
        return real.guardar(r)
      },
      porId: (id) => real.porId(id),
      porNombreNormalizado: (n) => real.porNombreNormalizado(n),
      todas: () => real.todas(),
      eliminar: (id) => real.eliminar(id),
    }
    await expect(sembrarCategoriasIniciales(inestable, ids, uow)).rejects.toThrow('disco lleno')
    expect(await real.todas()).toHaveLength(0)

    fallar = false
    await sembrarCategoriasIniciales(inestable, ids, uow)
    expect(await real.todas()).toHaveLength(10)
  })

  it('dos siembras concurrentes crean las 10 una sola vez', async () => {
    const almacen = new AlmacenEnMemoria()
    const categorias = new RepositorioDeCategoriasEnMemoria(almacen)
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const ids = new IdsSecuenciales('c')
    await Promise.all([
      sembrarCategoriasIniciales(categorias, ids, uow),
      sembrarCategoriasIniciales(categorias, ids, uow),
    ])
    expect(await categorias.todas()).toHaveLength(10)
  })
})

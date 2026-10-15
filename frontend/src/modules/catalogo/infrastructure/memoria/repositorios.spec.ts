import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import type { CategoriaRegistro, ProductoRegistro } from '@/shared/contratos/registros'
import {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeFotosEnMemoria,
  RepositorioDeProductosEnMemoria,
} from './repositorios'

function productoDe(datos: Partial<ProductoRegistro> = {}): ProductoRegistro {
  return {
    id: 'p1',
    nombre: 'Lejía 1 L',
    nombreNormalizado: 'lejia 1 l',
    categoriaId: 'c1',
    unidad: 'UNIDAD',
    precioCompra: 240,
    precioVenta: 350,
    stockMinimo: 3000,
    tieneFoto: false,
    estado: 'ACTIVO',
    creadoEn: '2026-10-15T15:00:00.000Z',
    actualizadoEn: '2026-10-15T15:00:00.000Z',
    ...datos,
  }
}

function categoriaDe(datos: Partial<CategoriaRegistro> = {}): CategoriaRegistro {
  return {
    id: 'c1',
    nombre: 'Lejías y desinfectantes',
    nombreNormalizado: 'lejias y desinfectantes',
    ...datos,
  }
}

describe('RepositorioDeProductosEnMemoria', () => {
  it('guarda y lee por id', async () => {
    const repo = new RepositorioDeProductosEnMemoria(new AlmacenEnMemoria())
    await repo.guardar(productoDe())
    expect(await repo.porId('p1')).toEqual(productoDe())
  })
  it('porId devuelve null si no existe', async () => {
    const repo = new RepositorioDeProductosEnMemoria(new AlmacenEnMemoria())
    expect(await repo.porId('no-existe')).toBeNull()
  })
  it('porNombreNormalizado encuentra por el nombre normalizado, sin importar mayúsculas/tildes', async () => {
    const repo = new RepositorioDeProductosEnMemoria(new AlmacenEnMemoria())
    await repo.guardar(productoDe())
    expect(await repo.porNombreNormalizado('lejia 1 l')).toEqual(productoDe())
    expect(await repo.porNombreNormalizado('otro')).toBeNull()
  })
  it('todos devuelve todos los productos guardados', async () => {
    const repo = new RepositorioDeProductosEnMemoria(new AlmacenEnMemoria())
    await repo.guardar(productoDe({ id: 'p1' }))
    await repo.guardar(productoDe({ id: 'p2', nombre: 'Escoba', nombreNormalizado: 'escoba' }))
    const todos = await repo.todos()
    expect(todos).toHaveLength(2)
    expect(todos.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })
  it('hayConCategoria es true si algún producto (activo o archivado) usa esa categoría', async () => {
    const repo = new RepositorioDeProductosEnMemoria(new AlmacenEnMemoria())
    expect(await repo.hayConCategoria('c1')).toBe(false)
    await repo.guardar(productoDe({ categoriaId: 'c1', estado: 'ARCHIVADO' }))
    expect(await repo.hayConCategoria('c1')).toBe(true)
    expect(await repo.hayConCategoria('otra-categoria')).toBe(false)
  })
})

describe('RepositorioDeCategoriasEnMemoria', () => {
  it('guarda y lee por id', async () => {
    const repo = new RepositorioDeCategoriasEnMemoria(new AlmacenEnMemoria())
    await repo.guardar(categoriaDe())
    expect(await repo.porId('c1')).toEqual(categoriaDe())
  })
  it('porNombreNormalizado encuentra por el nombre normalizado', async () => {
    const repo = new RepositorioDeCategoriasEnMemoria(new AlmacenEnMemoria())
    await repo.guardar(categoriaDe())
    expect(await repo.porNombreNormalizado('lejias y desinfectantes')).toEqual(categoriaDe())
    expect(await repo.porNombreNormalizado('otra')).toBeNull()
  })
  it('todas devuelve todas las categorías', async () => {
    const repo = new RepositorioDeCategoriasEnMemoria(new AlmacenEnMemoria())
    await repo.guardar(categoriaDe({ id: 'c1' }))
    await repo.guardar(categoriaDe({ id: 'c2', nombre: 'Otros', nombreNormalizado: 'otros' }))
    expect((await repo.todas()).map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })
  it('eliminar la quita del repositorio', async () => {
    const repo = new RepositorioDeCategoriasEnMemoria(new AlmacenEnMemoria())
    await repo.guardar(categoriaDe())
    await repo.eliminar('c1')
    expect(await repo.porId('c1')).toBeNull()
  })
})

describe('RepositorioDeFotosEnMemoria', () => {
  it('guarda y obtiene la foto de un producto', async () => {
    const repo = new RepositorioDeFotosEnMemoria(new AlmacenEnMemoria())
    const imagen = new Blob([new Uint8Array([1, 2, 3])])
    await repo.guardar({ productoId: 'p1', imagen })
    const obtenida = await repo.obtener('p1')
    expect(obtenida?.size).toBe(imagen.size)
  })
  it('obtener devuelve null si no hay foto', async () => {
    const repo = new RepositorioDeFotosEnMemoria(new AlmacenEnMemoria())
    expect(await repo.obtener('p1')).toBeNull()
  })
  it('eliminar quita la foto', async () => {
    const repo = new RepositorioDeFotosEnMemoria(new AlmacenEnMemoria())
    await repo.guardar({ productoId: 'p1', imagen: new Blob([new Uint8Array([1])]) })
    await repo.eliminar('p1')
    expect(await repo.obtener('p1')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import type { CategoriaRegistro, ProductoRegistro } from '@/shared/contratos/registros'
import type {
  RepositorioDeCategorias,
  RepositorioDeFotos,
  RepositorioDeProductos,
} from '../../application/puertos'

/**
 * Casos de prueba de los puertos de Catálogo: los mismos para la implementación en memoria y
 * la de Dexie (los resultados deben ser idénticos). `crear` devuelve un repositorio vacío.
 */
export interface FabricasDeRepositoriosDeCatalogo {
  productos: () => RepositorioDeProductos
  categorias: () => RepositorioDeCategorias
  fotos: () => RepositorioDeFotos
}

export function productoDe(datos: Partial<ProductoRegistro> = {}): ProductoRegistro {
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

export function categoriaDe(datos: Partial<CategoriaRegistro> = {}): CategoriaRegistro {
  return {
    id: 'c1',
    nombre: 'Lejías y desinfectantes',
    nombreNormalizado: 'lejias y desinfectantes',
    ...datos,
  }
}

export function probarRepositorioDeProductos(crear: () => RepositorioDeProductos): void {
  it('guarda y lee por id', async () => {
    const repo = crear()
    await repo.guardar(productoDe())
    expect(await repo.porId('p1')).toEqual(productoDe())
  })
  it('porId devuelve null si no existe', async () => {
    const repo = crear()
    expect(await repo.porId('no-existe')).toBeNull()
  })
  it('guardar reemplaza el producto con el mismo id', async () => {
    const repo = crear()
    await repo.guardar(productoDe())
    await repo.guardar(productoDe({ precioVenta: 400, estado: 'ARCHIVADO' }))
    expect(await repo.porId('p1')).toEqual(productoDe({ precioVenta: 400, estado: 'ARCHIVADO' }))
    expect(await repo.todos()).toHaveLength(1)
  })
  it('lo devuelto es una copia: cambiarlo no cambia lo guardado', async () => {
    const repo = crear()
    await repo.guardar(productoDe())
    const leido = await repo.porId('p1')
    leido!.nombre = 'Cambiado'
    expect((await repo.porId('p1'))?.nombre).toBe('Lejía 1 L')
  })
  it('porNombreNormalizado encuentra por el nombre normalizado, sin importar mayúsculas/tildes', async () => {
    const repo = crear()
    await repo.guardar(productoDe())
    expect(await repo.porNombreNormalizado('lejia 1 l')).toEqual(productoDe())
    expect(await repo.porNombreNormalizado('otro')).toBeNull()
  })
  it('todos devuelve todos los productos guardados', async () => {
    const repo = crear()
    await repo.guardar(productoDe({ id: 'p1' }))
    await repo.guardar(productoDe({ id: 'p2', nombre: 'Escoba', nombreNormalizado: 'escoba' }))
    const todos = await repo.todos()
    expect(todos).toHaveLength(2)
    expect(todos.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })
  it('hayConCategoria es true si algún producto (activo o archivado) usa esa categoría', async () => {
    const repo = crear()
    expect(await repo.hayConCategoria('c1')).toBe(false)
    await repo.guardar(productoDe({ categoriaId: 'c1', estado: 'ARCHIVADO' }))
    expect(await repo.hayConCategoria('c1')).toBe(true)
    expect(await repo.hayConCategoria('otra-categoria')).toBe(false)
  })
}

export function probarRepositorioDeCategorias(crear: () => RepositorioDeCategorias): void {
  it('guarda y lee por id', async () => {
    const repo = crear()
    await repo.guardar(categoriaDe())
    expect(await repo.porId('c1')).toEqual(categoriaDe())
    expect(await repo.porId('no-existe')).toBeNull()
  })
  it('porNombreNormalizado encuentra por el nombre normalizado', async () => {
    const repo = crear()
    await repo.guardar(categoriaDe())
    expect(await repo.porNombreNormalizado('lejias y desinfectantes')).toEqual(categoriaDe())
    expect(await repo.porNombreNormalizado('otra')).toBeNull()
  })
  it('todas devuelve todas las categorías', async () => {
    const repo = crear()
    await repo.guardar(categoriaDe({ id: 'c1' }))
    await repo.guardar(categoriaDe({ id: 'c2', nombre: 'Otros', nombreNormalizado: 'otros' }))
    expect((await repo.todas()).map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })
  it('guardar reemplaza la categoría con el mismo id (renombrar)', async () => {
    const repo = crear()
    await repo.guardar(categoriaDe())
    await repo.guardar(categoriaDe({ nombre: 'Lejías', nombreNormalizado: 'lejias' }))
    expect(await repo.todas()).toEqual([
      categoriaDe({ nombre: 'Lejías', nombreNormalizado: 'lejias' }),
    ])
    expect(await repo.porNombreNormalizado('lejias y desinfectantes')).toBeNull()
  })
  it('eliminar la quita del repositorio', async () => {
    const repo = crear()
    await repo.guardar(categoriaDe())
    await repo.eliminar('c1')
    expect(await repo.porId('c1')).toBeNull()
    await expect(repo.eliminar('no-existe')).resolves.toBeUndefined()
  })
}

export function probarRepositorioDeFotos(crear: () => RepositorioDeFotos): void {
  it('guarda y obtiene la foto de un producto, con su contenido y su tipo', async () => {
    const repo = crear()
    const imagen = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    await repo.guardar({ productoId: 'p1', imagen })
    const obtenida = await repo.obtener('p1')
    expect(obtenida?.size).toBe(imagen.size)
    expect(obtenida?.type).toBe('image/webp')
    expect([...new Uint8Array(await obtenida!.arrayBuffer())]).toEqual([1, 2, 3])
  })
  it('obtener devuelve null si no hay foto', async () => {
    const repo = crear()
    expect(await repo.obtener('p1')).toBeNull()
  })
  it('guardar otra foto del mismo producto la reemplaza', async () => {
    const repo = crear()
    await repo.guardar({ productoId: 'p1', imagen: new Blob([new Uint8Array([1])]) })
    await repo.guardar({ productoId: 'p1', imagen: new Blob([new Uint8Array([7, 7])]) })
    expect((await repo.obtener('p1'))?.size).toBe(2)
  })
  it('eliminar quita la foto', async () => {
    const repo = crear()
    await repo.guardar({ productoId: 'p1', imagen: new Blob([new Uint8Array([1])]) })
    await repo.eliminar('p1')
    expect(await repo.obtener('p1')).toBeNull()
  })
}

/** Corre los tres contratos de Catálogo con las fábricas de una implementación. */
export function probarRepositoriosDeCatalogo(
  nombre: string,
  fabricas: FabricasDeRepositoriosDeCatalogo,
): void {
  describe(`RepositorioDeProductos${nombre}`, () =>
    probarRepositorioDeProductos(fabricas.productos))
  describe(`RepositorioDeCategorias${nombre}`, () =>
    probarRepositorioDeCategorias(fabricas.categorias))
  describe(`RepositorioDeFotos${nombre}`, () => probarRepositorioDeFotos(fabricas.fotos))
}

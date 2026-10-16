import type {
  CategoriaRegistro,
  FotoRegistro,
  ProductoRegistro,
} from '@/shared/contratos/registros'
import type { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import type {
  RepositorioDeCategorias,
  RepositorioDeFotos,
  RepositorioDeProductos,
} from '../../application/puertos'

/** `RepositorioDeProductos` sobre la tabla `productos` (índices nombreNormalizado y categoriaId). */
export class RepositorioDeProductosDexie implements RepositorioDeProductos {
  constructor(private readonly db: BaseDeDatos) {}

  async guardar(r: ProductoRegistro): Promise<void> {
    await this.db.productos.put(r)
  }

  async porId(id: string): Promise<ProductoRegistro | null> {
    return (await this.db.productos.get(id)) ?? null
  }

  async porNombreNormalizado(n: string): Promise<ProductoRegistro | null> {
    return (await this.db.productos.where('nombreNormalizado').equals(n).first()) ?? null
  }

  todos(): Promise<ProductoRegistro[]> {
    return this.db.productos.toArray()
  }

  async hayConCategoria(categoriaId: string): Promise<boolean> {
    return (await this.db.productos.where('categoriaId').equals(categoriaId).count()) > 0
  }
}

/** `RepositorioDeCategorias` sobre la tabla `categorias` (índice nombreNormalizado). */
export class RepositorioDeCategoriasDexie implements RepositorioDeCategorias {
  constructor(private readonly db: BaseDeDatos) {}

  async guardar(r: CategoriaRegistro): Promise<void> {
    await this.db.categorias.put(r)
  }

  async porId(id: string): Promise<CategoriaRegistro | null> {
    return (await this.db.categorias.get(id)) ?? null
  }

  async porNombreNormalizado(n: string): Promise<CategoriaRegistro | null> {
    return (await this.db.categorias.where('nombreNormalizado').equals(n).first()) ?? null
  }

  todas(): Promise<CategoriaRegistro[]> {
    return this.db.categorias.toArray()
  }

  async eliminar(id: string): Promise<void> {
    await this.db.categorias.delete(id)
  }
}

/** `RepositorioDeFotos` sobre la tabla `fotos`: IndexedDB guarda el Blob tal cual. */
export class RepositorioDeFotosDexie implements RepositorioDeFotos {
  constructor(private readonly db: BaseDeDatos) {}

  async guardar(r: FotoRegistro): Promise<void> {
    await this.db.fotos.put(r)
  }

  async obtener(productoId: string): Promise<Blob | null> {
    return (await this.db.fotos.get(productoId))?.imagen ?? null
  }

  async eliminar(productoId: string): Promise<void> {
    await this.db.fotos.delete(productoId)
  }
}

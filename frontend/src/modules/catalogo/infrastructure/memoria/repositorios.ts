import type {
  CategoriaRegistro,
  FotoRegistro,
  ProductoRegistro,
} from '@/shared/contratos/registros'
import type { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import type {
  RepositorioDeCategorias,
  RepositorioDeFotos,
  RepositorioDeProductos,
} from '../../application/puertos'

export class RepositorioDeProductosEnMemoria implements RepositorioDeProductos {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async guardar(r: ProductoRegistro): Promise<void> {
    this.almacen.guardar('productos', r)
  }

  async porId(id: string): Promise<ProductoRegistro | null> {
    return this.almacen.obtener('productos', id) ?? null
  }

  async porNombreNormalizado(n: string): Promise<ProductoRegistro | null> {
    return this.almacen.todos('productos').find((p) => p.nombreNormalizado === n) ?? null
  }

  async todos(): Promise<ProductoRegistro[]> {
    return this.almacen.todos('productos')
  }

  async hayConCategoria(categoriaId: string): Promise<boolean> {
    return this.almacen.todos('productos').some((p) => p.categoriaId === categoriaId)
  }
}

export class RepositorioDeCategoriasEnMemoria implements RepositorioDeCategorias {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async guardar(r: CategoriaRegistro): Promise<void> {
    this.almacen.guardar('categorias', r)
  }

  async porId(id: string): Promise<CategoriaRegistro | null> {
    return this.almacen.obtener('categorias', id) ?? null
  }

  async porNombreNormalizado(n: string): Promise<CategoriaRegistro | null> {
    return this.almacen.todos('categorias').find((c) => c.nombreNormalizado === n) ?? null
  }

  async todas(): Promise<CategoriaRegistro[]> {
    return this.almacen.todos('categorias')
  }

  async eliminar(id: string): Promise<void> {
    this.almacen.eliminar('categorias', id)
  }
}

export class RepositorioDeFotosEnMemoria implements RepositorioDeFotos {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async guardar(r: FotoRegistro): Promise<void> {
    this.almacen.guardar('fotos', r)
  }

  async obtener(productoId: string): Promise<Blob | null> {
    return this.almacen.obtener('fotos', productoId)?.imagen ?? null
  }

  async eliminar(productoId: string): Promise<void> {
    this.almacen.eliminar('fotos', productoId)
  }
}

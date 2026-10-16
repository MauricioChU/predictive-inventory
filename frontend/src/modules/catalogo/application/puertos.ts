import type {
  CategoriaRegistro,
  FotoRegistro,
  ProductoRegistro,
} from '@/shared/contratos/registros'

export interface RepositorioDeProductos {
  guardar(r: ProductoRegistro): Promise<void>
  porId(id: string): Promise<ProductoRegistro | null>
  porNombreNormalizado(n: string): Promise<ProductoRegistro | null>
  todos(): Promise<ProductoRegistro[]>
  hayConCategoria(categoriaId: string): Promise<boolean>
}

export interface RepositorioDeCategorias {
  guardar(r: CategoriaRegistro): Promise<void>
  porId(id: string): Promise<CategoriaRegistro | null>
  porNombreNormalizado(n: string): Promise<CategoriaRegistro | null>
  todas(): Promise<CategoriaRegistro[]>
  eliminar(id: string): Promise<void>
}

export interface RepositorioDeFotos {
  guardar(r: FotoRegistro): Promise<void>
  obtener(productoId: string): Promise<Blob | null>
  eliminar(productoId: string): Promise<void>
}

export interface ProcesadorDeFotos {
  /** Reduce a ≤ 512 px en el lado mayor y comprime a ≤ 100 KB (RN-CAT-14). */
  reducir(imagen: Blob): Promise<Blob>
}

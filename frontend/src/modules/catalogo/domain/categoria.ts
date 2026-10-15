import type { CategoriaRegistro } from '@/shared/contratos/registros'
import { ErrorDeDominio } from '@/shared/domain/errores'
import { normalizar } from '@/shared/domain/texto'

/** RN-CAT-15: 2 a 40 caracteres tras recortar espacios exteriores. */
export function leerNombreDeCategoria(nombre: string): string {
  const recortado = nombre.trim()
  if (recortado.length < 2 || recortado.length > 40) {
    throw new ErrorDeDominio(
      'CATEGORIA_NOMBRE_INVALIDO',
      'El nombre de la categoría debe tener entre 2 y 40 letras',
    )
  }
  return recortado
}

/** Categoría del catálogo (01-catalogo.md). Nombre único (misma comparación que RN-CAT-01). */
export class Categoria {
  private constructor(
    private datos: {
      id: string
      nombre: string
    },
  ) {}

  static crear(id: string, nombre: string): Categoria {
    return new Categoria({ id, nombre })
  }

  static desdeRegistro(r: CategoriaRegistro): Categoria {
    return new Categoria({ id: r.id, nombre: r.nombre })
  }

  aRegistro(): CategoriaRegistro {
    return {
      id: this.datos.id,
      nombre: this.datos.nombre,
      nombreNormalizado: this.nombreNormalizado,
    }
  }

  get id(): string {
    return this.datos.id
  }
  get nombre(): string {
    return this.datos.nombre
  }
  get nombreNormalizado(): string {
    return normalizar(this.datos.nombre)
  }

  renombrar(nombre: string): void {
    this.datos.nombre = nombre
  }
}

/** Categorías iniciales en el orden de 01-catalogo.md. */
export const CATEGORIAS_INICIALES: readonly string[] = [
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
]

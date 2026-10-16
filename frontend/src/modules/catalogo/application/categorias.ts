import { ErrorDeDominio } from '@/shared/domain/errores'
import type { GeneradorDeIds } from '@/shared/domain/ids'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import { normalizar } from '@/shared/domain/texto'
import type { CategoriaRegistro } from '@/shared/contratos/registros'
import { CATEGORIAS_INICIALES, Categoria, leerNombreDeCategoria } from '../domain/categoria'
import type { CategoriaVista } from './modulo'
import type { RepositorioDeCategorias, RepositorioDeProductos } from './puertos'

async function obtenerRegistro(
  categorias: RepositorioDeCategorias,
  categoriaId: string,
): Promise<CategoriaRegistro> {
  const registro = await categorias.porId(categoriaId)
  if (!registro) throw new ErrorDeDominio('CATEGORIA_NO_ENCONTRADA', 'No encontramos esa categoría')
  return registro
}

async function verificarNombreLibre(
  categorias: RepositorioDeCategorias,
  normalizado: string,
  idPropio: string | null,
): Promise<void> {
  const existente = await categorias.porNombreNormalizado(normalizado)
  if (existente && existente.id !== idPropio) {
    throw new ErrorDeDominio('CATEGORIA_NOMBRE_DUPLICADO', 'Ya existe una categoría con ese nombre')
  }
}

/** RN-CAT-15: 2 a 40 letras y nombre único (misma comparación que RN-CAT-01). */
export async function crearCategoria(
  categorias: RepositorioDeCategorias,
  ids: GeneradorDeIds,
  uow: UnidadDeTrabajo,
  nombreCrudo: string,
): Promise<string> {
  const nombre = leerNombreDeCategoria(nombreCrudo)
  return uow.ejecutar(async () => {
    await verificarNombreLibre(categorias, normalizar(nombre), null)
    const categoria = Categoria.crear(ids.nuevo(), nombre)
    await categorias.guardar(categoria.aRegistro())
    return categoria.id
  })
}

export async function renombrarCategoria(
  categorias: RepositorioDeCategorias,
  uow: UnidadDeTrabajo,
  categoriaId: string,
  nombreCrudo: string,
): Promise<void> {
  const nombre = leerNombreDeCategoria(nombreCrudo)
  await uow.ejecutar(async () => {
    const registro = await obtenerRegistro(categorias, categoriaId)
    await verificarNombreLibre(categorias, normalizar(nombre), categoriaId)
    const categoria = Categoria.desdeRegistro(registro)
    categoria.renombrar(nombre)
    await categorias.guardar(categoria.aRegistro())
  })
}

/** RN-CAT-15: una categoría con productos (activos o archivados) no se puede eliminar. */
export async function eliminarCategoria(
  categorias: RepositorioDeCategorias,
  productos: RepositorioDeProductos,
  uow: UnidadDeTrabajo,
  categoriaId: string,
): Promise<void> {
  await uow.ejecutar(async () => {
    await obtenerRegistro(categorias, categoriaId)
    const hayProductos = await productos.hayConCategoria(categoriaId)
    if (hayProductos) {
      throw new ErrorDeDominio(
        'CATEGORIA_CON_PRODUCTOS',
        'La categoría tiene productos. Puedes cambiarle el nombre',
      )
    }
    await categorias.eliminar(categoriaId)
  })
}

/** Crea las categorías iniciales en orden, solo si todavía no hay ninguna. */
export async function sembrarCategoriasIniciales(
  categorias: RepositorioDeCategorias,
  ids: GeneradorDeIds,
  uow: UnidadDeTrabajo,
): Promise<void> {
  // Una sola unidad de trabajo: o se siembran las 10 o ninguna, y la comprobación de
  // "vacío" ocurre dentro para que dos siembras seguidas no dupliquen.
  await uow.ejecutar(async () => {
    const existentes = await categorias.todas()
    if (existentes.length > 0) return
    for (const nombre of CATEGORIAS_INICIALES) {
      await categorias.guardar(Categoria.crear(ids.nuevo(), nombre).aRegistro())
    }
  })
}

/**
 * Por nombre, como lo compara RN-CAT-01 (sin tildes ni mayúsculas): el orden no depende del
 * repositorio (en Dexie, por id; en memoria, por creación).
 */
export async function listarCategorias(
  categorias: RepositorioDeCategorias,
): Promise<CategoriaVista[]> {
  const todas = await categorias.todas()
  return todas
    .map((c) => ({ id: c.id, nombre: c.nombre, clave: c.nombreNormalizado }))
    .sort((a, b) => Number(a.clave > b.clave) - Number(a.clave < b.clave))
    .map(({ id, nombre }) => ({ id, nombre }))
}

export async function categoriaPorNombre(
  categorias: RepositorioDeCategorias,
  nombre: string,
): Promise<string | null> {
  const existente = await categorias.porNombreNormalizado(normalizar(nombre))
  return existente?.id ?? null
}

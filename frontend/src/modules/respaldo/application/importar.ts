import { normalizar } from '../../../shared/domain/texto'
import type {
  DatosDeProductoNuevo,
  ErrorDeValidacion,
} from '../../../shared/contratos/entre-modulos'
import { formatearProblema, leerFilas, type FilaValidaDeImportacion } from '../domain/importacion'
import type { DependenciasDeRespaldo } from './puertos'

/** Categoría todavía no creada: se la marca así para que validarNuevo/crear la reconozcan
 * como pendiente de crear (RN-RE-07/08). */
const CATEGORIA_NUEVA = '__nueva__'

export interface Previsualizacion {
  validas: { fila: number; datos: DatosDeProductoNuevo; categoriaNombre: string }[]
  conProblemas: { fila: number; problema: string }[]
}

function primeraMinuscula(texto: string): string {
  return texto.length === 0 ? texto : texto[0]!.toLowerCase() + texto.slice(1)
}

function mensajeDelError(error: ErrorDeValidacion, nombreDeLaFila: string): string {
  if (error.codigo === 'NOMBRE_DUPLICADO') {
    return `ya existe un producto llamado "${error.nombreExistente}"`
  }
  if (error.codigo === 'CANTIDAD_ENTERA') {
    return `${nombreDeLaFila} se cuenta por unidades enteras`
  }
  return primeraMinuscula(error.mensaje)
}

function datosDeLaFila(fila: FilaValidaDeImportacion, categoriaId: string): DatosDeProductoNuevo {
  return {
    nombre: fila.nombre,
    categoriaId,
    unidad: fila.unidad,
    precioCompra: fila.precioCompra,
    precioVenta: fila.precioVenta,
    stockMinimo: fila.stockMinimo,
    ...(fila.stockInicial !== undefined ? { stockInicial: fila.stockInicial } : {}),
  }
}

/**
 * RN-RE-07/08: lee el Excel, valida cada fila con las reglas de dominio (encabezados,
 * requeridos, unidad, repetidos) y luego, fila por fila, contra el catálogo (nombre
 * duplicado, cantidades por unidades enteras, etc.).
 */
export async function previsualizarImportacion(
  deps: DependenciasDeRespaldo,
  archivo: Blob,
): Promise<Previsualizacion> {
  const filas = await deps.lectorDeExcel.leerPrimeraHoja(archivo)
  const resultado = leerFilas(filas)
  const catalogo = deps.catalogo()

  const validas: Previsualizacion['validas'] = []
  const conProblemas: Previsualizacion['conProblemas'] = resultado.conProblemas.map((p) => ({
    fila: p.fila,
    problema: formatearProblema(p.fila, p.problema),
  }))

  for (const fila of resultado.validas) {
    const categoriaIdExistente = await catalogo.importacion.categoriaPorNombre(fila.categoriaNombre)
    const categoriaId = categoriaIdExistente ?? CATEGORIA_NUEVA
    const datos = datosDeLaFila(fila, categoriaId)

    const error = await catalogo.importacion.validarNuevo(datos)
    if (error) {
      conProblemas.push({
        fila: fila.fila,
        problema: formatearProblema(fila.fila, mensajeDelError(error, fila.nombre)),
      })
      continue
    }

    validas.push({ fila: fila.fila, datos, categoriaNombre: fila.categoriaNombre })
  }

  conProblemas.sort((a, b) => a.fila - b.fila)
  return { validas, conProblemas }
}

/** RN-RE-07/08: crea las categorías que falten (una vez cada una) y los productos de las
 * filas válidas, dentro de una sola unidad de trabajo. */
export async function confirmarImportacion(
  deps: DependenciasDeRespaldo,
  previsualizacion: Previsualizacion,
): Promise<{ importados: number }> {
  return deps.uow.ejecutar(async () => {
    const catalogo = deps.catalogo()
    const idsDeCategoriaNueva = new Map<string, string>()
    let importados = 0

    for (const fila of previsualizacion.validas) {
      let datos = fila.datos
      if (datos.categoriaId === CATEGORIA_NUEVA) {
        const clave = normalizar(fila.categoriaNombre)
        let id = idsDeCategoriaNueva.get(clave)
        if (id === undefined) {
          id = await catalogo.importacion.crearCategoria(fila.categoriaNombre)
          idsDeCategoriaNueva.set(clave, id)
        }
        datos = { ...datos, categoriaId: id }
      }
      await catalogo.importacion.crear(datos)
      importados += 1
    }

    return { importados }
  })
}

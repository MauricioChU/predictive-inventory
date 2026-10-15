import type { Unidad } from '../../../shared/domain/cantidad'
import { ErrorDeDominio } from '../../../shared/domain/errores'
import { normalizar } from '../../../shared/domain/texto'

const COLUMNAS_REQUERIDAS = [
  'nombre',
  'categoría',
  'unidad',
  'precio de compra',
  'precio de venta',
  'stock mínimo',
  'stock inicial',
] as const

type Columna = (typeof COLUMNAS_REQUERIDAS)[number]

const UNIDADES_VALIDAS: Record<string, Unidad> = {
  unid: 'UNIDAD',
  unidad: 'UNIDAD',
  unidades: 'UNIDAD',
  u: 'UNIDAD',
  kg: 'KILO',
  kilo: 'KILO',
  kilos: 'KILO',
  l: 'LITRO',
  lt: 'LITRO',
  litro: 'LITRO',
  litros: 'LITRO',
}

/** Una fila que pasó las validaciones de dominio: le falta la validación del catálogo
 * (paso 4, RN-RE-08), que no es asunto del dominio porque depende de otro módulo. */
export interface FilaValidaDeImportacion {
  fila: number
  categoriaNombre: string
  nombre: string
  unidad: Unidad
  precioCompra: string
  precioVenta: string
  stockMinimo: string
  stockInicial?: string
}

export interface FilaConProblemaDeImportacion {
  fila: number
  /** Sin el prefijo "Fila N: " — eso lo pone formatearProblema(), igual para los problemas
   * de dominio que para los del catálogo (paso 4), que se agregan en application/importar.ts. */
  problema: string
}

export interface ResultadoDeLectura {
  validas: FilaValidaDeImportacion[]
  conProblemas: FilaConProblemaDeImportacion[]
}

/** `Fila ${n}: ${problema}` (RN-RE-07/08): formato final de cualquier problema de una fila. */
export function formatearProblema(fila: number, problema: string): string {
  return `Fila ${fila}: ${problema}`
}

function indiceDeColumna(encabezados: readonly string[], nombre: string): number {
  return encabezados.findIndex((encabezado) => normalizar(encabezado) === normalizar(nombre))
}

function mapearEncabezados(encabezados: readonly string[]): Record<Columna, number> {
  const indices = {} as Record<Columna, number>
  for (const columna of COLUMNAS_REQUERIDAS) {
    const indice = indiceDeColumna(encabezados, columna)
    if (indice === -1) {
      throw new ErrorDeDominio(
        'COLUMNA_FALTANTE',
        `El archivo no tiene la columna "${columna}". Usa la plantilla`,
      )
    }
    indices[columna] = indice
  }
  return indices
}

function unidadDeTexto(texto: string): Unidad | null {
  return UNIDADES_VALIDAS[normalizar(texto)] ?? null
}

function filaVacia(fila: readonly string[]): boolean {
  return fila.every((celda) => (celda ?? '').trim() === '')
}

/**
 * RN-RE-07/08, pasos 1 a 3 (encabezados, requeridos, unidad y repetidos dentro del
 * archivo). El paso 4 (contra el catálogo) no vive aquí: lo hace application/importar.ts,
 * que es quien tiene el puerto hacia el catálogo.
 */
export function leerFilas(matriz: readonly (readonly string[])[]): ResultadoDeLectura {
  const [encabezados, ...resto] = matriz
  const indices = mapearEncabezados(encabezados ?? [])

  const validas: FilaValidaDeImportacion[] = []
  const conProblemas: FilaConProblemaDeImportacion[] = []
  const vistos = new Map<string, number>()

  resto.forEach((fila, indice) => {
    const numeroDeFila = indice + 2 // la fila 1 es el encabezado
    if (filaVacia(fila)) return

    const celda = (columna: Columna): string => (fila[indices[columna]] ?? '').trim()

    const nombre = celda('nombre')
    const categoriaNombre = celda('categoría')
    const unidadTexto = celda('unidad')
    const precioCompra = celda('precio de compra')
    const precioVenta = celda('precio de venta')
    const stockMinimo = celda('stock mínimo')
    const stockInicialTexto = celda('stock inicial')

    const requeridos: readonly [string, string][] = [
      [nombre, 'falta el nombre'],
      [categoriaNombre, 'falta la categoría'],
      [unidadTexto, 'falta la unidad'],
      [precioCompra, 'falta el precio de compra'],
      [precioVenta, 'falta el precio de venta'],
      [stockMinimo, 'falta el stock mínimo'],
    ]
    const faltante = requeridos.find(([valor]) => valor === '')
    if (faltante) {
      conProblemas.push({ fila: numeroDeFila, problema: faltante[1] })
      return
    }

    const unidad = unidadDeTexto(unidadTexto)
    if (unidad === null) {
      conProblemas.push({
        fila: numeroDeFila,
        problema: `la unidad "${unidadTexto}" no es válida: usa unid, kg o L`,
      })
      return
    }

    const clave = normalizar(nombre)
    const primeraFila = vistos.get(clave)
    if (primeraFila !== undefined) {
      conProblemas.push({
        fila: numeroDeFila,
        problema: `"${nombre}" está repetido en la fila ${primeraFila}`,
      })
      return
    }
    vistos.set(clave, numeroDeFila)

    validas.push({
      fila: numeroDeFila,
      categoriaNombre,
      nombre,
      unidad,
      precioCompra,
      precioVenta,
      stockMinimo,
      stockInicial: stockInicialTexto === '' ? undefined : stockInicialTexto,
    })
  })

  return { validas, conProblemas }
}

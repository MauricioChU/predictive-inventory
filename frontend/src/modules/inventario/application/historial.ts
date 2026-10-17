import type { Cantidad, Unidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import type { Instante } from '@/shared/domain/fecha'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import type { TipoDeOperacion } from '@/shared/contratos/operaciones'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import { etiquetaDeOperacion } from '../domain/etiquetas'
import { Operacion } from '../domain/operacion'
import { enOrdenDeRegistro } from '../domain/orden'
import type { ContextoDeInventario } from './contexto'

export interface LineaDeOperacionVista {
  productoId: string
  nombre: string
  unidad: Unidad
  /** Con signo: + entra, − sale. */
  cantidad: Cantidad
  precioUnitario: Dinero | null
  costoUnitario: Dinero
  importe: Dinero | null
  ganancia: Dinero | null
}

export interface OperacionVista {
  id: string
  tipo: TipoDeOperacion
  /** Cómo se muestra el tipo (spec 02): "Venta", "Se derramó", "Conteo de stock"… */
  etiqueta: string
  ocurridaEn: Instante
  lineas: LineaDeOperacionVista[]
  /** Solo en ventas (RN-OP-12). */
  total: Dinero | null
  ganancia: Dinero | null
  /** RN-OP-17: tiene una anulación. */
  anulada: boolean
  anulaA: string | null
  motivo: string | null
  nota: string | null
}

export interface FiltroDeHistorial {
  productoId?: string
  tipo?: TipoDeOperacion
}

/** Plan 17: el Historial de a páginas. */
export interface ConsultaDelHistorial {
  tipo?: TipoDeOperacion
  /** El `siguiente` de la página anterior; sin él, la primera. */
  desde?: Instante
  /** Cuántas operaciones, más o menos (nunca se corta un grupo del mismo momento). */
  cuantas?: number
}

export interface PaginaDelHistorial {
  operaciones: OperacionVista[]
  /** Para pedir la página que sigue ("Ver más"); null si no hay más. */
  siguiente: Instante | null
}

/** Cuántas trae una página si no se dice. */
export const OPERACIONES_POR_PAGINA = 60

/** Ids de las operaciones que tienen una anulación (RN-OP-17). */
function idsAnulados(registros: readonly OperacionRegistro[]): Set<string> {
  return new Set(registros.flatMap((r) => (r.anulaA === null ? [] : [r.anulaA])))
}

/**
 * Del más reciente al más antiguo según cuándo ocurrió; a igual momento, lo registrado
 * después va primero.
 */
function delMasReciente(registros: readonly OperacionRegistro[]): OperacionRegistro[] {
  return enOrdenDeRegistro(registros)
    .reverse()
    .sort(
      (a, b) =>
        Date.parse(b.ocurridaEn) - Date.parse(a.ocurridaEn) ||
        Date.parse(b.registradaEn) - Date.parse(a.registradaEn),
    )
}

function vista(
  registro: OperacionRegistro,
  anulada: boolean,
  productos: ReadonlyMap<string, ProductoResumido>,
): OperacionVista {
  const operacion = Operacion.desdeRegistro(registro)
  return {
    id: operacion.id,
    tipo: operacion.tipo,
    etiqueta: etiquetaDeOperacion(operacion.tipo, operacion.motivo),
    ocurridaEn: operacion.ocurridaEn,
    lineas: operacion.lineas().map((linea) => {
      const producto = productos.get(linea.productoId)
      return {
        productoId: linea.productoId,
        nombre: producto?.nombre ?? linea.productoId,
        unidad: producto?.unidad ?? 'UNIDAD',
        cantidad: linea.cantidad,
        precioUnitario: linea.precioUnitario,
        costoUnitario: linea.costoUnitario,
        importe: linea.importe,
        ganancia: linea.ganancia,
      }
    }),
    total: operacion.total(),
    ganancia: operacion.ganancia(),
    anulada,
    anulaA: operacion.anulaA,
    motivo: operacion.motivo,
    nota: operacion.nota,
  }
}

/** HU-OP-08: todo lo que pasó (o lo de un producto), del más reciente al más antiguo. */
export async function historial(
  ctx: ContextoDeInventario,
  filtro: FiltroDeHistorial = {},
): Promise<OperacionVista[]> {
  const registros = filtro.productoId
    ? await ctx.operaciones.porProducto(filtro.productoId)
    : await ctx.operaciones.todas()
  const anuladas = idsAnulados(registros)
  const productos = new Map((await ctx.catalogo().productos()).map((p) => [p.id, p]))
  return delMasReciente(registros)
    .filter((r) => filtro.tipo === undefined || r.tipo === filtro.tipo)
    .map((r) => vista(r, anuladas.has(r.id), productos))
}

/**
 * HU-OP-08 / plan 17: una página del Historial, en el mismo orden y con la misma vista que
 * `historial()`, sin leer todo el libro: solo esa página, si tienen anulación y los productos.
 * Una tras otra dan exactamente lo mismo que el historial completo.
 */
export async function paginaDelHistorial(
  ctx: ContextoDeInventario,
  consulta: ConsultaDelHistorial = {},
): Promise<PaginaDelHistorial> {
  const { registros, siguiente } = await ctx.operaciones.recientes({
    ...(consulta.tipo ? { tipo: consulta.tipo } : {}),
    ...(consulta.desde ? { antesDe: consulta.desde } : {}),
    cuantas: Math.max(1, consulta.cuantas ?? OPERACIONES_POR_PAGINA),
  })
  const anuladas = await ctx.operaciones.conAnulacion(registros.map((r) => r.id))
  const productos = new Map((await ctx.catalogo().productos()).map((p) => [p.id, p]))
  return {
    operaciones: delMasReciente(registros).map((r) => vista(r, anuladas.has(r.id), productos)),
    siguiente,
  }
}

/**
 * HU-OP-08 (plan 12, detalle del Historial): una sola operación, con la misma vista que en el
 * historial, sin leer todo el libro: el registro, si tiene anulación y sus productos. null si
 * no existe.
 */
export async function operacionPorId(
  ctx: ContextoDeInventario,
  operacionId: string,
): Promise<OperacionVista | null> {
  const registro = await ctx.operaciones.porId(operacionId)
  if (!registro) return null
  const anulada = (await ctx.operaciones.anulacionDe(operacionId)) !== null
  const productos = new Map<string, ProductoResumido>()
  for (const productoId of registro.productoIds) {
    const producto = await ctx.catalogo().producto(productoId)
    if (producto) productos.set(producto.id, producto)
  }
  return vista(registro, anulada, productos)
}

/** RN-AN-16: cuándo llegó mercadería por última vez (sin contar ingresos anulados). */
export async function ultimoIngresoDe(
  ctx: ContextoDeInventario,
  productoId: string,
): Promise<Instante | null> {
  const registros = await ctx.operaciones.porProducto(productoId)
  const anuladas = idsAnulados(registros)
  const ingresos = registros.filter((r) => r.tipo === 'INGRESO' && !anuladas.has(r.id))
  return delMasReciente(ingresos)[0]?.ocurridaEn ?? null
}

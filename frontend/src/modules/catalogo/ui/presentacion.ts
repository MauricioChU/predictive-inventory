import type { OperacionVista } from '@/modules/inventario'
import type { EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import { MOTIVO_PRODUCTO_RETIRADO } from '@/shared/contratos/operaciones'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { diaDe, sumarDias, type Dia, type Instante } from '@/shared/domain/fecha'
import {
  formatearCantidad,
  formatearDinero,
  formatearEntero,
  plural,
} from '@/shared/domain/formato'
import { etiquetaDeDia } from '@/shared/ui/etiquetas-de-dia'
import type { EstadoVacioDeLista, ProductoDeLista } from '@/shared/ui/tipos-de-productos'
import type { ProductoVista } from '../application/modulo'

/** Los filtros por estado de la lista de Productos (06-experiencia-de-uso). */
export type FiltroDeEstado = 'TODOS' | 'SE_ACABAN' | 'POR_ACABARSE' | 'AGOTADO' | 'ARCHIVADOS'

/** RN-CAT-16: lo que dice `?estado=` en la dirección de Productos para abrirla ya filtrada. */
export function estadoDeLaDireccion(pedido: unknown): FiltroDeEstado | undefined {
  if (pedido === 'se-acaban') return 'SE_ACABAN'
  if (pedido === 'agotados') return 'AGOTADO'
  if (pedido === 'queda-poco') return 'POR_ACABARSE'
  return undefined
}

export const OPCIONES_DE_ESTADO: readonly { valor: FiltroDeEstado; etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'SE_ACABAN', etiqueta: 'Se acaban' },
  { valor: 'POR_ACABARSE', etiqueta: 'Queda poco' },
  { valor: 'AGOTADO', etiqueta: 'Agotados' },
  { valor: 'ARCHIVADOS', etiqueta: 'Archivados' },
]

/** Una fila de la lista: foto, nombre, stock con unidad, precio y estado (RN-UX-04). */
export function aFilaDeLista(
  producto: ProductoVista,
  estado: EstadoDeStock | undefined,
  imagen: Blob | undefined,
): ProductoDeLista {
  return {
    id: producto.id,
    nombre: producto.nombre,
    imagen,
    categoria: producto.categoriaNombre,
    textoStock: formatearCantidad(producto.stock, producto.unidad),
    textoPrecio: formatearDinero(producto.precioVenta),
    // RN-CAT-10: un archivado no tiene estado de stock (no entra en alertas).
    estado: producto.activo ? estado : undefined,
    textoSecundario: producto.activo ? undefined : 'Archivado',
  }
}

export function filtrarProductos(
  productos: readonly ProductoVista[],
  filtro: {
    estado: FiltroDeEstado
    /** '' = todas las categorías. */
    categoriaId: string
    estados: ReadonlyMap<string, EstadoDeStock>
  },
): ProductoVista[] {
  return productos.filter((p) => {
    if (filtro.categoriaId !== '' && p.categoriaId !== filtro.categoriaId) return false
    const estado = filtro.estados.get(p.id)
    // RN-CAT-16: "Se acaban" suma agotados y los que quedan poco.
    if (filtro.estado === 'SE_ACABAN') return estado === 'AGOTADO' || estado === 'POR_ACABARSE'
    if (filtro.estado === 'POR_ACABARSE' || filtro.estado === 'AGOTADO') {
      return estado === filtro.estado
    }
    return true
  })
}

export function textoDeConteo(n: number): string {
  return `${formatearEntero(n)} ${plural(n, 'producto', 'productos')}`
}

export interface VacioDeLista extends EstadoVacioDeLista {
  accion: string
  /** "agregar" abre el formulario; "ver-todos" quita los filtros. */
  tipoDeAccion: 'agregar' | 'ver-todos'
}

const VACIO_POR_ESTADO: Record<
  Exclude<FiltroDeEstado, 'TODOS'>,
  { titulo: string; descripcion: string }
> = {
  SE_ACABAN: {
    titulo: 'No se acaba ningún producto',
    descripcion: 'Por ahora todos tienen stock suficiente.',
  },
  POR_ACABARSE: {
    titulo: 'Ningún producto queda poco',
    descripcion: 'Por ahora ninguno se está acabando.',
  },
  AGOTADO: { titulo: 'No tienes productos agotados', descripcion: 'Todos tienen stock.' },
  ARCHIVADOS: {
    titulo: 'No tienes productos archivados',
    descripcion: 'Aquí aparecen los productos que ya no vendes.',
  },
}

/** RN-UX-10: por qué la lista está vacía y cuál es la acción siguiente. */
export function vacioDeLista(d: {
  hayProductos: boolean
  texto: string
  estado: FiltroDeEstado
  /** La categoría elegida en el filtro, o null si son todas. */
  categoriaNombre: string | null
}): VacioDeLista {
  if (!d.hayProductos) {
    return {
      titulo: 'Aún no tienes productos',
      descripcion: 'Agrega tu primer producto con su nombre, su precio y su foto.',
      accion: 'Agregar el primero',
      tipoDeAccion: 'agregar',
    }
  }
  const texto = d.texto.trim()
  const hayFiltro = d.estado !== 'TODOS' || d.categoriaNombre !== null
  if (texto !== '') {
    if (hayFiltro) {
      return {
        titulo: `No encontramos «${texto}» con este filtro`,
        descripcion: 'Puede estar en otro grupo de productos.',
        accion: 'Buscar en todos',
        tipoDeAccion: 'ver-todos',
      }
    }
    return {
      titulo: `No encontramos «${texto}»`,
      descripcion: 'Revisa cómo está escrito o agrégalo como producto nuevo.',
      accion: 'Agregar producto',
      tipoDeAccion: 'agregar',
    }
  }
  if (d.estado !== 'TODOS') {
    return { ...VACIO_POR_ESTADO[d.estado], accion: 'Ver todos', tipoDeAccion: 'ver-todos' }
  }
  if (d.categoriaNombre === null) {
    // Hay productos, pero todos archivados.
    return {
      titulo: 'No tienes productos a la venta',
      descripcion: 'Los que ya no vendes están en «Archivados».',
      accion: 'Agregar producto',
      tipoDeAccion: 'agregar',
    }
  }
  return {
    titulo: `No tienes productos en ${d.categoriaNombre}`,
    descripcion: 'Elige otra categoría o agrega un producto nuevo.',
    accion: 'Ver todas las categorías',
    tipoDeAccion: 'ver-todos',
  }
}

/** El precio como se escribe en el campo ("2.40"): el de `formatearDinero`, sin "S/" ni grupos. */
export function montoParaEditar(dinero: Dinero): string {
  return formatearDinero(dinero).replace('S/', '').replace(/\s/g, '')
}

/** Partes de la hora en la zona de la tienda (no la del celular). */
const HORA_DE_LA_TIENDA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Lima',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "10:30 a. m.", "3:05 p. m.": la hora como se dice en la tienda. */
export function horaDe(instante: Instante): string {
  const partes = HORA_DE_LA_TIENDA.formatToParts(new Date(instante))
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const minutos = partes.find((p) => p.type === 'minute')?.value ?? '00'
  const hora12 = hora % 12 === 0 ? 12 : hora % 12
  return `${hora12}:${minutos} ${hora < 12 ? 'a. m.' : 'p. m.'}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

function diaDelMes(dia: Dia): number {
  return Number(dia.slice(8, 10))
}

function mesCorto(dia: Dia): string {
  return MESES[Number(dia.slice(5, 7)) - 1] ?? ''
}

/** "9 al 15 oct", "25 set al 1 oct". */
function rangoDeDias(desde: Dia, hasta: Dia): string {
  const inicio =
    mesCorto(desde) === mesCorto(hasta)
      ? String(diaDelMes(desde))
      : `${diaDelMes(desde)} ${mesCorto(desde)}`
  return `${inicio} al ${diaDelMes(hasta)} ${mesCorto(hasta)}`
}

export interface BarraDeTendencia {
  etiqueta: string
  valor: number
  textoValor: string
}

/**
 * RN-AN-14: las 8 cantidades de `analisis.detalleDeProducto` (del bloque más antiguo al más
 * reciente) como barras, cada una con los 7 días completos que cuenta.
 */
export function barrasDeTendencia(
  tendencia: readonly Cantidad[],
  unidad: Unidad,
  hoy: Dia,
): BarraDeTendencia[] {
  return tendencia.map((cantidad, indice) => {
    const desde = sumarDias(hoy, -7 * (tendencia.length - indice))
    return {
      etiqueta: rangoDeDias(desde, sumarDias(desde, 6)),
      valor: cantidad.milesimas,
      textoValor: formatearCantidad(cantidad, unidad),
    }
  })
}

export interface MovimientoDeProducto {
  id: string
  /** "Venta", "Llegó mercadería", "Se dañó"… */
  titulo: string
  /** "Hoy, 10:30 a. m." */
  cuando: string
  /** Con signo: "+12 unid.", "-2 unid." */
  cantidad: string
}

/** Una operación del historial vista desde UN producto (lo que cambió su stock). */
export function movimientoDeProducto(
  operacion: OperacionVista,
  productoId: string,
  hoy: Dia,
): MovimientoDeProducto {
  const lineas = operacion.lineas.filter((l) => l.productoId === productoId)
  const cambio = Cantidad.sumarTodas(lineas.map((l) => l.cantidad))
  const unidad = lineas[0]?.unidad ?? 'UNIDAD'
  const texto = formatearCantidad(cambio, unidad)
  return {
    id: operacion.id,
    titulo: operacion.anulada ? `${operacion.etiqueta} (anulada)` : operacion.etiqueta,
    cuando: `${etiquetaDeDia(diaDe(operacion.ocurridaEn), hoy)}, ${horaDe(operacion.ocurridaEn)}`,
    cantidad: cambio.esPositiva() ? `+${texto}` : texto,
  }
}

/**
 * RN-CAT-11: cuánto retiró del stock el archivado que se acaba de confirmar ("4 unid."), leído
 * del ajuste "Producto retirado" que registró ESE archivado: el que no estaba entre las
 * operaciones `anteriores` (las de antes de archivar). null si esta vez no hubo retiro (al
 * confirmar ya no quedaba stock): un retiro de un archivado anterior no cuenta.
 */
export function retiradoAlArchivar(
  operaciones: readonly OperacionVista[],
  productoId: string,
  anteriores: ReadonlySet<string>,
): string | null {
  const retiro = operaciones.find(
    (o) =>
      o.tipo === 'AJUSTE' &&
      o.motivo === MOTIVO_PRODUCTO_RETIRADO &&
      !o.anulada &&
      !anteriores.has(o.id),
  )
  const lineas = retiro?.lineas.filter((l) => l.productoId === productoId) ?? []
  if (lineas.length === 0) return null
  const retirado = Cantidad.sumarTodas(lineas.map((l) => l.cantidad)).abs()
  return formatearCantidad(retirado, lineas[0]!.unidad)
}

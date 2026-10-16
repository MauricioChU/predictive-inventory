import type { Cantidad, Unidad } from '../../../shared/domain/cantidad'
import type { Dinero } from '../../../shared/domain/dinero'
import { diaDe, type Instante } from '../../../shared/domain/fecha'
import { formatearDia, SIMBOLO_DE_UNIDAD } from '../../../shared/domain/formato'
import type { TipoDeOperacion } from '../../../shared/contratos/operaciones'
import type { EstadoDeStock } from '../../../shared/contratos/estado-de-stock'
import type { TotalesDeDia } from '../../../shared/contratos/entre-modulos'
import { horaLocal } from './nombres-de-archivo'

/** Celda de una hoja de Excel: texto o número, con el formato de celda si aplica (RN-RE-01). */
export interface CeldaDeExcel {
  valor: string | number
  /** Solo los montos llevan formato; las cantidades van sin formato (General: "8", no "8."). */
  formato?: '0.00'
}

export interface HojaDeExcel {
  nombre: string
  columnas: string[]
  filas: CeldaDeExcel[][]
}

const TEXTO_DE_ESTADO: Record<EstadoDeStock, string> = {
  AGOTADO: 'Agotado',
  POR_ACABARSE: 'Queda poco',
  NORMAL: 'Bien',
}

function celdaDeDinero(dinero: Dinero): CeldaDeExcel {
  return { valor: dinero.centimos / 100, formato: '0.00' }
}

function celdaDeCantidad(cantidad: Cantidad): CeldaDeExcel {
  return { valor: cantidad.milesimas / 1000 }
}

/** Lo que el usuario ve en pantalla para cada tipo (spec 02): mermas y ajustes muestran su motivo. */
function etiquetaDeTipo(tipo: TipoDeOperacion, motivo: string | null): string {
  switch (tipo) {
    case 'STOCK_INICIAL':
      return 'Stock inicial'
    case 'INGRESO':
      return 'Llegó mercadería'
    case 'VENTA':
      return 'Venta'
    case 'MERMA':
      return motivo ?? 'Merma'
    case 'AJUSTE':
      return motivo ?? 'Ajuste'
    case 'ANULACION':
      return 'Anulado'
  }
}

function fechaHoraLocal(instante: Instante): string {
  const hora = horaLocal(instante)
  return `${formatearDia(diaDe(instante))} ${hora.slice(0, 2)}:${hora.slice(2)}`
}

/** Fila de "Productos" ya resuelta: cada producto, con su stock y su estado actuales. */
export interface FilaDeProductoParaExcel {
  nombre: string
  categoriaNombre: string
  unidad: Unidad
  precioCompra: Dinero
  precioVenta: Dinero
  stock: Cantidad
  stockMinimo: Cantidad
  /** `null` en productos archivados: no tienen estado de stock (RN-RE-01). */
  estado: EstadoDeStock | null
  activo: boolean
}

const COLUMNAS_PRODUCTOS = [
  'nombre',
  'categoría',
  'unidad',
  'precio de compra',
  'precio de venta',
  'stock',
  'stock mínimo',
  'estado de stock',
  'activo/archivado',
]

export function hojaDeProductos(filas: readonly FilaDeProductoParaExcel[]): HojaDeExcel {
  return {
    nombre: 'Productos',
    columnas: [...COLUMNAS_PRODUCTOS],
    filas: filas.map((f) => [
      { valor: f.nombre },
      { valor: f.categoriaNombre },
      { valor: SIMBOLO_DE_UNIDAD[f.unidad] },
      celdaDeDinero(f.precioCompra),
      celdaDeDinero(f.precioVenta),
      celdaDeCantidad(f.stock),
      celdaDeCantidad(f.stockMinimo),
      { valor: f.estado ? TEXTO_DE_ESTADO[f.estado] : '' },
      { valor: f.activo ? 'activo' : 'archivado' },
    ]),
  }
}

/** Fila de "Movimientos": una por cada línea de producto de cada operación (RN-RE-01). */
export interface FilaDeMovimientoParaExcel {
  ocurridaEn: Instante
  tipo: TipoDeOperacion
  /** Motivo de la operación: es la etiqueta de las mermas y de los ajustes. */
  motivo: string | null
  productoNombre: string
  cantidad: Cantidad
  /** Solo en VENTA; en el resto de tipos no hay precio de venta. */
  precioUnitario: Dinero | null
  costoUnitario: Dinero
  importe: Dinero
  anulada: boolean
  nota: string | null
}

const COLUMNAS_MOVIMIENTOS = [
  'fecha',
  'tipo',
  'producto',
  'cantidad',
  'precio',
  'costo',
  'importe',
  'anulada',
  'nota',
]

export function hojaDeMovimientos(filas: readonly FilaDeMovimientoParaExcel[]): HojaDeExcel {
  return {
    nombre: 'Movimientos',
    columnas: [...COLUMNAS_MOVIMIENTOS],
    filas: filas.map((f) => [
      { valor: fechaHoraLocal(f.ocurridaEn) },
      { valor: etiquetaDeTipo(f.tipo, f.motivo) },
      { valor: f.productoNombre },
      celdaDeCantidad(f.cantidad),
      f.precioUnitario ? celdaDeDinero(f.precioUnitario) : { valor: '' },
      celdaDeDinero(f.costoUnitario),
      celdaDeDinero(f.importe),
      { valor: f.anulada ? 'sí' : 'no' },
      { valor: f.nota ?? '' },
    ]),
  }
}

const COLUMNAS_RESUMEN = ['fecha', 'ventas', 'ganancia bruta', 'mermas', 'ganancia neta']

/** Hoja "Resumen diario": de los últimos 90 días (RN-RE-01). */
export function hojaDeResumen(dias: readonly TotalesDeDia[]): HojaDeExcel {
  return {
    nombre: 'Resumen diario',
    columnas: [...COLUMNAS_RESUMEN],
    filas: dias.map((d) => [
      { valor: formatearDia(d.dia) },
      celdaDeDinero(d.ventas),
      celdaDeDinero(d.gananciaBruta),
      celdaDeDinero(d.mermas),
      celdaDeDinero(d.gananciaNeta),
    ]),
  }
}

const COLUMNAS_PLANTILLA = [
  'nombre',
  'categoría',
  'unidad',
  'precio de compra',
  'precio de venta',
  'stock mínimo',
  'stock inicial',
]

/** RN-RE-07: plantilla descargable para importar productos desde Excel. */
export const PLANTILLA: readonly HojaDeExcel[] = [
  { nombre: 'Productos', columnas: [...COLUMNAS_PLANTILLA], filas: [] },
  {
    nombre: 'Instrucciones',
    columnas: ['columna', 'qué escribir'],
    filas: [
      [{ valor: 'nombre' }, { valor: 'El nombre del producto, por ejemplo Lejía 1 L' }],
      [{ valor: 'categoría' }, { valor: 'El nombre de la categoría. Si no existe, se crea' }],
      [{ valor: 'unidad' }, { valor: 'Escribe unid, kg o L' }],
      [{ valor: 'precio de compra' }, { valor: 'Lo que pagas al comprarlo, en soles' }],
      [{ valor: 'precio de venta' }, { valor: 'Lo que cobras al venderlo, en soles' }],
      [{ valor: 'stock mínimo' }, { valor: 'Desde cuánto se avisa que queda poco' }],
      [{ valor: 'stock inicial' }, { valor: 'Cuánto tienes ahora. Puedes dejarlo en blanco' }],
    ],
  },
]

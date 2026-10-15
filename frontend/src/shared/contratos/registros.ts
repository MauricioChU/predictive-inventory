import type { Unidad } from '../domain/cantidad'
import type { ConfiguracionDeNegocio, EstadoDelSistema } from './configuracion'
import type { EstadoDeStock } from './estado-de-stock'
import type { TipoDeOperacion } from './operaciones'

export interface ProductoRegistro {
  id: string
  nombre: string
  nombreNormalizado: string
  categoriaId: string
  unidad: Unidad
  precioCompra: number // céntimos
  precioVenta: number // céntimos
  stockMinimo: number // milésimas
  tieneFoto: boolean
  estado: 'ACTIVO' | 'ARCHIVADO'
  creadoEn: string
  actualizadoEn: string
}

export interface CategoriaRegistro {
  id: string
  nombre: string
  nombreNormalizado: string
}

export interface MovimientoRegistro {
  productoId: string
  cantidad: number // milésimas, con signo (+ entra, − sale)
  costoUnitario: number // céntimos
  precioUnitario: number | null // céntimos; solo en VENTA
}

export interface OperacionRegistro {
  id: string
  tipo: TipoDeOperacion
  movimientos: MovimientoRegistro[]
  productoIds: string[] // índice multiEntry
  ocurridaEn: string
  registradaEn: string
  motivo: string | null
  nota: string | null
  anulaA: string | null
  dispositivoId: string
}

export interface ExistenciaRegistro {
  productoId: string
  cantidad: number // milésimas
}

export interface ResumenDiarioRegistro {
  clave: string // `${productoId}|${dia}`
  productoId: string
  dia: string
  lineasVendidas: number
  cantidadVendida: number // milésimas
  ventas: number // céntimos
  costoVendido: number // céntimos
  costoMermas: number // céntimos
  valorAjustes: number // céntimos, con signo
  cambioNeto: number // milésimas, con signo: todas las operaciones del día, incluidas anulaciones
}

export interface ConfiguracionRegistro extends ConfiguracionDeNegocio {
  clave: 'negocio'
}

export interface EstadoDelSistemaRegistro extends EstadoDelSistema {
  clave: 'sistema'
}

export interface AvisoRegistro {
  productoId: string
  ultimoEstadoAvisado: EstadoDeStock
}

export interface CambioEnListaRegistro {
  productoId: string
  cantidad: number | null // milésimas; null = quitado de la lista
}

export interface ListaDeComprasRegistro {
  dia: string
  cambios: CambioEnListaRegistro[]
}

export interface ConteoGuiadoRegistro {
  id: 'actual'
  iniciadoEn: string
  orden: string[] // productoIds en el orden del recorrido
  posicion: number // índice del producto actual en `orden`
  contados: { productoId: string; diferencia: number; valor: number }[] // milésimas, céntimos
  saltados: string[]
  terminadoEn: string | null
}

export interface FotoRegistro {
  productoId: string
  imagen: Blob
}

/** Nombre de cada tabla y la forma de sus registros. */
export interface TablasDeLaApp {
  productos: ProductoRegistro
  categorias: CategoriaRegistro
  operaciones: OperacionRegistro
  existencias: ExistenciaRegistro
  resumenes: ResumenDiarioRegistro
  configuracion: ConfiguracionRegistro | EstadoDelSistemaRegistro
  avisos: AvisoRegistro
  listaDeCompras: ListaDeComprasRegistro
  conteo: ConteoGuiadoRegistro
  fotos: FotoRegistro
}

export type NombreDeTabla = keyof TablasDeLaApp

/** Clave primaria de cada tabla (igual en Dexie y en memoria). */
export const CLAVE_DE_TABLA: { [K in NombreDeTabla]: keyof TablasDeLaApp[K] & string } = {
  productos: 'id',
  categorias: 'id',
  operaciones: 'id',
  existencias: 'productoId',
  resumenes: 'clave',
  configuracion: 'clave',
  avisos: 'productoId',
  listaDeCompras: 'dia',
  conteo: 'id',
  fotos: 'productoId',
}

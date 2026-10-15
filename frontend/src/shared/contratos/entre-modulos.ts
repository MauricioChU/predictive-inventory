import type { Cantidad, Unidad } from '../domain/cantidad'
import type { Dinero } from '../domain/dinero'
import type { Dia, Instante } from '../domain/fecha'
import type { ConfiguracionDeNegocio, EstadoDelSistema } from './configuracion'
import type { EstadoDeStock } from './estado-de-stock'
import type { OperacionRegistro } from './registros'

// ───────────── Catálogo ofrece ─────────────

export interface ProductoResumido {
  id: string
  nombre: string
  unidad: Unidad
  categoriaId: string
  categoriaNombre: string
  precioCompra: Dinero
  precioVenta: Dinero
  stockMinimo: Cantidad
  activo: boolean
  tieneFoto: boolean
}

/** Datos de un producto nuevo tal como los escribe el usuario (formulario o Excel). */
export interface DatosDeProductoNuevo {
  nombre: string
  categoriaId: string
  unidad: Unidad
  precioCompra: string
  precioVenta: string
  stockMinimo: string
  stockInicial?: string
}

export interface CatalogoConsultable {
  producto(id: string): Promise<ProductoResumido | null>
  productos(filtro?: { soloActivos?: boolean }): Promise<ProductoResumido[]>
  /** RN-OP-14: lo usa Inventario al aceptar el nuevo costo de un ingreso. */
  actualizarPrecioCompra(id: string, precio: Dinero): Promise<void>
}

/** Lo que Respaldo necesita para importar desde Excel (RN-RE-07, RN-RE-08). */
export interface CatalogoParaImportacion {
  /** Devuelve el mensaje de error de la primera regla que falla, o null si es válido. No guarda nada. */
  validarNuevo(datos: DatosDeProductoNuevo): Promise<string | null>
  crear(datos: DatosDeProductoNuevo): Promise<string>
  categoriaPorNombre(nombre: string): Promise<string | null>
  crearCategoria(nombre: string): Promise<string>
}

// ───────────── Inventario ofrece ─────────────

export interface InventarioConsultable {
  stockDe(productoId: string): Promise<Cantidad>
  existencias(): Promise<Map<string, Cantidad>>
  tieneOperaciones(productoId: string): Promise<boolean>
  ultimoIngresoDe(productoId: string): Promise<Instante | null>
  operaciones(): Promise<OperacionRegistro[]>
}

export interface InventarioParaCatalogo extends InventarioConsultable {
  registrarStockInicial(
    productoId: string,
    cantidad: Cantidad,
    costoUnitario: Dinero,
  ): Promise<void>
  /** RN-CAT-11: AJUSTE hasta 0 con motivo "Producto retirado". */
  retirarStock(productoId: string): Promise<void>
}

/** Proyecciones que se actualizan en la MISMA unidad de trabajo que la operación (ADR-0002). */
export interface ProyeccionDeOperaciones {
  alRegistrar(operacion: OperacionRegistro): Promise<void>
  alAnular(original: OperacionRegistro, anulacion: OperacionRegistro): Promise<void>
  reconstruir(operaciones: readonly OperacionRegistro[]): Promise<void>
}

// ───────────── Análisis ofrece ─────────────

/** VPD = vendido ÷ diasValidos (RN-AN-04). Se guarda como fracción para no perder exactitud. */
export interface Prediccion {
  vendido: Cantidad
  diasValidos: number
}

export interface SituacionDeProducto {
  productoId: string
  nombre: string
  unidad: Unidad
  stock: Cantidad
  stockMinimo: Cantidad
  prediccion: Prediccion | null
  diasDeCobertura: number | null
  estado: EstadoDeStock
  enListaParaComprar: boolean
  cantidadSugerida: Cantidad | null
  parado: { diasSinVender: number } | null
}

export interface AnalisisConsultable {
  situacion(productoId: string): Promise<SituacionDeProducto | null>
  /** Solo productos activos. */
  situaciones(): Promise<SituacionDeProducto[]>
  vecesVendido(desde: Dia, hasta: Dia): Promise<Map<string, number>>
  totalesDelDia(dia: Dia): Promise<{ ventas: Dinero; gananciaNeta: Dinero }>
}

// ───────────── Tienda ofrece ─────────────

export interface TiendaConsultable {
  configuracion(): Promise<ConfiguracionDeNegocio>
  estadoDelSistema(): Promise<EstadoDelSistema>
  actualizarEstadoDelSistema(cambios: Partial<EstadoDelSistema>): Promise<void>
}

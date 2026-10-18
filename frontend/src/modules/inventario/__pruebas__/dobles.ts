import type { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { CONFIGURACION_INICIAL, type EstadoDelSistema } from '@/shared/contratos/configuracion'
import type {
  AnalisisConsultable,
  CatalogoConsultable,
  ProductoResumido,
  ProyeccionDeOperaciones,
  SituacionDeProducto,
  TiendaConsultable,
} from '@/shared/contratos/entre-modulos'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import type { RepositorioDeOperaciones } from '../application/puertos'

/** Proyección que anota lo que recibe y puede fallar a pedido (RN-OP-06). */
export class ProyeccionEspia implements ProyeccionDeOperaciones {
  readonly registradas: OperacionRegistro[] = []
  readonly anuladas: { original: OperacionRegistro; anulacion: OperacionRegistro }[] = []
  readonly reconstrucciones: OperacionRegistro[][] = []
  fallarAlRegistrar = false

  async alRegistrar(operacion: OperacionRegistro): Promise<void> {
    if (this.fallarAlRegistrar) throw new Error('La proyección falló')
    this.registradas.push(operacion)
  }

  async alAnular(original: OperacionRegistro, anulacion: OperacionRegistro): Promise<void> {
    this.anuladas.push({ original, anulacion })
  }

  async reconstruir(operaciones: readonly OperacionRegistro[]): Promise<void> {
    this.reconstrucciones.push([...operaciones])
  }

  limpiar(): void {
    this.registradas.length = 0
    this.anuladas.length = 0
    this.reconstrucciones.length = 0
  }
}

/** Catálogo simple: un mapa de ProductoResumido que anota los cambios de precio de compra. */
export class CatalogoEnMemoria implements CatalogoConsultable {
  private readonly porId = new Map<string, ProductoResumido>()
  readonly preciosDeCompraActualizados: { id: string; precio: Dinero }[] = []

  agregar(producto: ProductoResumido): void {
    this.porId.set(producto.id, { ...producto })
  }

  archivar(id: string): void {
    const producto = this.porId.get(id)
    if (producto) this.porId.set(id, { ...producto, activo: false })
  }

  /** Solo para probar datos dañados: Catálogo nunca elimina productos (RN-CAT-10). */
  olvidar(id: string): void {
    this.porId.delete(id)
  }

  async producto(id: string): Promise<ProductoResumido | null> {
    const producto = this.porId.get(id)
    return producto ? { ...producto } : null
  }

  async productos(filtro?: { soloActivos?: boolean }): Promise<ProductoResumido[]> {
    const todos = [...this.porId.values()].map((p) => ({ ...p }))
    return filtro?.soloActivos ? todos.filter((p) => p.activo) : todos
  }

  async actualizarPrecioCompra(id: string, precio: Dinero): Promise<void> {
    this.preciosDeCompraActualizados.push({ id, precio })
    const producto = this.porId.get(id)
    if (producto) this.porId.set(id, { ...producto, precioCompra: precio })
  }
}

/** Análisis falso: devuelve la situación que se le fije a cada producto (o null). */
export class AnalisisFalso implements Pick<AnalisisConsultable, 'situacion'> {
  private readonly porProducto = new Map<string, SituacionDeProducto>()

  fijar(situacion: SituacionDeProducto): void {
    this.porProducto.set(situacion.productoId, situacion)
  }

  async situacion(productoId: string): Promise<SituacionDeProducto | null> {
    return this.porProducto.get(productoId) ?? null
  }
}

/** Situación de un producto NORMAL, sin predicción ni lista; `cambios` la ajusta. */
export function situacionDe(
  producto: ProductoResumido,
  stock: Cantidad,
  cambios: Partial<SituacionDeProducto> = {},
): SituacionDeProducto {
  return {
    productoId: producto.id,
    nombre: producto.nombre,
    unidad: producto.unidad,
    stock,
    stockMinimo: producto.stockMinimo,
    prediccion: null,
    diasDeCobertura: null,
    estado: 'NORMAL',
    enListaParaComprar: false,
    cantidadSugerida: null,
    parado: null,
    ...cambios,
  }
}

/** Tienda falsa con la configuración inicial y el dispositivo "disp-1". */
export class TiendaFalsa implements TiendaConsultable {
  readonly config = { ...CONFIGURACION_INICIAL }
  readonly estado: EstadoDelSistema = {
    dispositivoId: 'disp-1',
    primeraVezCompletada: true,
    ultimoRespaldoEn: null,
    almacenamientoPersistente: 'DESCONOCIDO',
    ultimoResumenDelDiaMostrado: null,
    ultimoPagoDelLocalAvisado: null,
    recordatorioDelLocalCerradoEl: null,
  }

  async configuracion() {
    return { ...this.config }
  }

  async estadoDelSistema() {
    return { ...this.estado }
  }

  async actualizarEstadoDelSistema(cambios: Partial<EstadoDelSistema>): Promise<void> {
    Object.assign(this.estado, cambios)
  }
}

/** Repositorio que devuelve las listas AL REVÉS del orden de registro (un orden adversario). */
export function alReves(repositorio: RepositorioDeOperaciones): RepositorioDeOperaciones {
  return {
    agregar: (registro) => repositorio.agregar(registro),
    porId: (id) => repositorio.porId(id),
    anulacionDe: (operacionId) => repositorio.anulacionDe(operacionId),
    porProducto: async (productoId) => (await repositorio.porProducto(productoId)).reverse(),
    todas: async () => (await repositorio.todas()).reverse(),
    recientes: (consulta) => repositorio.recientes(consulta),
    conAnulacion: (operacionIds) => repositorio.conAnulacion(operacionIds),
  }
}

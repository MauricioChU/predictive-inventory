import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { ErrorDeDominio } from '@/shared/domain/errores'
import type { Instante } from '@/shared/domain/fecha'
import { normalizar } from '@/shared/domain/texto'
import type { ProductoRegistro } from '@/shared/contratos/registros'
import { MENSAJE_UNIDAD_CON_MOVIMIENTOS } from './mensajes'

type EstadoDeProducto = 'ACTIVO' | 'ARCHIVADO'

interface DatosDeProducto {
  id: string
  nombre: string
  categoriaId: string
  unidad: Unidad
  precioCompra: Dinero
  precioVenta: Dinero
  stockMinimo: Cantidad
  tieneFoto: boolean
  estado: EstadoDeProducto
  creadoEn: Instante
  actualizadoEn: Instante
}

/** Agregado Producto (01-catalogo.md). El stock no es un campo del producto: lo calcula Inventario. */
export class Producto {
  private constructor(private datos: DatosDeProducto) {}

  static crear(p: {
    id: string
    nombre: string
    categoriaId: string
    unidad: Unidad
    precioCompra: Dinero
    precioVenta: Dinero
    stockMinimo: Cantidad
    ahora: Instante
  }): Producto {
    return new Producto({
      id: p.id,
      nombre: p.nombre,
      categoriaId: p.categoriaId,
      unidad: p.unidad,
      precioCompra: p.precioCompra,
      precioVenta: p.precioVenta,
      stockMinimo: p.stockMinimo,
      tieneFoto: false,
      estado: 'ACTIVO',
      creadoEn: p.ahora,
      actualizadoEn: p.ahora,
    })
  }

  static desdeRegistro(r: ProductoRegistro): Producto {
    return new Producto({
      id: r.id,
      nombre: r.nombre,
      categoriaId: r.categoriaId,
      unidad: r.unidad,
      precioCompra: Dinero.deCentimos(r.precioCompra),
      precioVenta: Dinero.deCentimos(r.precioVenta),
      stockMinimo: Cantidad.deMilesimas(r.stockMinimo),
      tieneFoto: r.tieneFoto,
      estado: r.estado,
      creadoEn: r.creadoEn,
      actualizadoEn: r.actualizadoEn,
    })
  }

  aRegistro(): ProductoRegistro {
    return {
      id: this.datos.id,
      nombre: this.datos.nombre,
      nombreNormalizado: this.nombreNormalizado,
      categoriaId: this.datos.categoriaId,
      unidad: this.datos.unidad,
      precioCompra: this.datos.precioCompra.centimos,
      precioVenta: this.datos.precioVenta.centimos,
      stockMinimo: this.datos.stockMinimo.milesimas,
      tieneFoto: this.datos.tieneFoto,
      estado: this.datos.estado,
      creadoEn: this.datos.creadoEn,
      actualizadoEn: this.datos.actualizadoEn,
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
  get unidad(): Unidad {
    return this.datos.unidad
  }
  get categoriaId(): string {
    return this.datos.categoriaId
  }
  get precioCompra(): Dinero {
    return this.datos.precioCompra
  }
  get precioVenta(): Dinero {
    return this.datos.precioVenta
  }
  get stockMinimo(): Cantidad {
    return this.datos.stockMinimo
  }
  get activo(): boolean {
    return this.datos.estado === 'ACTIVO'
  }
  get tieneFoto(): boolean {
    return this.datos.tieneFoto
  }

  renombrar(nombre: string, ahora: Instante): void {
    this.datos.nombre = nombre
    this.tocar(ahora)
  }

  cambiarCategoria(categoriaId: string, ahora: Instante): void {
    this.datos.categoriaId = categoriaId
    this.tocar(ahora)
  }

  /** RN-CAT-09: solo cambia el estado actual; las operaciones pasadas conservan su costo. */
  cambiarPrecios(compra: Dinero, venta: Dinero, ahora: Instante): void {
    this.datos.precioCompra = compra
    this.datos.precioVenta = venta
    this.tocar(ahora)
  }

  cambiarStockMinimo(minimo: Cantidad, ahora: Instante): void {
    this.datos.stockMinimo = minimo
    this.tocar(ahora)
  }

  /** RN-CAT-03: no se puede cambiar si el producto ya tiene operaciones. */
  cambiarUnidad(unidad: Unidad, tieneOperaciones: boolean, ahora: Instante): void {
    if (tieneOperaciones) {
      throw new ErrorDeDominio('UNIDAD_CON_MOVIMIENTOS', MENSAJE_UNIDAD_CON_MOVIMIENTOS)
    }
    this.datos.unidad = unidad
    this.tocar(ahora)
  }

  archivar(ahora: Instante): void {
    this.datos.estado = 'ARCHIVADO'
    this.tocar(ahora)
  }

  reactivar(ahora: Instante): void {
    this.datos.estado = 'ACTIVO'
    this.tocar(ahora)
  }

  marcarFoto(tiene: boolean, ahora: Instante): void {
    this.datos.tieneFoto = tiene
    this.tocar(ahora)
  }

  /** RN-CAT-05: null si gana; S/ 0.00 o más si pierde (venta ≤ compra). */
  perdidaPorUnidad(): Dinero | null {
    if (this.datos.precioVenta.mayorQue(this.datos.precioCompra)) return null
    return this.datos.precioCompra.restar(this.datos.precioVenta)
  }

  private tocar(ahora: Instante): void {
    this.datos.actualizadoEn = ahora
  }
}

import type { Cantidad, Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { ErrorDeDominio } from '@/shared/domain/errores'
import type { Instante } from '@/shared/domain/fecha'
import { formatearNumero } from '@/shared/domain/formato'
import { validarCantidad, validarPrecioDeVenta } from './reglas'

/** Una línea tal como la pide la pantalla: la cantidad es el texto que escribió el usuario. */
export interface LineaPedida {
  productoId: string
  cantidad: string
}

export interface DatosDeVenta {
  /** `precioEspecial` solo si se cambió el precio para esta venta (RN-OP-11). */
  lineas: (LineaPedida & { precioEspecial?: string })[]
  ocurridaEn?: Instante
  nota?: string
}

export interface ProductoEnCarrito {
  id: string
  nombre: string
  unidad: Unidad
  precioVenta: Dinero
}

export interface LineaDelCarrito {
  producto: ProductoEnCarrito
  cantidad: Cantidad
  /** El precio aplicado: el especial si se cambió, si no el precio de venta. */
  precio: Dinero
  /** precio × cantidad, redondeado al céntimo (RN-OP-12). */
  importe: Dinero
}

interface Item {
  producto: ProductoEnCarrito
  cantidad: Cantidad
  precioEspecial: Dinero | null
}

function validarPara(unidad: Unidad, cantidad: Cantidad): Cantidad {
  if (!cantidad.esValidaPara(unidad)) {
    throw new ErrorDeDominio('CANTIDAD_ENTERA', 'Este producto se cuenta por unidades enteras')
  }
  return validarCantidad(cantidad)
}

/** "1250.05": lo que `Dinero.deTexto` vuelve a leer, sin "S/" ni separador de miles. */
function textoDeMonto(monto: Dinero): string {
  const centimos = monto.centimos
  return `${Math.floor(centimos / 100)}.${String(centimos % 100).padStart(2, '0')}`
}

/** Carrito de Vender (HU-OP-01). Puro: la pantalla lo usa y lo convierte en DatosDeVenta. */
export class Carrito {
  private items: Item[] = []

  /** RN-OP-07: si el producto ya está, suma la cantidad a su línea. */
  agregar(producto: ProductoEnCarrito, cantidad: Cantidad): void {
    validarPara(producto.unidad, cantidad)
    const existente = this.buscar(producto.id)
    if (existente) {
      existente.cantidad = validarPara(producto.unidad, existente.cantidad.sumar(cantidad))
      return
    }
    this.items.push({ producto, cantidad, precioEspecial: null })
  }

  cambiarCantidad(productoId: string, cantidad: Cantidad): void {
    const item = this.buscar(productoId)
    if (item) item.cantidad = validarPara(item.producto.unidad, cantidad)
  }

  /** RN-OP-11: precio solo para esta venta; null (o el mismo precio de venta) = precio normal. */
  cambiarPrecio(productoId: string, precio: Dinero | null): void {
    const item = this.buscar(productoId)
    if (!item) return
    if (precio === null || precio.igualA(item.producto.precioVenta)) {
      item.precioEspecial = null
      return
    }
    item.precioEspecial = validarPrecioDeVenta(precio)
  }

  quitar(productoId: string): void {
    this.items = this.items.filter((item) => item.producto.id !== productoId)
  }

  vaciar(): void {
    this.items = []
  }

  get lineas(): readonly LineaDelCarrito[] {
    return Object.freeze(
      this.items.map((item) => {
        const precio = item.precioEspecial ?? item.producto.precioVenta
        return {
          producto: item.producto,
          cantidad: item.cantidad,
          precio,
          importe: precio.multiplicarPor(item.cantidad),
        }
      }),
    )
  }

  /** RN-OP-12: suma de importes de línea. */
  total(): Dinero {
    return Dinero.sumarTodos(this.lineas.map((linea) => linea.importe))
  }

  aDatosDeVenta(): DatosDeVenta {
    return {
      lineas: this.items.map((item) => ({
        productoId: item.producto.id,
        cantidad: formatearNumero(item.cantidad),
        ...(item.precioEspecial ? { precioEspecial: textoDeMonto(item.precioEspecial) } : {}),
      })),
    }
  }

  private buscar(productoId: string): Item | undefined {
    return this.items.find((item) => item.producto.id === productoId)
  }
}

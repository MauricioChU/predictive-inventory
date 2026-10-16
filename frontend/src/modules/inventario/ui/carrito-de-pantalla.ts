import { computed, ref } from 'vue'
import type { ProductoVista } from '@/modules/catalogo'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearDinero, formatearNumero } from '@/shared/domain/formato'
import type { DatosDeVenta } from '../domain/carrito'
import { mensajeStockInsuficiente } from '../domain/mensajes'
import { leerCantidad, leerCosto, leerPrecioDeVenta } from '../domain/reglas'
import type { DatosDeIngreso } from '../application/ingresos'
import { AYUDA_STOCK_INSUFICIENTE } from './mensajes-de-error'

/** Vender usa el precio de venta; Llegó mercadería, el costo (precio de compra). */
export type Concepto = 'venta' | 'ingreso'

/** Una línea tal como está en pantalla: la cantidad es lo que la persona escribió. */
export interface LineaDePantalla {
  producto: ProductoVista
  cantidad: string
  /** El precio aplicado (venta) o el costo (ingreso). */
  precio: Dinero
  /** Error del último precio escrito en la edición en línea (FilaDeCarrito.errorPrecio). */
  errorPrecio?: string
}

export interface LineaCalculada extends LineaDePantalla {
  /** null si lo escrito no es una cantidad válida. */
  cantidadLeida: Cantidad | null
  /** Qué pasó con la cantidad y qué hacer (RN-UX-07), o undefined si está bien. */
  errorCantidad?: string
  importe: Dinero | null
  /** El precio no es el de siempre (precio especial o costo nuevo). */
  precioCambiado: boolean
}

const UNA = Cantidad.deEntero(1)

function mensajeDe(error: unknown): string {
  if (esErrorDeDominio(error)) return error.message
  throw error
}

/** "2.40" a partir de un monto: lo que arranca la edición en línea del precio. */
export function textoDePrecio(precio: Dinero): string {
  return formatearDinero(precio).replace('S/ ', '')
}

/**
 * El carrito de Vender y de Llegó mercadería. Guarda lo escrito tal cual (para no pelear con
 * quien está escribiendo) y lo lee con las reglas del dominio en cada cambio: cantidades con la
 * precisión de su unidad (RN-OP-03/04), importes al céntimo (RN-OP-12), precio especial
 * (RN-OP-11) o costo (RN-OP-14), y, al vender, el stock que hay (RN-OP-05). Lo registra el caso
 * de uso, que vuelve a validar todo.
 */
export function usarCarrito(concepto: Concepto) {
  const lineas = ref<LineaDePantalla[]>([])
  /** Una línea con la cantidad vacía no se marca mientras se escribe; sí al intentar seguir. */
  const marcarVacias = ref(false)

  const precioBase = (producto: ProductoVista): Dinero =>
    concepto === 'venta' ? producto.precioVenta : producto.precioCompra

  function calcular(linea: LineaDePantalla): LineaCalculada {
    const precioCambiado = !linea.precio.igualA(precioBase(linea.producto))
    const base = { ...linea, precioCambiado }
    if (linea.cantidad.trim() === '') {
      return {
        ...base,
        cantidadLeida: null,
        importe: null,
        errorCantidad: marcarVacias.value ? 'Escribe la cantidad' : undefined,
      }
    }
    let cantidad: Cantidad
    try {
      cantidad = leerCantidad(linea.cantidad, linea.producto.unidad)
    } catch (error) {
      return { ...base, cantidadLeida: null, importe: null, errorCantidad: mensajeDe(error) }
    }
    const { producto } = linea
    const errorCantidad =
      concepto === 'venta' && cantidad.mayorQue(producto.stock)
        ? `${mensajeStockInsuficiente(producto.nombre, producto.unidad, producto.stock)}. ${AYUDA_STOCK_INSUFICIENTE.venta}`
        : undefined
    return {
      ...base,
      cantidadLeida: cantidad,
      importe: linea.precio.multiplicarPor(cantidad),
      errorCantidad,
    }
  }

  const calculadas = computed(() => lineas.value.map(calcular))
  /** RN-OP-12: suma de los importes de línea (las que todavía no se pueden leer no suman). */
  const total = computed(() =>
    Dinero.sumarTodos(
      calculadas.value.flatMap((linea) => (linea.importe === null ? [] : [linea.importe])),
    ),
  )
  const hayErrores = computed(() =>
    calculadas.value.some((linea) => linea.cantidadLeida === null || linea.errorCantidad),
  )

  const buscar = (productoId: string) => lineas.value.find((l) => l.producto.id === productoId)

  return {
    lineas: calculadas,
    total,
    hayErrores,
    vacio: computed(() => lineas.value.length === 0),

    /** RN-OP-07: si el producto ya está, suma 1 a su línea; si no, lo agrega con cantidad 1. */
    agregar(producto: ProductoVista): void {
      const existente = buscar(producto.id)
      if (!existente) {
        lineas.value.push({ producto, cantidad: '1', precio: precioBase(producto) })
        return
      }
      existente.producto = producto
      const actual = calcular(existente).cantidadLeida
      existente.cantidad = actual ? formatearNumero(actual.sumar(UNA)) : '1'
    },

    cambiarCantidad(productoId: string, texto: string): void {
      const linea = buscar(productoId)
      if (linea) linea.cantidad = texto
    },

    /**
     * Sincrónico a propósito (contrato de FilaDeCarrito.errorPrecio): lee el precio con el
     * dominio y deja el error junto al campo, o aplica el precio nuevo.
     */
    cambiarPrecio(productoId: string, texto: string): void {
      const linea = buscar(productoId)
      if (!linea) return
      try {
        linea.precio = concepto === 'venta' ? leerPrecioDeVenta(texto) : leerCosto(texto)
        linea.errorPrecio = undefined
      } catch (error) {
        linea.errorPrecio = mensajeDe(error)
      }
    },

    cancelarPrecio(productoId: string): void {
      const linea = buscar(productoId)
      if (linea) linea.errorPrecio = undefined
    },

    quitar(productoId: string): void {
      lineas.value = lineas.value.filter((l) => l.producto.id !== productoId)
    },

    /** Con el stock al día (p. ej. si al confirmar ya no alcanzaba): las líneas se re-marcan. */
    actualizarProductos(productos: readonly ProductoVista[]): void {
      for (const producto of productos) {
        const linea = buscar(producto.id)
        if (linea) linea.producto = producto
      }
    },

    marcarVacias(): void {
      marcarVacias.value = true
    },

    vaciar(): void {
      lineas.value = []
      marcarVacias.value = false
    },

    /** Lo que había antes (Deshacer deja el carrito como estaba para corregirlo). */
    copia(): LineaDePantalla[] {
      return lineas.value.map((l) => ({ ...l, errorPrecio: undefined }))
    },

    restaurar(copia: readonly LineaDePantalla[]): void {
      lineas.value = copia.map((l) => ({ ...l }))
    },

    /** RN-OP-11: el precio va solo si se cambió para esta venta. */
    aDatosDeVenta(): DatosDeVenta {
      return {
        lineas: calculadas.value.map((l) => ({
          productoId: l.producto.id,
          cantidad: l.cantidad,
          ...(l.precioCambiado ? { precioEspecial: formatearDinero(l.precio) } : {}),
        })),
      }
    },

    /** RN-OP-14: cada línea lleva su costo (el de siempre o el que se escribió). */
    aDatosDeIngreso(): DatosDeIngreso {
      return {
        lineas: calculadas.value.map((l) => ({
          productoId: l.producto.id,
          cantidad: l.cantidad,
          costo: formatearDinero(l.precio),
        })),
      }
    },

    /** Para prellenar (Llegó mercadería desde Para comprar). */
    cargar(productos: readonly { producto: ProductoVista; cantidad: Cantidad; precio: Dinero }[]) {
      lineas.value = productos.map(({ producto, cantidad, precio }) => ({
        producto,
        cantidad: formatearNumero(cantidad),
        precio,
      }))
    },
  }
}

export type CarritoDePantalla = ReturnType<typeof usarCarrito>

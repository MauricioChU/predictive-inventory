import { computed, ref } from 'vue'
import type { ProductoVista } from '@/modules/catalogo'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearDinero, formatearNumero } from '@/shared/domain/formato'
import type { DatosDeVenta } from '../domain/carrito'
import { mensajeDeLoQueQueda, mensajeStockInsuficiente } from '../domain/mensajes'
import { leerCantidad, leerCosto, leerPrecioDeVenta } from '../domain/reglas'
import type { DatosDeIngreso } from '../application/ingresos'
import { cuandoInicial, type Cuando } from './cuando'
import { hoyEnLaTienda } from '@/shared/domain/fecha'
import { AYUDA_STOCK_INSUFICIENTE } from './mensajes-de-error'

/** Vender usa el precio de venta; Llegó mercadería, el costo (precio de compra). */
export type Concepto = 'venta' | 'ingreso'

/** Una línea tal como está en pantalla: la cantidad es lo que la persona escribió. */
export interface LineaDePantalla {
  /** Propio de la línea: el mismo producto puede ir en dos líneas con distinto precio (RN-OP-11). */
  id: string
  producto: ProductoVista
  cantidad: string
  /** El precio aplicado (venta) o el costo (ingreso). */
  precio: Dinero
  /** Error del último precio escrito en la edición en línea (FilaDeCarrito.errorPrecio). */
  errorPrecio?: string
  /** Error de "¿Cuántos?" al vender alguno a otro precio. */
  errorUnidades?: string
}

/** Lo que había en el carrito al registrar: Deshacer lo devuelve tal cual (fecha incluida). */
export interface CopiaDelCarrito {
  lineas: LineaDePantalla[]
  cuando: Cuando
}

export interface LineaCalculada extends LineaDePantalla {
  /** null si lo escrito no es una cantidad válida. */
  cantidadLeida: Cantidad | null
  /** Qué pasó con la cantidad y qué hacer (RN-UX-07), o undefined si está bien. */
  errorCantidad?: string
  /** RN-OP-22 (solo al vender): "Quedan 7 unid." / "Se acaba" tras la venta. */
  quedan?: string
  /** RN-OP-05 (solo al vender): lo más que puede llevar esta línea (el stock menos lo que
   * llevan las otras líneas del mismo producto). */
  maximo?: Cantidad
  importe: Dinero | null
  /** El precio no es el de siempre (precio especial o costo nuevo). */
  precioCambiado: boolean
}

const UNA = Cantidad.deEntero(1)

let ultimoId = 0
const nuevoId = (): string => `linea-${(ultimoId += 1)}`

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
  /** RN-OP-09 / HU-OP-07: ahora u otro día (hasta 7 días atrás). Va con el carrito (r1 M3). */
  const cuando = ref<Cuando>(cuandoInicial(hoyEnLaTienda(new Date())))
  /** Líneas con un formulario de precio abierto: mientras haya, no se confirma (lo escrito sin
   * guardar sería un error de registro involuntario). */
  const ediciones = ref(new Set<string>())

  const precioBase = (producto: ProductoVista): Dinero =>
    concepto === 'venta' ? producto.precioVenta : producto.precioCompra

  function leerSinError(linea: LineaDePantalla): Cantidad | null {
    try {
      return leerCantidad(linea.cantidad, linea.producto.unidad)
    } catch {
      return null
    }
  }

  /** Lo que lleva cada producto entre todas sus líneas (RN-OP-05 vale por producto). */
  function totalesPorProducto(): Map<string, Cantidad> {
    const totales = new Map<string, Cantidad>()
    for (const linea of lineas.value) {
      const cantidad = leerSinError(linea)
      if (!cantidad) continue
      const previo = totales.get(linea.producto.id) ?? Cantidad.cero()
      totales.set(linea.producto.id, previo.sumar(cantidad))
    }
    return totales
  }

  function calcular(
    linea: LineaDePantalla,
    totales: ReadonlyMap<string, Cantidad> = totalesPorProducto(),
  ): LineaCalculada {
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
    const delProducto = totales.get(producto.id) ?? cantidad
    const errorCantidad =
      concepto === 'venta' && delProducto.mayorQue(producto.stock)
        ? `${mensajeStockInsuficiente(producto.nombre, producto.unidad, producto.stock)}. ${AYUDA_STOCK_INSUFICIENTE.venta}`
        : undefined
    return {
      ...base,
      cantidadLeida: cantidad,
      maximo:
        concepto === 'venta' ? producto.stock.restar(delProducto.restar(cantidad)) : undefined,
      importe: linea.precio.multiplicarPor(cantidad),
      errorCantidad,
      quedan:
        concepto === 'venta'
          ? mensajeDeLoQueQueda(producto.stock, delProducto, producto.unidad)
          : undefined,
    }
  }

  const calculadas = computed(() => {
    const totales = totalesPorProducto()
    return lineas.value.map((linea) => calcular(linea, totales))
  })
  /** RN-OP-12: suma de los importes de línea (las que todavía no se pueden leer no suman). */
  const total = computed(() =>
    Dinero.sumarTodos(
      calculadas.value.flatMap((linea) => (linea.importe === null ? [] : [linea.importe])),
    ),
  )
  const hayErrores = computed(() =>
    calculadas.value.some((linea) => linea.cantidadLeida === null || linea.errorCantidad),
  )

  const buscar = (id: string) => lineas.value.find((l) => l.id === id)
  const delProducto = (productoId: string) => lineas.value.find((l) => l.producto.id === productoId)
  const conPrecioDeSiempre = (productoId: string) =>
    lineas.value.find(
      (l) => l.producto.id === productoId && l.precio.igualA(precioBase(l.producto)),
    )

  /**
   * RN-OP-07: dos líneas del mismo producto con el mismo precio se juntan en la primera (pasa
   * al volver una parte al precio de siempre o al darle a otra parte el mismo precio especial).
   */
  function juntarIguales(): void {
    const juntas: LineaDePantalla[] = []
    for (const linea of lineas.value) {
      const igual = juntas.find(
        (l) => l.producto.id === linea.producto.id && l.precio.igualA(linea.precio),
      )
      const a = igual ? leerSinError(igual) : null
      const b = igual ? leerSinError(linea) : null
      if (igual && a && b) igual.cantidad = formatearNumero(a.sumar(b))
      else juntas.push(linea)
    }
    lineas.value = juntas
  }

  return {
    lineas: calculadas,
    cuando,
    total,
    hayErrores,
    vacio: computed(() => lineas.value.length === 0),
    hayEdicionAbierta: computed(() => lineas.value.some((linea) => ediciones.value.has(linea.id))),

    /** La fila avisa si abrió o cerró un formulario de precio (cambiar u otro precio). */
    marcarEdicion(id: string, abierta: boolean): void {
      const nuevas = new Set(ediciones.value)
      if (abierta) nuevas.add(id)
      else nuevas.delete(id)
      ediciones.value = nuevas
    },

    /**
     * RN-OP-07: si el producto ya está con su precio de siempre, suma 1 a esa línea; si no, lo
     * agrega con cantidad 1. Devuelve el id de la línea.
     */
    agregar(producto: ProductoVista): string {
      // En Llegó mercadería una línea por producto (los costos distintos no se separan).
      const existente =
        concepto === 'venta' ? conPrecioDeSiempre(producto.id) : delProducto(producto.id)
      if (!existente) {
        const id = nuevoId()
        lineas.value.push({ id, producto, cantidad: '1', precio: precioBase(producto) })
        return id
      }
      existente.producto = producto
      const actual = calcular(existente).cantidadLeida
      existente.cantidad = actual ? formatearNumero(actual.sumar(UNA)) : '1'
      return existente.id
    },

    /** RN-OP-05: al vender, lo escrito de más se corrige solo a lo que hay. */
    cambiarCantidad(id: string, texto: string): void {
      const linea = buscar(id)
      if (!linea) return
      linea.cantidad = texto
      if (concepto !== 'venta') return
      const escrita = leerSinError(linea)
      if (!escrita) return
      const otras = (totalesPorProducto().get(linea.producto.id) ?? escrita).restar(escrita)
      const maximo = linea.producto.stock.restar(otras)
      if (escrita.mayorQue(maximo) && maximo.esPositiva()) linea.cantidad = formatearNumero(maximo)
    },

    /** RN-OP-05: al vender, ¿queda stock para sumar uno más de este producto? */
    puedeAgregar(producto: ProductoVista): boolean {
      if (concepto !== 'venta') return true
      const lleva = totalesPorProducto().get(producto.id) ?? Cantidad.cero()
      return producto.stock.mayorOIgualQue(lleva.sumar(UNA))
    },

    /**
     * Sincrónico a propósito (contrato de FilaDeCarrito.errorPrecio): lee el precio con el
     * dominio y deja el error junto al campo, o aplica el precio nuevo. RN-OP-11: al vender,
     * `unidades` (menos que las de la línea) separa esas unidades en otra línea con este precio.
     */
    cambiarPrecio(id: string, texto: string, unidades?: string): void {
      const linea = buscar(id)
      if (!linea) return
      let precio: Dinero
      try {
        precio = concepto === 'venta' ? leerPrecioDeVenta(texto) : leerCosto(texto)
        linea.errorPrecio = undefined
      } catch (error) {
        linea.errorPrecio = mensajeDe(error)
        return
      }
      const todas = leerSinError(linea)
      let parte: Cantidad | null = null
      if (concepto === 'venta' && unidades !== undefined && !todas) {
        linea.errorUnidades = 'Escribe primero la cantidad'
        return
      }
      if (concepto === 'venta' && unidades !== undefined && todas) {
        try {
          parte = leerCantidad(unidades, linea.producto.unidad)
        } catch {
          parte = null
        }
        if (!parte || !parte.esPositiva() || parte.mayorQue(todas)) {
          linea.errorUnidades = `Son ${formatearNumero(todas)} en total: escribe de 1 a ${formatearNumero(todas)}`
          return
        }
      }
      linea.errorUnidades = undefined
      if (!parte || !todas || parte.igualA(todas)) {
        linea.precio = precio
      } else {
        linea.cantidad = formatearNumero(todas.restar(parte))
        const posicion = lineas.value.indexOf(linea) + 1
        lineas.value.splice(posicion, 0, {
          id: nuevoId(),
          producto: linea.producto,
          cantidad: formatearNumero(parte),
          precio,
        })
      }
      juntarIguales()
    },

    /**
     * Solo al vender: el lápiz del precio cambia el del PRODUCTO (catálogo), no solo el de esta
     * venta. Sincrónico por el mismo contrato de `errorPrecio`: lee el precio con el dominio y, si
     * está mal, deja el error junto al campo y devuelve null.
     */
    leerPrecioDelProducto(id: string, texto: string): Dinero | null {
      const linea = buscar(id)
      if (!linea) return null
      try {
        const precio = leerPrecioDeVenta(texto)
        linea.errorPrecio = undefined
        return precio
      } catch (error) {
        linea.errorPrecio = mensajeDe(error)
        return null
      }
    },

    /**
     * Después de cambiar el precio del producto en el catálogo: la línea tocada toma el precio
     * nuevo (sin marca de «Precio especial») y también las del mismo producto que llevaban el
     * precio de siempre; un precio especial de otra línea se queda. Las líneas iguales se juntan.
     */
    aplicarPrecioDelProducto(id: string, actual: ProductoVista): void {
      const tocada = buscar(id)
      if (!tocada) return
      const anterior = tocada.producto.precioVenta
      for (const linea of lineas.value) {
        if (linea.producto.id !== actual.id) continue
        if (linea.id === id || linea.precio.igualA(anterior)) linea.precio = actual.precioVenta
        linea.producto = actual
      }
      juntarIguales()
    },

    cancelarPrecio(id: string): void {
      const linea = buscar(id)
      if (!linea) return
      linea.errorPrecio = undefined
      linea.errorUnidades = undefined
    },

    quitar(id: string): void {
      lineas.value = lineas.value.filter((l) => l.id !== id)
    },

    /**
     * r2 #1: pone al día las líneas con los productos como están ahora (al volver a la pantalla
     * con un carrito guardado, o si al confirmar ya no alcanzaba): el stock se re-marca; una
     * línea con el precio de siempre toma el precio actual; un precio especial (o un costo
     * nuevo) se queda; lo que ya no existe o está archivado sale. Devuelve los nombres quitados.
     */
    refrescar(actuales: ReadonlyMap<string, ProductoVista | null>): string[] {
      const quitados: string[] = []
      lineas.value = lineas.value.flatMap((linea) => {
        if (!actuales.has(linea.producto.id)) return [linea]
        const actual = actuales.get(linea.producto.id)
        if (!actual?.activo) {
          quitados.push(linea.producto.nombre)
          return []
        }
        const especial = !linea.precio.igualA(precioBase(linea.producto))
        return [
          { ...linea, producto: actual, precio: especial ? linea.precio : precioBase(actual) },
        ]
      })
      return quitados
    },

    marcarVacias(): void {
      marcarVacias.value = true
    },

    /** Después de registrar: vacío y "ahora" otra vez. */
    vaciar(): void {
      lineas.value = []
      ediciones.value = new Set()
      marcarVacias.value = false
      cuando.value = cuandoInicial(hoyEnLaTienda(new Date()))
    },

    /** Lo que había antes (Deshacer deja el carrito como estaba para corregirlo). */
    copia(): CopiaDelCarrito {
      return {
        lineas: lineas.value.map((l) => ({
          ...l,
          errorPrecio: undefined,
          errorUnidades: undefined,
        })),
        cuando: { ...cuando.value },
      }
    },

    restaurar(copia: CopiaDelCarrito): void {
      lineas.value = copia.lineas.map((l) => ({ ...l }))
      cuando.value = { ...copia.cuando }
    },

    /**
     * RN-OP-11: el precio va si se cambió para esta venta. r2 #1: también si difiere del precio
     * ACTUAL del producto (`preciosActuales`, leídos al confirmar), así lo registrado es siempre
     * lo que se vio en pantalla aunque el precio haya cambiado mientras tanto.
     */
    aDatosDeVenta(preciosActuales: ReadonlyMap<string, Dinero> = new Map()): DatosDeVenta {
      return {
        lineas: calculadas.value.map((l) => {
          const actual = preciosActuales.get(l.producto.id)
          const mandarPrecio =
            l.precioCambiado || (actual !== undefined && !l.precio.igualA(actual))
          return {
            productoId: l.producto.id,
            cantidad: l.cantidad,
            ...(mandarPrecio ? { precioEspecial: formatearDinero(l.precio) } : {}),
          }
        }),
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

    /**
     * Para prellenar (Llegó mercadería desde Para comprar): agrega los productos que todavía no
     * están, sin tocar lo que ya se había cargado (r1 M9). Devuelve cuántos agregó.
     */
    agregarFaltantes(
      productos: readonly { producto: ProductoVista; cantidad: Cantidad; precio: Dinero }[],
    ): number {
      // r2 #4: tampoco se repite un producto que venga dos veces en la lista (vale el primero).
      let agregados = 0
      for (const { producto, cantidad, precio } of productos) {
        if (delProducto(producto.id)) continue
        lineas.value.push({ id: nuevoId(), producto, cantidad: formatearNumero(cantidad), precio })
        agregados += 1
      }
      return agregados
    },
  }
}

export type CarritoDePantalla = ReturnType<typeof usarCarrito>

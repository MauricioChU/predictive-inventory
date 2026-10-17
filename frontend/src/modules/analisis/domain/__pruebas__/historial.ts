import type { Prediccion } from '@/shared/contratos/entre-modulos'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { sumarDias, type Dia } from '@/shared/domain/fecha'
import { ResumenDiario } from '../resumen-diario'

/** Lo que produce el constructor: filas consistentes con el stock que quedó. */
export interface HistorialDePrueba {
  productoId: string
  filas: ResumenDiario[]
  stock: Cantidad
  primerDia: Dia | null
}

export interface OpcionesDeHistorial {
  precioVenta?: string
  precioCompra?: string
}

/** Lo que se repone al empezar un día no agotado con el stock en 0. */
const REPOSICION = 1_000_000

function diasDe(desde: Dia, hasta: Dia): Dia[] {
  const dias: Dia[] = []
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d)
  return dias
}

function milesimas(cantidad: string | number): number {
  return Cantidad.deTexto(String(cantidad), 'KILO').milesimas
}

/**
 * Constructor de historiales de prueba: simula día por día el stock de un producto y
 * produce las filas de `ResumenDiario` que dejarían sus operaciones. Por ejemplo:
 * `historial().primerMovimiento('2026-08-01').vendio(40, '2026-09-17', '2026-10-14')
 *   .agotadoDias(8, '2026-09-17', '2026-10-14').construir()`.
 */
export class ConstructorDeHistorial {
  private primero: { dia: Dia; stock: number } | null = null
  private readonly ventas: { milesimas: number; desde: Dia; hasta: Dia }[] = []
  private readonly agotados: { n: number; desde: Dia; hasta: Dia }[] = []
  private readonly precioVenta: Dinero
  private readonly precioCompra: Dinero

  constructor(
    private readonly productoId: string,
    opciones: OpcionesDeHistorial,
  ) {
    this.precioVenta = Dinero.deTexto(opciones.precioVenta ?? '3.50')
    this.precioCompra = Dinero.deTexto(opciones.precioCompra ?? '2.40')
  }

  /** Stock inicial el día del primer movimiento (por defecto, 1000). */
  primerMovimiento(dia: Dia, stockInicial: string | number = 1000): this {
    this.primero = { dia, stock: milesimas(stockInicial) }
    return this
  }

  /** Reparte `cantidad` en partes iguales entre los días del rango que no están agotados. */
  vendio(cantidad: string | number, desde: Dia, hasta: Dia = desde): this {
    this.ventas.push({ milesimas: milesimas(cantidad), desde, hasta })
    return this
  }

  /** Los primeros `n` días del rango quedan agotados todo el día (stock 0, sin ventas). */
  agotadoDias(n: number, desde: Dia, hasta: Dia): this {
    this.agotados.push({ n, desde, hasta })
    return this
  }

  /** Vende cada valor en un bloque de 7 días completos, del más antiguo al más reciente (RN-AN-14). */
  vendioPorBloques(hoy: Dia, valores: readonly number[]): this {
    valores.forEach((valor, k) => {
      const inicio = sumarDias(hoy, -7 * (valores.length - k))
      this.vendio(valor, inicio, sumarDias(inicio, 6))
    })
    return this
  }

  construir(): HistorialDePrueba {
    const primero = this.primero
    if (primero === null) {
      if (this.ventas.length > 0) throw new Error('Un historial con ventas necesita un primer día')
      return { productoId: this.productoId, filas: [], stock: Cantidad.cero(), primerDia: null }
    }
    const agotados = new Set(this.agotados.flatMap((a) => diasDe(a.desde, a.hasta).slice(0, a.n)))
    const vendidoPorDia = this.repartirVentas(agotados)
    const ultimo = [...vendidoPorDia.keys(), ...agotados].reduce(
      (max, d) => (d > max ? d : max),
      primero.dia,
    )

    const filas: ResumenDiario[] = []
    let stock = 0
    for (const dia of diasDe(primero.dia, ultimo)) {
      let cambio = dia === primero.dia ? primero.stock : 0
      stock += cambio
      if (agotados.has(dia)) {
        if (stock !== 0) throw new Error(`El ${dia} debía empezar agotado`)
        continue
      }
      if (stock === 0) {
        stock += REPOSICION
        cambio += REPOSICION
      }
      const vendido = vendidoPorDia.get(dia) ?? 0
      if (vendido > stock) throw new Error(`No alcanza el stock para vender el ${dia}`)
      stock -= vendido
      cambio -= vendido
      let valorAjustes = Dinero.cero()
      if (agotados.has(sumarDias(dia, 1))) {
        valorAjustes = this.precioCompra.multiplicarPor(Cantidad.deMilesimas(-stock))
        cambio -= stock
        stock = 0
      }
      if (cambio === 0 && vendido === 0) continue
      const cantidadVendida = Cantidad.deMilesimas(vendido)
      filas.push(
        ResumenDiario.crear({
          productoId: this.productoId,
          dia,
          lineasVendidas: vendido > 0 ? 1 : 0,
          cantidadVendida,
          ventas: this.precioVenta.multiplicarPor(cantidadVendida),
          costoVendido: this.precioCompra.multiplicarPor(cantidadVendida),
          valorAjustes,
          cambioNeto: Cantidad.deMilesimas(cambio),
        }),
      )
    }
    return {
      productoId: this.productoId,
      filas,
      stock: Cantidad.deMilesimas(stock),
      primerDia: primero.dia,
    }
  }

  private repartirVentas(agotados: ReadonlySet<Dia>): Map<Dia, number> {
    const porDia = new Map<Dia, number>()
    for (const venta of this.ventas) {
      const dias = diasDe(venta.desde, venta.hasta).filter((d) => !agotados.has(d))
      if (dias.length === 0)
        throw new Error(`No hay días para vender entre ${venta.desde} y ${venta.hasta}`)
      const parte = Math.floor(venta.milesimas / dias.length)
      const resto = venta.milesimas - parte * dias.length
      dias.forEach((dia, i) => {
        const cantidad = parte + (i === dias.length - 1 ? resto : 0)
        porDia.set(dia, (porDia.get(dia) ?? 0) + cantidad)
      })
    }
    return porDia
  }
}

export function historial(productoId = 'lejia', opciones: OpcionesDeHistorial = {}) {
  return new ConstructorDeHistorial(productoId, opciones)
}

/** Predicción con una VPD dada ("2", "0.75"): vendido = VPD × días válidos. */
export function prediccionCon(vpd: string, diasValidos = 28): Prediccion {
  return { vendido: Cantidad.deMilesimas(milesimas(vpd) * diasValidos), diasValidos }
}

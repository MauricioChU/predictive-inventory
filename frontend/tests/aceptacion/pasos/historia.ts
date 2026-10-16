import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import {
  diaDe,
  diaDeLaSemana,
  diasEntre,
  instanteLocal,
  sumarDias,
  type Dia,
} from '@/shared/domain/fecha'
import { formatearDinero, formatearNumero } from '@/shared/domain/formato'
import type { Mundo } from './mundo'

/**
 * Historia sintética de los escenarios ("vendió 56 entre …", "estuvo agotado todo el día…",
 * "tiene venta promedio diaria 2"), construida SOLO con los casos de uso reales: altas de stock
 * y ventas registradas con el reloj de prueba en el pasado (`Mundo.enElPasado`), con los
 * eventos en silencio (`sinEventos`: Alertas no evalúa mientras se fabrica el pasado, como si
 * esa historia hubiera llegado en una copia).
 *
 * Los pasos que la describen son declarativos: el significado de uno depende de los siguientes
 * (cuánto fondear, qué días quedan agotados), así que anotan un plan y `materializar()` lo
 * construye antes del primer paso que no sea declarativo.
 */

/** Una venta repartida en días: `total` entre `desde` y `hasta` (ambos inclusive). */
interface VentaPlaneada {
  total: Cantidad
  desde: Dia
  hasta: Dia
}

interface Historia {
  /** "tiene su primer movimiento el …". */
  primerMovimiento?: Dia
  ventas: VentaPlaneada[]
  /** "venta promedio diaria v": se vuelve una venta en una ventana de días (ver abajo). */
  ventaDiaria?: Cantidad
  /** "estuvo agotado todo el día durante N días entre A y B": los N ÚLTIMOS días de [A, B]. */
  agotado?: { dias: number; desde: Dia; hasta: Dia }
  /** "tiene stock S y venta promedio diaria v": el stock con que termina la historia. */
  stockFinal?: Cantidad
  /** "… y venta promedio diaria 'sin predicción'": solo el stock, registrado hoy. */
  stockDeHoy?: Cantidad
}

/** RN-AN-04: la ventana de la predicción. */
const DIAS_DE_LA_VENTANA = 28
const DIAS_VALIDOS_MINIMOS = 7
/** Fondeo de un producto sin movimientos: deja margen para vender hoy sin "Ya no queda …". */
const MARGEN_DE_STOCK = 1000
const SABADO = 6
const DOMINGO = 7

/** Lo mínimo que se puede vender de un producto (1 unidad, o 0.001 kg / L). */
function pasoDe(producto: ProductoResumido): number {
  return producto.unidad === 'UNIDAD' ? 1000 : 1
}

/**
 * La VPD v como una venta: en los 28 días anteriores a hoy si v·28 se puede vender en la
 * unidad del producto; si no, en la menor ventana de 7 a 27 días que lo permita (M11: 1.6
 * unid. por día son 16 en 10 días, no 44.8 en 28).
 */
function ventanaDeVentaDiaria(v: Cantidad, paso: number, hoy: Dia): VentaPlaneada {
  const candidatas = [
    DIAS_DE_LA_VENTANA,
    ...Array.from({ length: DIAS_DE_LA_VENTANA - DIAS_VALIDOS_MINIMOS }, (_, i) => i + 7),
  ]
  const dias = candidatas.find((n) => (v.milesimas * n) % paso === 0)
  if (dias === undefined)
    throw new Error(`No hay una ventana de días para vender ~${formatearNumero(v)} al día`)
  return {
    total: Cantidad.deMilesimas(v.milesimas * dias),
    desde: sumarDias(hoy, -dias),
    hasta: sumarDias(hoy, -1),
  }
}

/** Las ventas que caen en los días agotados terminan antes de ellos. */
function antesDeAgotarse(venta: VentaPlaneada, agotado: Historia['agotado']): VentaPlaneada {
  if (!agotado || venta.hasta < agotado.desde || venta.desde > agotado.hasta) return venta
  const ultimoDiaConStock = sumarDias(agotado.hasta, -agotado.dias)
  return { ...venta, hasta: venta.hasta < ultimoDiaConStock ? venta.hasta : ultimoDiaConStock }
}

/**
 * Reparte `total` en pasos mínimos sobre los días: cada día ⌊K/D⌋ y el resto, de a uno, en los
 * ÚLTIMOS días (el último día siempre vende, así sigue siendo válido aunque el stock
 * reconstruido hacia atrás llegue a 0).
 */
function repartir(venta: VentaPlaneada, paso: number): [Dia, number][] {
  if (venta.total.milesimas % paso !== 0) {
    throw new Error(
      `No se puede vender ${formatearNumero(venta.total)} de un producto por unidades`,
    )
  }
  const dias = diasEntre(venta.desde, venta.hasta) + 1
  const pasos = venta.total.milesimas / paso
  const porDia = Math.floor(pasos / dias)
  const resto = pasos % dias
  return Array.from({ length: dias }, (_, i) => [
    sumarDias(venta.desde, i),
    (porDia + (i >= dias - resto ? 1 : 0)) * paso,
  ])
}

export class PlanDeHistoria {
  private readonly planes = new Map<string, Historia>()

  constructor(private readonly m: Mundo) {}

  /** El plan del producto (se crea vacío la primera vez). */
  de(nombre: string): Historia {
    const existente = this.planes.get(nombre)
    if (existente) return existente
    const nuevo: Historia = { ventas: [] }
    this.planes.set(nombre, nuevo)
    return nuevo
  }

  /** "tiene stock S y venta promedio diaria v" (v = "sin predicción": solo el stock de hoy). */
  async declararEstado(nombre: string, stock: string, ventaDiaria: string): Promise<void> {
    const producto = await this.m.producto(nombre)
    const plan = this.de(nombre)
    if (ventaDiaria === 'sin predicción') {
      plan.stockDeHoy = Cantidad.deTexto(stock, producto.unidad)
      return
    }
    plan.stockFinal = Cantidad.deTexto(stock, producto.unidad)
    plan.ventaDiaria = Cantidad.deTexto(ventaDiaria, 'KILO')
  }

  /** Construye todo lo anotado, de una vez y en silencio. No hace nada si no hay plan. */
  async materializar(): Promise<void> {
    if (this.planes.size === 0) return
    const planes = [...this.planes]
    this.planes.clear()
    await this.m.app.sinEventos(async () => {
      for (const [nombre, plan] of planes) await this.construir(nombre, plan)
    })
  }

  private async construir(nombre: string, plan: Historia): Promise<void> {
    const producto = await this.m.producto(nombre)
    const operaciones = await this.m.app.inventario.historial({ productoId: producto.id })

    if (plan.stockDeHoy) {
      // Sin historia: el primer movimiento es hoy, así que no hay predicción (RN-AN-04).
      if (plan.stockDeHoy.esPositiva()) {
        await this.darDeAlta(producto, plan.stockDeHoy, operaciones.length === 0)
      }
      return
    }

    const paso = pasoDe(producto)
    const ventas = [...plan.ventas]
    if (plan.ventaDiaria) ventas.push(ventanaDeVentaDiaria(plan.ventaDiaria, paso, this.m.dia))
    const porDia = new Map<Dia, number>()
    for (const venta of ventas.map((v) => antesDeAgotarse(v, plan.agotado))) {
      for (const [dia, cantidad] of repartir(venta, paso)) {
        porDia.set(dia, (porDia.get(dia) ?? 0) + cantidad)
      }
    }
    const diasConVenta = [...porDia]
      .filter(([, cantidad]) => cantidad > 0)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    const vendido = diasConVenta.reduce((suma, [, cantidad]) => suma + cantidad, 0)
    const primeraVenta = diasConVenta[0]?.[0] ?? ventas[0]?.desde
    if (primeraVenta === undefined) throw new Error(`La historia de "${nombre}" no tiene ventas`)

    // Fondeo: el stock que hace falta para esas ventas, salvo que ya hubiera una alta anterior
    // (p. ej. "tiene stock inicial 500 desde 2026-08-01"): entonces las ventas caben en ella.
    const altaAnterior = operaciones.some((o) => diaDe(o.ocurridaEn) < primeraVenta)
    if (!altaAnterior) {
      const sinOperaciones = operaciones.length === 0
      if (plan.stockFinal && !sinOperaciones) {
        throw new Error(`"${nombre}" ya tiene movimientos: no se puede fijar su stock final`)
      }
      const restante = plan.agotado
        ? 0
        : plan.stockFinal
          ? plan.stockFinal.milesimas
          : sinOperaciones
            ? MARGEN_DE_STOCK * 1000
            : 0 // su stock de hoy ya viene de una operación de hoy (tabla de productos)
      const alta = Cantidad.deMilesimas(vendido + restante)
      const dia = plan.primerMovimiento ?? primeraVenta
      if (alta.esPositiva()) {
        await this.m.enElPasado(instanteLocal(`${dia} 08:00`), () =>
          this.darDeAlta(producto, alta, sinOperaciones),
        )
      }
    }

    for (const [dia, cantidad] of diasConVenta) {
      await this.m.enElPasado(instanteLocal(`${dia} 12:00`), () =>
        this.m.app.inventario.registrarVenta({
          lineas: [
            { productoId: producto.id, cantidad: formatearNumero(Cantidad.deMilesimas(cantidad)) },
          ],
        }),
      )
    }
  }

  /**
   * Alta de stock al costo del producto: el STOCK_INICIAL que registra Catálogo al crear un
   * producto con stock (RN-CAT-08, misma llamada de Inventario) si todavía no tiene movimientos;
   * si no, una llegada de mercadería (RN-OP-14/20 ya contestadas: "Registrar igual", sin
   * cambiar el precio de compra).
   */
  async darDeAlta(
    producto: ProductoResumido,
    cantidad: Cantidad,
    comoStockInicial: boolean,
  ): Promise<void> {
    if (comoStockInicial) {
      await this.m.app.inventario.consultable.registrarStockInicial(
        producto.id,
        cantidad,
        producto.precioCompra,
      )
      return
    }
    const respuesta = await this.m.app.inventario.registrarIngreso({
      lineas: [
        {
          productoId: producto.id,
          cantidad: formatearNumero(cantidad),
          costo: formatearDinero(producto.precioCompra),
        },
      ],
      confirmarSobrecompra: true,
      actualizarPreciosDeCompra: false,
    })
    if (respuesta.tipo !== 'hecho') {
      throw new Error(`No se registró el alta de "${producto.nombre}": ${respuesta.tipo}`)
    }
  }

  // ───────────── Dinero de la tienda (M13) ─────────────
  //
  // "ayer la ganancia neta fue …", "entre A y B se vendió V con ganancia neta N", "hoy se vendió
  // …", "la tienda tiene su primera operación el …" y el mejor día hablan de la tienda, no de
  // un producto. Se fabrican con productos auxiliares «Historia n» creados con el caso de uso
  // real (categoría Otros, mínimo 0, siempre con stock: NORMAL y sin predicción, así que no
  // cambian Atención ni Para comprar) y ventas reales.

  /** `trabajo` en ese día a esa hora; si es hoy, ahora mismo (sin viajar). */
  private enElDia<T>(dia: Dia, hora: string, trabajo: () => Promise<T>): Promise<T> {
    if (dia === this.m.dia) return trabajo()
    return this.m.enElPasado(instanteLocal(`${dia} ${hora}`), trabajo)
  }

  private async productoAuxiliar(
    dia: Dia,
    datos: { compra: Dinero; venta: Dinero; stock: number },
  ): Promise<string> {
    const categoriaId = await this.m.categoriaId('Otros')
    const nombre = this.m.nombreAuxiliar()
    const respuesta = await this.enElDia(dia, '08:00', () =>
      this.m.app.catalogo.crearProducto({
        nombre,
        categoriaId,
        unidad: 'UNIDAD',
        precioCompra: formatearDinero(datos.compra),
        precioVenta: formatearDinero(datos.venta),
        stockMinimo: '0',
        stockInicial: String(datos.stock),
        confirmado: true,
      }),
    )
    if (respuesta.tipo !== 'hecho') throw new Error(`No se creó el auxiliar "${nombre}"`)
    return respuesta.valor.productoId
  }

  /** Una venta de la tienda en `dia` por `ventas`, con esa ganancia neta (costo = la diferencia). */
  async ventaDeLaTienda(dia: Dia, ventas: string, gananciaNeta: string): Promise<void> {
    const venta = Dinero.deTexto(ventas)
    const compra = venta.restar(Dinero.deTexto(gananciaNeta))
    await this.m.app.sinEventos(async () => {
      const productoId = await this.productoAuxiliar(dia, { compra, venta, stock: 2 })
      await this.enElDia(dia, '12:00', () =>
        this.m.app.inventario.registrarVenta({ lineas: [{ productoId, cantidad: '1' }] }),
      )
    })
  }

  /** La primera operación de la tienda fue ese día (RN-AN-12/13): un alta, si hace falta. */
  async primeraOperacionDeLaTienda(dia: Dia): Promise<void> {
    const dias = (await this.m.app.inventario.consultable.operaciones())
      .map((o) => diaDe(o.ocurridaEn))
      .sort()
    const primero = dias[0]
    if (primero !== undefined && primero < dia) {
      throw new Error(`La tienda ya tiene operaciones del ${primero}, antes del ${dia}`)
    }
    if (primero === dia) return
    await this.m.app.sinEventos(async () => {
      await this.productoAuxiliar(dia, {
        compra: Dinero.cero(),
        venta: Dinero.deTexto('1.00'),
        stock: 1,
      })
    })
  }

  /**
   * RN-AN-13: en cada uno de los `dias` días completos anteriores a hoy, una venta de
   * `diario` (o de `sabado` los sábados, con precio especial, RN-OP-11) y nada los domingos.
   */
  async ventasPorDiaDeLaSemana(dias: number, diario: string, sabado: string): Promise<void> {
    const desde = sumarDias(this.m.dia, -dias)
    await this.m.app.sinEventos(async () => {
      const productoId = await this.productoAuxiliar(desde, {
        compra: Dinero.cero(),
        venta: Dinero.deTexto(diario),
        stock: dias + 1,
      })
      for (let i = 0; i < dias; i += 1) {
        const dia = sumarDias(desde, i)
        const semana = diaDeLaSemana(dia)
        if (semana === DOMINGO) continue
        const linea =
          semana === SABADO
            ? { productoId, cantidad: '1', precioEspecial: sabado }
            : { productoId, cantidad: '1' }
        await this.enElDia(dia, '12:00', () =>
          this.m.app.inventario.registrarVenta({ lineas: [linea] }),
        )
      }
    })
  }
}

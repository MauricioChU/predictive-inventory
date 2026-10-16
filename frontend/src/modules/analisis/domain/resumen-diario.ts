import type { OperacionRegistro, ResumenDiarioRegistro } from '@/shared/contratos/registros'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { diaDe, type Dia } from '@/shared/domain/fecha'

export function claveDeResumen(productoId: string, dia: Dia): string {
  return `${productoId}|${dia}`
}

/** Campos de una fila de la proyección `ResumenDiario` (04-torre-de-control, Modelo). */
export interface DatosDeResumen {
  productoId: string
  dia: Dia
  lineasVendidas: number
  cantidadVendida: Cantidad
  ventas: Dinero
  costoVendido: Dinero
  costoMermas: Dinero
  valorAjustes: Dinero
  /** Cambio de stock de TODAS las operaciones del día, incluidas las anulaciones. */
  cambioNeto: Cantidad
}

/**
 * Proyección por producto y día (objeto de valor inmutable). Una fila también sirve como
 * "aporte" (lo que una operación suma), así que las filas se combinan con `sumar`.
 */
export class ResumenDiario implements DatosDeResumen {
  readonly productoId: string
  readonly dia: Dia
  readonly lineasVendidas: number
  readonly cantidadVendida: Cantidad
  readonly ventas: Dinero
  readonly costoVendido: Dinero
  readonly costoMermas: Dinero
  readonly valorAjustes: Dinero
  readonly cambioNeto: Cantidad

  private constructor(datos: DatosDeResumen) {
    this.productoId = datos.productoId
    this.dia = datos.dia
    this.lineasVendidas = datos.lineasVendidas
    this.cantidadVendida = datos.cantidadVendida
    this.ventas = datos.ventas
    this.costoVendido = datos.costoVendido
    this.costoMermas = datos.costoMermas
    this.valorAjustes = datos.valorAjustes
    this.cambioNeto = datos.cambioNeto
  }

  static vacio(productoId: string, dia: Dia): ResumenDiario {
    return ResumenDiario.crear({ productoId, dia })
  }

  /** Fila con los campos dados y el resto en cero. */
  static crear(
    datos: Pick<DatosDeResumen, 'productoId' | 'dia'> & Partial<DatosDeResumen>,
  ): ResumenDiario {
    return new ResumenDiario({
      lineasVendidas: 0,
      cantidadVendida: Cantidad.cero(),
      ventas: Dinero.cero(),
      costoVendido: Dinero.cero(),
      costoMermas: Dinero.cero(),
      valorAjustes: Dinero.cero(),
      cambioNeto: Cantidad.cero(),
      ...datos,
    })
  }

  static desdeRegistro(r: ResumenDiarioRegistro): ResumenDiario {
    return new ResumenDiario({
      productoId: r.productoId,
      dia: r.dia,
      lineasVendidas: r.lineasVendidas,
      cantidadVendida: Cantidad.deMilesimas(r.cantidadVendida),
      ventas: Dinero.deCentimos(r.ventas),
      costoVendido: Dinero.deCentimos(r.costoVendido),
      costoMermas: Dinero.deCentimos(r.costoMermas),
      valorAjustes: Dinero.deCentimos(r.valorAjustes),
      cambioNeto: Cantidad.deMilesimas(r.cambioNeto),
    })
  }

  get clave(): string {
    return claveDeResumen(this.productoId, this.dia)
  }

  /** Ventas − costo de lo vendido (RN-AN-02). */
  get gananciaBruta(): Dinero {
    return this.ventas.restar(this.costoVendido)
  }

  get tieneVentas(): boolean {
    return this.lineasVendidas > 0
  }

  /** Un día con stock inicial o ingresos solamente no cuenta en los totales de la tienda. */
  get tieneVentasMermasOAjustes(): boolean {
    return this.tieneVentas || !this.costoMermas.esCero() || !this.valorAjustes.esCero()
  }

  aRegistro(): ResumenDiarioRegistro {
    return {
      clave: this.clave,
      productoId: this.productoId,
      dia: this.dia,
      lineasVendidas: this.lineasVendidas,
      cantidadVendida: this.cantidadVendida.milesimas,
      ventas: this.ventas.centimos,
      costoVendido: this.costoVendido.centimos,
      costoMermas: this.costoMermas.centimos,
      valorAjustes: this.valorAjustes.centimos,
      cambioNeto: this.cambioNeto.milesimas,
    }
  }

  sumar(otro: ResumenDiario): ResumenDiario {
    if (otro.clave !== this.clave) {
      throw new Error(`No se suman filas distintas: ${this.clave} y ${otro.clave}`)
    }
    return new ResumenDiario({
      productoId: this.productoId,
      dia: this.dia,
      lineasVendidas: this.lineasVendidas + otro.lineasVendidas,
      cantidadVendida: this.cantidadVendida.sumar(otro.cantidadVendida),
      ventas: this.ventas.sumar(otro.ventas),
      costoVendido: this.costoVendido.sumar(otro.costoVendido),
      costoMermas: this.costoMermas.sumar(otro.costoMermas),
      valorAjustes: this.valorAjustes.sumar(otro.valorAjustes),
      cambioNeto: this.cambioNeto.sumar(otro.cambioNeto),
    })
  }

  /** Lo que hay que sumar para deshacer estas métricas, sin tocar el cambio de stock. */
  metricasRevertidas(): ResumenDiario {
    return ResumenDiario.crear({
      productoId: this.productoId,
      dia: this.dia,
      lineasVendidas: -this.lineasVendidas,
      cantidadVendida: this.cantidadVendida.negar(),
      ventas: this.ventas.negar(),
      costoVendido: this.costoVendido.negar(),
      costoMermas: this.costoMermas.negar(),
      valorAjustes: this.valorAjustes.negar(),
    })
  }
}

/**
 * Lo que una operación suma a la proyección (aplicarOperacion): un aporte por movimiento,
 * en la fila (producto, día en que ocurrió). Cada importe se redondea al céntimo por línea
 * (RN-OP-12). Una ANULACION solo aporta su cambio de stock.
 */
export function aportesDeOperacion(op: OperacionRegistro): ResumenDiario[] {
  const dia = diaDe(op.ocurridaEn)
  return op.movimientos.map((m) => {
    const cantidad = Cantidad.deMilesimas(m.cantidad)
    const absoluta = cantidad.abs()
    const costo = Dinero.deCentimos(m.costoUnitario)
    const base = { productoId: m.productoId, dia, cambioNeto: cantidad }
    switch (op.tipo) {
      case 'VENTA':
        return ResumenDiario.crear({
          ...base,
          lineasVendidas: 1,
          cantidadVendida: absoluta,
          ventas: Dinero.deCentimos(m.precioUnitario ?? 0).multiplicarPor(absoluta),
          costoVendido: costo.multiplicarPor(absoluta),
        })
      case 'MERMA':
        return ResumenDiario.crear({ ...base, costoMermas: costo.multiplicarPor(absoluta) })
      case 'AJUSTE':
        return ResumenDiario.crear({ ...base, valorAjustes: costo.multiplicarPor(cantidad) })
      default:
        return ResumenDiario.crear(base)
    }
  })
}

/**
 * Lo que una anulación suma a la proyección (revertirOperacion, RN-AN-01 / RN-OP-17): resta
 * del día de la original todo lo que la original sumó, salvo el cambio de stock; y suma el
 * cambio de stock de la anulación en el día de la anulación. Así las métricas de la original
 * desaparecen, pero el stock de cada día sigue siendo el real.
 */
export function aportesDeAnulacion(
  original: OperacionRegistro,
  anulacion: OperacionRegistro,
): ResumenDiario[] {
  return [
    ...aportesDeOperacion(original).map((a) => a.metricasRevertidas()),
    ...aportesDeOperacion({ ...anulacion, tipo: 'ANULACION' }),
  ]
}

/** Proyección completa del libro de operaciones (reconstruir), recorrido por `registradaEn`. */
export function proyectarLibro(operaciones: readonly OperacionRegistro[]): ResumenDiario[] {
  const porId = new Map(operaciones.map((op) => [op.id, op]))
  const filas = new Map<string, ResumenDiario>()
  const ordenadas = [...operaciones].sort((a, b) =>
    a.registradaEn < b.registradaEn ? -1 : a.registradaEn > b.registradaEn ? 1 : 0,
  )
  for (const op of ordenadas) {
    const original = op.tipo === 'ANULACION' && op.anulaA ? porId.get(op.anulaA) : undefined
    const aportes = original ? aportesDeAnulacion(original, op) : aportesDeOperacion(op)
    for (const aporte of aportes) {
      const previa = filas.get(aporte.clave)
      filas.set(aporte.clave, previa ? previa.sumar(aporte) : aporte)
    }
  }
  return [...filas.values()]
}

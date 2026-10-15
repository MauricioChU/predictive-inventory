import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { ErrorDeDominio } from '@/shared/domain/errores'
import type { Instante } from '@/shared/domain/fecha'
import type { TipoDeOperacion } from '@/shared/contratos/operaciones'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import {
  normalizarNota,
  validarCantidad,
  validarCosto,
  validarMotivoDeMerma,
  validarPrecioDeVenta,
} from './reglas'

/** Parte de una operación: un producto, con cantidad CON SIGNO (+ entra, − sale). */
export interface Movimiento {
  readonly productoId: string
  readonly cantidad: Cantidad
  /** Precio de compra en ese momento, o el indicado en un ingreso (ADR-0004). */
  readonly costoUnitario: Dinero
  /** Solo en ventas: el precio de venta aplicado (RN-OP-10, RN-OP-11). */
  readonly precioUnitario: Dinero | null
}

/** Movimiento con sus montos calculados al céntimo por línea (RN-OP-12). */
export interface LineaDeOperacion extends Movimiento {
  /** precio × cantidad; solo si hay precio (ventas). */
  readonly importe: Dinero | null
  /** costo × cantidad. */
  readonly costoTotal: Dinero
  /** importe − costo total; solo si hay precio (ventas). */
  readonly ganancia: Dinero | null
}

export interface DatosDeRegistro {
  id: string
  ocurridaEn: Instante
  registradaEn: Instante
  dispositivoId: string
  nota?: string | null
}

export interface LineaDeVenta {
  productoId: string
  /** Positiva: la venta la resta. */
  cantidad: Cantidad
  precioUnitario: Dinero
  costoUnitario: Dinero
}

export interface LineaConCosto {
  productoId: string
  /** Positiva: el tipo de operación decide el signo. */
  cantidad: Cantidad
  costoUnitario: Dinero
}

export interface LineaDeAjuste {
  productoId: string
  /** Con signo: contado − stock (RN-OP-16), o −stock al retirar (RN-CAT-11). */
  diferencia: Cantidad
  costoUnitario: Dinero
}

interface Campos {
  id: string
  tipo: TipoDeOperacion
  movimientos: readonly Movimiento[]
  ocurridaEn: Instante
  registradaEn: Instante
  motivo: string | null
  nota: string | null
  anulaA: string | null
  dispositivoId: string
}

function comunes(
  datos: DatosDeRegistro,
  tipo: TipoDeOperacion,
  motivo: string | null = null,
): Omit<Campos, 'movimientos'> {
  return {
    id: datos.id,
    tipo,
    ocurridaEn: datos.ocurridaEn,
    registradaEn: datos.registradaEn,
    dispositivoId: datos.dispositivoId,
    nota: normalizarNota(datos.nota),
    motivo,
    anulaA: null,
  }
}

function entrada(linea: LineaConCosto): Movimiento {
  return {
    productoId: linea.productoId,
    cantidad: validarCantidad(linea.cantidad),
    costoUnitario: validarCosto(linea.costoUnitario),
    precioUnitario: null,
  }
}

function salida(linea: LineaConCosto): Movimiento {
  const movimiento = entrada(linea)
  return { ...movimiento, cantidad: movimiento.cantidad.negar() }
}

/**
 * Agregado inmutable del libro de operaciones (ADR-0002, RN-OP-02): una vez creada, una
 * operación no cambia; para corregirla se registra su anulación.
 */
export class Operacion {
  private constructor(private readonly campos: Campos) {}

  private static crear(campos: Campos): Operacion {
    if (campos.movimientos.length === 0) {
      throw new Error('Una operación necesita al menos un movimiento')
    }
    const vistos = new Set<string>()
    for (const movimiento of campos.movimientos) {
      if (vistos.has(movimiento.productoId)) {
        throw new Error(`La operación repite el producto ${movimiento.productoId}`)
      }
      if (movimiento.cantidad.esCero()) throw new Error('Un movimiento no puede tener cantidad 0')
      vistos.add(movimiento.productoId)
    }
    const movimientos = Object.freeze(campos.movimientos.map((m) => Object.freeze({ ...m })))
    return new Operacion(Object.freeze({ ...campos, movimientos }))
  }

  /** RN-OP-10, RN-OP-11: guarda precio de venta y costo vigentes; resta las cantidades. */
  static venta(datos: DatosDeRegistro, lineas: readonly LineaDeVenta[]): Operacion {
    return Operacion.crear({
      ...comunes(datos, 'VENTA'),
      movimientos: lineas.map((linea) => ({
        ...salida(linea),
        precioUnitario: validarPrecioDeVenta(linea.precioUnitario),
      })),
    })
  }

  /** RN-OP-14: cada línea con su costo de compra; suma las cantidades. */
  static ingreso(datos: DatosDeRegistro, lineas: readonly LineaConCosto[]): Operacion {
    return Operacion.crear({ ...comunes(datos, 'INGRESO'), movimientos: lineas.map(entrada) })
  }

  /** RN-OP-15: motivo obligatorio ("Otro" con nota); resta la cantidad. */
  static merma(datos: DatosDeRegistro & { motivo: string }, linea: LineaConCosto): Operacion {
    const motivo = validarMotivoDeMerma(datos.motivo, datos.nota)
    return Operacion.crear({ ...comunes(datos, 'MERMA', motivo), movimientos: [salida(linea)] })
  }

  /** RN-OP-16 / RN-CAT-11: la diferencia con signo, con el motivo del ajuste. */
  static ajuste(datos: DatosDeRegistro & { motivo: string }, linea: LineaDeAjuste): Operacion {
    return Operacion.crear({
      ...comunes(datos, 'AJUSTE', datos.motivo),
      movimientos: [
        {
          productoId: linea.productoId,
          cantidad: linea.diferencia,
          costoUnitario: validarCosto(linea.costoUnitario),
          precioUnitario: null,
        },
      ],
    })
  }

  /** RN-CAT-08: suma la cantidad con el costo recibido. */
  static stockInicial(datos: DatosDeRegistro, linea: LineaConCosto): Operacion {
    return Operacion.crear({ ...comunes(datos, 'STOCK_INICIAL'), movimientos: [entrada(linea)] })
  }

  /**
   * RN-OP-17: invierte todos los movimientos de `original` con sus mismos costos. Una
   * anulación no se puede anular. Que no esté ya anulada lo verifica quien la registra.
   */
  static anulacionDe(
    original: Operacion,
    datos: DatosDeRegistro & { motivo?: string | null },
  ): Operacion {
    if (original.tipo === 'ANULACION') {
      throw new ErrorDeDominio(
        'ANULACION_NO_ANULABLE',
        'Una anulación no se puede anular. Registra la operación de nuevo',
      )
    }
    const motivo = datos.motivo?.trim() || null
    return Operacion.crear({
      ...comunes(datos, 'ANULACION', motivo),
      anulaA: original.id,
      movimientos: original.movimientos.map((m) => ({
        productoId: m.productoId,
        cantidad: m.cantidad.negar(),
        costoUnitario: m.costoUnitario,
        precioUnitario: null,
      })),
    })
  }

  static desdeRegistro(registro: OperacionRegistro): Operacion {
    return Operacion.crear({
      id: registro.id,
      tipo: registro.tipo,
      movimientos: registro.movimientos.map((m) => ({
        productoId: m.productoId,
        cantidad: Cantidad.deMilesimas(m.cantidad),
        costoUnitario: Dinero.deCentimos(m.costoUnitario),
        precioUnitario: m.precioUnitario === null ? null : Dinero.deCentimos(m.precioUnitario),
      })),
      ocurridaEn: registro.ocurridaEn,
      registradaEn: registro.registradaEn,
      motivo: registro.motivo,
      nota: registro.nota,
      anulaA: registro.anulaA,
      dispositivoId: registro.dispositivoId,
    })
  }

  aRegistro(): OperacionRegistro {
    return {
      id: this.id,
      tipo: this.tipo,
      movimientos: this.movimientos.map((m) => ({
        productoId: m.productoId,
        cantidad: m.cantidad.milesimas,
        costoUnitario: m.costoUnitario.centimos,
        precioUnitario: m.precioUnitario?.centimos ?? null,
      })),
      productoIds: this.productoIds,
      ocurridaEn: this.ocurridaEn,
      registradaEn: this.registradaEn,
      motivo: this.motivo,
      nota: this.nota,
      anulaA: this.anulaA,
      dispositivoId: this.dispositivoId,
    }
  }

  get id(): string {
    return this.campos.id
  }

  get tipo(): TipoDeOperacion {
    return this.campos.tipo
  }

  get movimientos(): readonly Movimiento[] {
    return this.campos.movimientos
  }

  get productoIds(): string[] {
    return this.movimientos.map((m) => m.productoId)
  }

  get ocurridaEn(): Instante {
    return this.campos.ocurridaEn
  }

  get registradaEn(): Instante {
    return this.campos.registradaEn
  }

  get motivo(): string | null {
    return this.campos.motivo
  }

  get nota(): string | null {
    return this.campos.nota
  }

  get anulaA(): string | null {
    return this.campos.anulaA
  }

  get dispositivoId(): string {
    return this.campos.dispositivoId
  }

  /** RN-OP-12: importe, costo total y ganancia por línea, redondeados al céntimo. */
  lineas(): LineaDeOperacion[] {
    return this.movimientos.map((m) => {
      const cantidad = m.cantidad.abs()
      const importe = m.precioUnitario?.multiplicarPor(cantidad) ?? null
      const costoTotal = m.costoUnitario.multiplicarPor(cantidad)
      return { ...m, importe, costoTotal, ganancia: importe?.restar(costoTotal) ?? null }
    })
  }

  /** RN-OP-12: suma de importes de línea; solo para ventas. */
  total(): Dinero | null {
    if (this.tipo !== 'VENTA') return null
    return Dinero.sumarTodos(
      this.lineas()
        .map((l) => l.importe)
        .filter(esMonto),
    )
  }

  /** RN-OP-12: suma de ganancias de línea; solo para ventas. */
  ganancia(): Dinero | null {
    if (this.tipo !== 'VENTA') return null
    return Dinero.sumarTodos(
      this.lineas()
        .map((l) => l.ganancia)
        .filter(esMonto),
    )
  }
}

function esMonto(monto: Dinero | null): monto is Dinero {
  return monto !== null
}

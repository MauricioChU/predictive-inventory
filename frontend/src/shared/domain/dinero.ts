import type { Cantidad } from './cantidad'
import { ErrorDeDominio } from './errores'

const PATRON_NUMERO = /^-?\d+(\.\d+)?$/

/** Redondea numerador/divisor al entero más cercano; las mitades se alejan de cero. */
export function redondearMitadLejosDeCero(numerador: number, divisor: number): number {
  const signo = numerador < 0 ? -1 : 1
  return signo * Math.floor((Math.abs(numerador) + divisor / 2) / divisor)
}

/** Monto en soles, guardado como céntimos enteros (ADR-0003). */
export class Dinero {
  private constructor(readonly centimos: number) {}

  static deCentimos(centimos: number): Dinero {
    if (!Number.isSafeInteger(centimos)) throw new Error(`Céntimos inválidos: ${centimos}`)
    return new Dinero(centimos)
  }

  static cero(): Dinero {
    return new Dinero(0)
  }

  /** Acepta "2.40", "2,40", "S/ 2.40". Lanza ErrorDeDominio con el mensaje de la spec. */
  static deTexto(texto: string): Dinero {
    const limpio = texto.replace(/S\/\s*/i, '').replace(/\s+/g, '').replace(',', '.')
    if (!PATRON_NUMERO.test(limpio)) {
      throw new ErrorDeDominio('DINERO_INVALIDO', 'Escribe un monto válido, por ejemplo 3.50')
    }
    const negativo = limpio.startsWith('-')
    const [entero = '0', decimales = ''] = limpio.replace('-', '').split('.')
    if (decimales.length > 2) {
      throw new ErrorDeDominio('DINERO_DECIMALES', 'Usa como máximo dos decimales')
    }
    const centimos = Number(entero) * 100 + Number(decimales.padEnd(2, '0'))
    return Dinero.deCentimos(negativo ? -centimos : centimos)
  }

  static sumarTodos(lista: readonly Dinero[]): Dinero {
    return lista.reduce((total, d) => total.sumar(d), Dinero.cero())
  }

  sumar(otro: Dinero): Dinero {
    return Dinero.deCentimos(this.centimos + otro.centimos)
  }

  restar(otro: Dinero): Dinero {
    return Dinero.deCentimos(this.centimos - otro.centimos)
  }

  negar(): Dinero {
    return Dinero.deCentimos(-this.centimos)
  }

  /** Precio por unidad × cantidad, redondeado al céntimo (RN-OP-12). */
  multiplicarPor(cantidad: Cantidad): Dinero {
    return Dinero.deCentimos(redondearMitadLejosDeCero(this.centimos * cantidad.milesimas, 1000))
  }

  esCero(): boolean {
    return this.centimos === 0
  }

  esNegativo(): boolean {
    return this.centimos < 0
  }

  esPositivo(): boolean {
    return this.centimos > 0
  }

  compararCon(otro: Dinero): number {
    return this.centimos - otro.centimos
  }

  igualA(otro: Dinero): boolean {
    return this.centimos === otro.centimos
  }

  mayorQue(otro: Dinero): boolean {
    return this.centimos > otro.centimos
  }

  menorQue(otro: Dinero): boolean {
    return this.centimos < otro.centimos
  }

  menorOIgualQue(otro: Dinero): boolean {
    return this.centimos <= otro.centimos
  }
}

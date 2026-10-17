import type { Cantidad } from './cantidad'
import { ErrorDeDominio } from './errores'

const PATRON_NUMERO = /^\d+(\.\d+)?$/
// Fix round 2, minor: acepta los miles agrupados con UN espacio que produce el propio
// formatearDinero (p. ej. "1 250.00", "99 999.99"), para que deTexto(formatearDinero(x))
// siempre funcione. Un espacio doble o un espacio que no agrupe de 3 en 3 sigue sin matchear.
const PATRON_NUMERO_AGRUPADO = /^\d{1,3}( \d{3})+(\.\d+)?$/

/** Redondea numerador/divisor al entero más cercano; las mitades se alejan de cero. */
export function redondearMitadLejosDeCero(numerador: number, divisor: number): number {
  const signo = numerador < 0 ? -1 : 1
  const resultado = signo * Math.floor((Math.abs(numerador) + divisor / 2) / divisor)
  // Fix round 1, M1: -0 y 0 deben ser indistinguibles para quien usa Dinero.
  return resultado === 0 ? 0 : resultado
}

/** Monto en soles, guardado como céntimos enteros (ADR-0003). */
export class Dinero {
  private constructor(readonly centimos: number) {}

  static deCentimos(centimos: number): Dinero {
    if (!Number.isSafeInteger(centimos)) throw new Error(`Céntimos inválidos: ${centimos}`)
    // Fix round 1, M1: normaliza -0 a 0.
    return new Dinero(centimos === 0 ? 0 : centimos)
  }

  static cero(): Dinero {
    return new Dinero(0)
  }

  /**
   * Acepta "2.40", "2,40", "S/ 2.40", "-S/ 4.80" y lo que produce formatearDinero (miles
   * agrupados con un espacio, p. ej. "S/ 1 250.00"). Lanza ErrorDeDominio con el mensaje
   * de la spec. Fix round 1, M3: "S/" solo es un prefijo opcional (con a lo sumo un espacio
   * detrás); solo se recorta el espacio EXTERIOR del texto completo, nunca espacios
   * internos sueltos. Así "3 S/ 5" y "1 2" quedan con un espacio que no agrupa de a 3 y
   * fallan el patrón numérico.
   */
  static deTexto(texto: string): Dinero {
    const recortado = texto.trim()
    const negativo = recortado.startsWith('-')
    const sinSigno = negativo ? recortado.slice(1) : recortado
    const numero = sinSigno.replace(/^S\/\s?/i, '').replace(',', '.')
    if (!PATRON_NUMERO.test(numero) && !PATRON_NUMERO_AGRUPADO.test(numero)) {
      throw new ErrorDeDominio('DINERO_INVALIDO', 'Escribe un monto válido, por ejemplo 3.50')
    }
    const [entero = '0', decimales = ''] = numero.replace(/ /g, '').split('.')
    if (decimales.length > 2) {
      throw new ErrorDeDominio('DINERO_DECIMALES', 'Usa como máximo dos decimales')
    }
    const centimos = Number(entero) * 100 + Number(decimales.padEnd(2, '0'))
    // Fix round 1, M2: un monto que desborda Number.isSafeInteger es un monto inválido
    // para el usuario, no un error interno: usa el mismo mensaje que el formato inválido.
    if (!Number.isSafeInteger(centimos)) {
      throw new ErrorDeDominio('DINERO_INVALIDO', 'Escribe un monto válido, por ejemplo 3.50')
    }
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

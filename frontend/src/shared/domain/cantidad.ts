import { ErrorDeDominio } from './errores'

export type Unidad = 'UNIDAD' | 'KILO' | 'LITRO'
export const UNIDADES: readonly Unidad[] = ['UNIDAD', 'KILO', 'LITRO']

const PATRON_NUMERO = /^-?\d+(\.\d+)?$/

/** Cantidad en milésimas de la unidad del producto (ADR-0003). */
export class Cantidad {
  private constructor(readonly milesimas: number) {}

  static deMilesimas(milesimas: number): Cantidad {
    if (!Number.isSafeInteger(milesimas)) throw new Error(`Milésimas inválidas: ${milesimas}`)
    return new Cantidad(milesimas)
  }

  static cero(): Cantidad {
    return new Cantidad(0)
  }

  static deEntero(n: number): Cantidad {
    return Cantidad.deMilesimas(n * 1000)
  }

  /** Lee lo que escribe el usuario y valida la precisión de la unidad (RN-OP-04). El signo lo valida quien la usa. */
  static deTexto(texto: string, unidad: Unidad): Cantidad {
    const limpio = texto.trim().replace(',', '.')
    if (!PATRON_NUMERO.test(limpio)) {
      throw new ErrorDeDominio(
        'CANTIDAD_INVALIDA',
        'Escribe una cantidad válida, por ejemplo 2 o 1.5',
      )
    }
    const negativo = limpio.startsWith('-')
    const [entero = '0', crudos = ''] = limpio.replace('-', '').split('.')
    const decimales = crudos.replace(/0+$/, '')
    if (unidad === 'UNIDAD' && decimales.length > 0) {
      throw new ErrorDeDominio('CANTIDAD_ENTERA', 'Este producto se cuenta por unidades enteras')
    }
    if (decimales.length > 3) {
      throw new ErrorDeDominio('CANTIDAD_DECIMALES', 'Usa como máximo tres decimales')
    }
    const milesimas = Number(entero) * 1000 + Number(decimales.padEnd(3, '0'))
    return Cantidad.deMilesimas(negativo ? -milesimas : milesimas)
  }

  /** Paso mínimo para cantidades sugeridas: 1 unidad, o 0.5 kg / 0.5 L (RN-AN-06). */
  static incrementoDe(unidad: Unidad): Cantidad {
    return Cantidad.deMilesimas(unidad === 'UNIDAD' ? 1000 : 500)
  }

  static sumarTodas(lista: readonly Cantidad[]): Cantidad {
    return lista.reduce((total, c) => total.sumar(c), Cantidad.cero())
  }

  sumar(otra: Cantidad): Cantidad {
    return Cantidad.deMilesimas(this.milesimas + otra.milesimas)
  }

  restar(otra: Cantidad): Cantidad {
    return Cantidad.deMilesimas(this.milesimas - otra.milesimas)
  }

  negar(): Cantidad {
    return Cantidad.deMilesimas(-this.milesimas)
  }

  abs(): Cantidad {
    return Cantidad.deMilesimas(Math.abs(this.milesimas))
  }

  esCero(): boolean {
    return this.milesimas === 0
  }

  esPositiva(): boolean {
    return this.milesimas > 0
  }

  esNegativa(): boolean {
    return this.milesimas < 0
  }

  esUno(): boolean {
    return this.milesimas === 1000
  }

  compararCon(otra: Cantidad): number {
    return this.milesimas - otra.milesimas
  }

  igualA(otra: Cantidad): boolean {
    return this.milesimas === otra.milesimas
  }

  mayorQue(otra: Cantidad): boolean {
    return this.milesimas > otra.milesimas
  }

  menorQue(otra: Cantidad): boolean {
    return this.milesimas < otra.milesimas
  }

  mayorOIgualQue(otra: Cantidad): boolean {
    return this.milesimas >= otra.milesimas
  }

  menorOIgualQue(otra: Cantidad): boolean {
    return this.milesimas <= otra.milesimas
  }

  esValidaPara(unidad: Unidad): boolean {
    return unidad !== 'UNIDAD' || this.milesimas % 1000 === 0
  }

  /** Para valores ≥ 0: el menor múltiplo del incremento que no es menor que esta cantidad. */
  redondearHaciaArribaA(incremento: Cantidad): Cantidad {
    const paso = incremento.milesimas
    return Cantidad.deMilesimas(Math.ceil(this.milesimas / paso) * paso)
  }
}

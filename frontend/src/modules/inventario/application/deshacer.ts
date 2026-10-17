import { ErrorDeDominio } from '@/shared/domain/errores'
import { segundosEntre, type Instante } from '@/shared/domain/fecha'
import type { Reloj } from '@/shared/domain/reloj'
import { SEGUNDOS_PARA_DESHACER } from '@/shared/contratos/operaciones'

/** RN-OP-18: "Deshacer" se ofrece durante 10 segundos (la constante compartida). */
export { SEGUNDOS_PARA_DESHACER }
/** Margen para un toque hecho justo cuando el aviso se cerraba (no amplía lo que se muestra). */
export const SEGUNDOS_DE_MARGEN_PARA_DESHACER = 2

interface Oferta {
  operacionId: string
  registradaEn: Instante
}

/**
 * RN-OP-18: después de registrar una operación se ofrece "Deshacer" durante 10 segundos;
 * solo la última. Deshacer equivale a anularla sin pedir motivo.
 */
export class ServicioDeDeshacer {
  private oferta: Oferta | null = null

  constructor(
    private readonly reloj: Reloj,
    private readonly anular: (operacionId: string) => Promise<unknown>,
  ) {}

  /** Llamado por cada registro de operación (no por anulaciones). Reemplaza la oferta anterior. */
  ofrecer(operacionId: string, registradaEn: Instante): void {
    this.oferta = { operacionId, registradaEn }
  }

  /** null si pasaron 10 segundos o más, o si ya se usó. */
  disponible(): { operacionId: string; segundosRestantes: number } | null {
    if (!this.oferta) return null
    const transcurridos = segundosEntre(this.oferta.registradaEn, this.reloj.ahora())
    if (transcurridos >= SEGUNDOS_PARA_DESHACER) return null
    const restantes = Math.ceil(SEGUNDOS_PARA_DESHACER - transcurridos)
    return {
      operacionId: this.oferta.operacionId,
      segundosRestantes: Math.min(SEGUNDOS_PARA_DESHACER, restantes),
    }
  }

  /**
   * Anula la operación ofrecida sin pedir motivo (RN-OP-18). La ventana de 10 s decide lo que
   * se MUESTRA (`disponible`); un toque hecho mientras se mostraba se respeta si llega con
   * hasta 2 s de retraso. Más tarde se rechaza: la operación se anula desde el Historial.
   *
   * Con `operacionEsperada` (plan 12: el Deshacer de una respuesta del conteo guiado) solo se
   * deshace si esa sigue siendo la operación ofrecida; si ya se ofreció otra, se rechaza igual
   * que un toque tardío y no se anula nada.
   */
  async deshacer(operacionEsperada?: string): Promise<void> {
    const oferta = this.oferta
    const vencido = new ErrorDeDominio(
      'DESHACER_VENCIDO',
      'Ya pasó el tiempo para deshacer. Puedes anularla desde el Historial.',
    )
    if (!oferta) {
      if (operacionEsperada !== undefined) throw vencido
      throw new Error('No hay nada que deshacer')
    }
    if (operacionEsperada !== undefined && oferta.operacionId !== operacionEsperada) throw vencido
    this.oferta = null
    const transcurridos = segundosEntre(oferta.registradaEn, this.reloj.ahora())
    if (transcurridos >= SEGUNDOS_PARA_DESHACER + SEGUNDOS_DE_MARGEN_PARA_DESHACER) throw vencido
    await this.anular(oferta.operacionId)
  }
}

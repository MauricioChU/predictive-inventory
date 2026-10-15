import { segundosEntre, type Instante } from '@/shared/domain/fecha'
import type { Reloj } from '@/shared/domain/reloj'

/** RN-OP-18: "Deshacer" se ofrece durante 10 segundos. */
export const SEGUNDOS_PARA_DESHACER = 10

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
   * se MUESTRA (`disponible`); un toque hecho mientras se mostraba se respeta aunque llegue
   * unos milisegundos después: deshacer es anular, y anular siempre está permitido (RN-OP-17).
   */
  async deshacer(): Promise<void> {
    const oferta = this.oferta
    if (!oferta) throw new Error('No hay nada que deshacer')
    this.oferta = null
    await this.anular(oferta.operacionId)
  }
}

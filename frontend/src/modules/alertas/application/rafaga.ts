/** RN-SIS-09: cuánto se espera para juntar en una sola las re-evaluaciones pedidas en ráfaga. */
export const VENTANA_DE_REEVALUACION_MS = 300

/** La espera nunca pasa de tantas ventanas desde el primer pedido (eventos que no paran). */
const VENTANAS_COMO_MAXIMO = 4

/**
 * RN-SIS-09: junta en UNA sola tarea los pedidos que llegan seguidos. Cada pedido vuelve a
 * empezar la ventana (así una ráfaga de ventas no compite con su propia re-evaluación), pero la
 * tarea corre a más tardar `VENTANAS_COMO_MAXIMO` ventanas después del primer pedido pendiente:
 * ningún pedido queda esperando para siempre. `adelantar` la corre ya (para esperarla en las
 * pruebas) y `cancelar` la descarta.
 */
export class TareaEnRafaga {
  private temporizador: ReturnType<typeof setTimeout> | null = null
  private primerPedido = 0

  constructor(
    private readonly ventanaMs: number,
    private readonly tarea: () => void,
  ) {}

  pendiente(): boolean {
    return this.temporizador !== null
  }

  pedir(): void {
    const ahora = Date.now()
    if (this.temporizador === null) this.primerPedido = ahora
    else clearTimeout(this.temporizador)
    const limite = this.primerPedido + VENTANAS_COMO_MAXIMO * this.ventanaMs
    this.temporizador = setTimeout(() => this.adelantar(), Math.min(this.ventanaMs, limite - ahora))
  }

  adelantar(): void {
    if (!this.cancelar()) return
    this.tarea()
  }

  /** Devuelve si había una pendiente. */
  cancelar(): boolean {
    if (this.temporizador === null) return false
    clearTimeout(this.temporizador)
    this.temporizador = null
    return true
  }
}

import type { UnidadDeTrabajo } from '../../application/unidad-de-trabajo'
import type { AlmacenEnMemoria } from './almacen-en-memoria'

/**
 * Fix round 1, M4: `profundidad` solo cuenta mientras un trabajo de la cola está
 * efectivamente corriendo, así que una llamada a `ejecutar()` hecha DESDE DENTRO de ese
 * trabajo (anidada, misma pila de llamadas) se detecta de forma síncrona y se une a la
 * transacción en curso. Dos llamadas de NIVEL SUPERIOR disparadas sin esperar una a la otra
 * no comparten transacción: la segunda espera su turno en `colaDeEjecucion` antes de tomar
 * su propia foto del almacén, así que el rollback de la primera no toca lo que la segunda
 * ya guardó.
 *
 * Límite conocido (sin AsyncLocalStorage): la detección de "anidada" es solo "¿hay un
 * trabajo de la cola corriendo ahora mismo?". Si un ejecutar() de verdad independiente
 * llega mientras otro trabajo de la cola está en curso (p. ej. disparado por un timer que
 * no pasó por la cola), se trataría por error como anidado. En la práctica, toda llamada a
 * ejecutar() pasa por esta clase y por lo tanto por la cola, así que esto solo importaría
 * si algo guardara una referencia a `trabajo` y la invocara por su cuenta más tarde.
 */
export class UnidadDeTrabajoEnMemoria implements UnidadDeTrabajo {
  private profundidad = 0
  private colaDeEjecucion: Promise<unknown> = Promise.resolve()

  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.profundidad > 0) return trabajo()

    // No es anidada: reserva su turno en la cola antes de tocar el almacén. `.catch` evita
    // que el fallo de un turno anterior impida que este turno se ejecute.
    const miTurno = this.colaDeEjecucion
      .catch(() => undefined)
      .then(() => this.comoTransaccion(trabajo))
    this.colaDeEjecucion = miTurno
    return miTurno
  }

  private async comoTransaccion<T>(trabajo: () => Promise<T>): Promise<T> {
    const antes = this.almacen.instantanea()
    this.profundidad++
    try {
      return await trabajo()
    } catch (error) {
      this.almacen.restaurar(antes)
      throw error
    } finally {
      this.profundidad--
    }
  }
}

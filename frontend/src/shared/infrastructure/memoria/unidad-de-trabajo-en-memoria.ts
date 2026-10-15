import { AsyncLocalStorage } from 'node:async_hooks'
import type { UnidadDeTrabajo } from '../../application/unidad-de-trabajo'
import type { AlmacenEnMemoria } from './almacen-en-memoria'

/**
 * SOLO PARA PRUEBAS: `eslint-rules/fronteras.ts` prohíbe importar este archivo fuera de
 * `*.spec.ts` o `tests/**`, porque usa `node:async_hooks` (no existe en el navegador). La
 * app real usa las transacciones de Dexie; esta clase es para la composición de pruebas en
 * memoria (`AlmacenEnMemoria` sí es segura para el navegador).
 *
 * Fix round 2, M4 (sustituye el contador de profundidad de la Fix round 1): un contador que
 * se incrementa de forma síncrona antes del primer `await` del trabajo en curso no puede
 * distinguir "esta llamada es parte del mismo trabajo" de "esta llamada llegó mientras tanto,
 * pero es independiente" — ambas ven `profundidad > 0` por igual. Eso hacía que un
 * `ejecutar()` de verdad independiente que llegara DESPUÉS de que el trabajo en curso ya
 * pasara su primer `await` (p. ej. el manejador de un evento publicado TRAS confirmar la
 * transacción original — ADR-0002 —, o una operación de usuario disparada mientras otra
 * sigue en curso) se tratara por error como anidado y terminara compartiendo la transacción
 * en curso: si esa transacción fallaba, su rollback borraba en silencio una escritura YA
 * CONFIRMADA de la llamada independiente.
 *
 * `AsyncLocalStorage` resuelve esto correctamente: el contexto se propaga automáticamente a
 * través de cualquier `await` dentro del trabajo en curso (y de sus continuaciones), así que
 * "¿estoy dentro del trabajo que ESTA instancia está corriendo ahora?" ya no depende de
 * CUÁNDO llega la llamada, sino de si de verdad desciende de él. Cualquier otra llamada se
 * encola como una transacción independiente, serializada con `colaDeEjecucion`.
 *
 * Cautela (no resuelta, es un trade-off consciente): un trabajo en curso NO debe hacer
 * `await` a un `ejecutar()` de nivel superior (no anidado) de esta MISMA instancia — se
 * bloquearía para siempre, porque ese `ejecutar()` independiente espera su turno en la cola
 * y la cola nunca avanza mientras el trabajo que lo está esperando no termine.
 *
 * Fix round 3, minor 1: el CONTEXTO de AsyncLocalStorage sobrevive a la transacción que lo
 * creó. Si un trabajo arranca algo "fire-and-forget" sin esperarlo (p. ej. `setTimeout` o un
 * `bus.publicar()` no esperado) y ESE callback, ya con la transacción terminada, llama a
 * `ejecutar()`, Node sigue propagando el mismo contexto de ALS a ese callback (así funciona
 * AsyncLocalStorage: sigue la cadena causal de continuaciones, no el tiempo de vida de
 * `run()`). Con un simple `true` en el store no hay forma de distinguir "la transacción que
 * me originó sigue viva" de "ya terminó, pero mi continuación todavía carga su contexto": esa
 * llamada tardía se trataba por error como anidada, se saltaba la cola Y su propia foto del
 * almacén, y quedaba escribiendo sin protección — si DESPUÉS otra transacción independiente
 * (que ya estaba en curso) fallaba, su rollback restauraba una foto tomada ANTES de esa
 * escritura tardía y se la llevaba por delante en silencio.
 *
 * Por eso el store ya no es `true`, sino un TOKEN por transacción (`{ activa: true }`) que
 * `comoTransaccion` marca `activa = false` en su `finally`, apenas la transacción termina
 * (éxito o fallo). `ejecutar()` solo trata una llamada como anidada si el token del store
 * sigue `activa` — si la transacción que lo creó ya cerró, por más que el contexto de ALS
 * siga "vivo" para esa continuación tardía, se encola como lo que de verdad es: independiente.
 */
interface TokenDeTransaccion {
  activa: boolean
}

export class UnidadDeTrabajoEnMemoria implements UnidadDeTrabajo {
  private readonly contexto = new AsyncLocalStorage<TokenDeTransaccion>()
  private colaDeEjecucion: Promise<unknown> = Promise.resolve()

  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.contexto.getStore()?.activa) return trabajo()

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
    const token: TokenDeTransaccion = { activa: true }
    try {
      return await this.contexto.run(token, trabajo)
    } catch (error) {
      this.almacen.restaurar(antes)
      throw error
    } finally {
      token.activa = false
    }
  }
}

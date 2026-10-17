import { AsyncLocalStorage } from 'node:async_hooks'
import {
  errorDeEscrituraEnLectura,
  type UnidadDeTrabajo,
} from '../../application/unidad-de-trabajo'
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
  /** RN-SIS-09: un `leer` de nivel superior; ahí no se escribe ni se registran acciones. */
  readonly soloLectura: boolean
  /** Ola 3, ruling 1: lo que corre tras el commit; las llamadas anidadas también agregan aquí. */
  readonly alConfirmar: AccionAlConfirmar[]
}

type AccionAlConfirmar = () => void | Promise<void>

/** Una acción que falla no debe afectar a las demás ni a quien ya confirmó (ADR-0002). */
async function correrSinPropagar(accion: AccionAlConfirmar): Promise<void> {
  try {
    await accion()
  } catch (error) {
    console.error('Falló una acción posterior a confirmar la unidad de trabajo:', error)
  }
}

/**
 * `alConfirmar` cumple el contrato documentado en `UnidadDeTrabajo`. Cómo lo hace aquí: la acción
 * se guarda en el token de la transacción MÁS EXTERNA (las anidadas comparten su token); si hay
 * rollback, el token se descarta con sus acciones. Una continuación tardía cuyo token ya cerró
 * la corre enseguida. Tras el commit, las acciones corren FUERA de la cola de transacciones
 * (`colaDeEjecucion` ya avanzó) y con el token inactivo, así que un `ejecutar()` dentro de una
 * acción espera su turno como transacción independiente: nunca se une ni se bloquea.
 *
 * `leer` (RN-SIS-09) también toma su turno en la cola (así nunca ve a medias una escritura en
 * curso ni la ve aparecer mientras lee) pero sin foto ni rollback: no hay nada que revertir.
 * Su token es de solo lectura: ahí `ejecutar` rechaza y `alConfirmar` lanza. Dentro de un
 * `ejecutar` o de otro `leer` activos, se une a ellos (con su token).
 *
 * Diferencia con Dexie (aceptada; manda la de Dexie): esta clase no ve los repositorios, así que
 * una escritura DIRECTA a un repositorio en memoria dentro de un `leer` (sin `ejecutar`) no
 * falla aquí, mientras que IndexedDB la rechaza (ReadOnlyError). El contrato de `leer` lo fijan
 * las suites de contrato que corren también sobre Dexie (shared/infrastructure/__pruebas__) y
 * las pruebas de integración con las dos persistencias.
 */
export class UnidadDeTrabajoEnMemoria implements UnidadDeTrabajo {
  private readonly contexto = new AsyncLocalStorage<TokenDeTransaccion>()
  private colaDeEjecucion: Promise<unknown> = Promise.resolve()
  /** Acciones que nadie espera: las de fuera de una transacción (igual que en la de Dexie). */
  private readonly accionesSueltas = new Set<Promise<void>>()

  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    const token = this.contexto.getStore()
    if (token?.activa) {
      if (token.soloLectura) throw errorDeEscrituraEnLectura()
      return trabajo()
    }

    // No es anidada: reserva su turno en la cola antes de tocar el almacén.
    const { resultado, acciones } = await this.enSuTurno(() => this.comoTransaccion(trabajo))
    for (const accion of acciones) await correrSinPropagar(accion)
    return resultado
  }

  async leer<T>(consulta: () => Promise<T>): Promise<T> {
    if (this.contexto.getStore()?.activa) return consulta()
    return this.enSuTurno(() => this.comoLectura(consulta))
  }

  alConfirmar(accion: AccionAlConfirmar): void {
    const token = this.contexto.getStore()
    if (token?.activa) {
      if (token.soloLectura) throw errorDeEscrituraEnLectura()
      token.alConfirmar.push(accion)
      return
    }
    const enCurso = correrSinPropagar(accion)
    this.accionesSueltas.add(enCurso)
    void enCurso.finally(() => this.accionesSueltas.delete(enCurso))
  }

  /**
   * Para pruebas y la composición (`esperarTareasPendientes`): espera las acciones sueltas, en
   * bucle hasta que no quede ninguna (una acción puede registrar otra), como la de Dexie.
   */
  async esperarAcciones(): Promise<void> {
    while (this.accionesSueltas.size > 0) await Promise.all(this.accionesSueltas)
  }

  /** Encola `turno` detrás del anterior; `.catch`: el fallo de uno no impide los siguientes. */
  private enSuTurno<T>(turno: () => Promise<T>): Promise<T> {
    const miTurno = this.colaDeEjecucion.catch(() => undefined).then(turno)
    this.colaDeEjecucion = miTurno
    return miTurno
  }

  private async comoLectura<T>(consulta: () => Promise<T>): Promise<T> {
    const token: TokenDeTransaccion = { activa: true, soloLectura: true, alConfirmar: [] }
    try {
      return await this.contexto.run(token, consulta)
    } finally {
      token.activa = false
    }
  }

  private async comoTransaccion<T>(
    trabajo: () => Promise<T>,
  ): Promise<{ resultado: T; acciones: AccionAlConfirmar[] }> {
    const antes = this.almacen.instantanea()
    const token: TokenDeTransaccion = { activa: true, soloLectura: false, alConfirmar: [] }
    try {
      const resultado = await this.contexto.run(token, trabajo)
      return { resultado, acciones: token.alConfirmar }
    } catch (error) {
      this.almacen.restaurar(antes)
      throw error
    } finally {
      token.activa = false
    }
  }
}

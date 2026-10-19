import type {
  AnalisisConsultable,
  SituacionDeProducto,
  TiendaConsultable,
} from '@/shared/contratos/entre-modulos'
import type { BusDeEventos, TipoDeEvento } from '@/shared/domain/eventos'
import type { Reloj } from '@/shared/domain/reloj'
import type { RecordatorioDelLocal } from '../domain/recordatorio-del-local'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import { evaluarAvisos } from './evaluar-avisos'
import { notificacionesPermitidas } from './permiso'
import type { Notificacion, Notificador, RepositorioDeAvisos } from './puertos'
import { TareaEnRafaga, VENTANA_DE_REEVALUACION_MS } from './rafaga'
import { recordatorioVigenteDelLocal } from './recordatorio-del-local'
import { resumenDeAtencion, resumenDeSituaciones, type ResumenDeAtencion } from './resumen'

export type { RecordatorioDelLocal, ResumenDeAtencion }
export { VENTANA_DE_REEVALUACION_MS }

/** Dependencias perezosas: los otros módulos se reciben como funciones para permitir
 * referencias cruzadas en la composición (Ola 3). */
export interface DependenciasDeAlertas {
  avisos: RepositorioDeAvisos
  notificador: Notificador
  uow: UnidadDeTrabajo
  reloj: Reloj
  bus: BusDeEventos
  analisis: () => Pick<AnalisisConsultable, 'situaciones'>
  tienda: () => TiendaConsultable
  /**
   * RN-SIS-09: ventana para juntar en una sola las re-evaluaciones que piden los eventos en
   * ráfaga. Por defecto, `VENTANA_DE_REEVALUACION_MS`.
   */
  ventanaDeReevaluacionMs?: number
}

/** RN-AL-02: eventos que pueden cambiar el estado de stock de algún producto. */
const EVENTOS_QUE_RE_EVALUAN: readonly TipoDeEvento[] = [
  'OperacionRegistrada',
  'OperacionAnulada',
  'ProductoCreado',
  'ProductoActualizado',
  'ProductoArchivado',
  'ProductoReactivado',
  'ConfiguracionActualizada',
]

export interface ModuloAlertas {
  /**
   * Evalúa enseguida (abrir la app, cambios en bloque): no espera la ventana y cubre la
   * re-evaluación que esté programada. Devuelve lo que de verdad se notificó (vacío si no hay
   * permiso o nada que avisar).
   */
  evaluarAvisos(): Promise<Notificacion[]>
  resumenDeAtencion(): Promise<ResumenDeAtencion>
  /** RN-AL-10: `null` si no hay pago del local hoy, mañana ni pasado mañana. */
  recordatorioDelLocal(): Promise<RecordatorioDelLocal | null>
  /** RN-AL-08: solo se llama desde la pantalla que explica para qué sirven las notificaciones. */
  solicitarPermiso(): Promise<boolean>
  /** Permiso del navegador Y configuración de la tienda, ambos a la vez. */
  notificacionesPermitidas(): Promise<boolean>
  /**
   * Suscribe la re-evaluación a los eventos del bus (RN-AL-02). Los eventos seguidos se juntan
   * en UNA evaluación (RN-SIS-09): cada uno la programa para dentro de la ventana y la vuelve a
   * empezar (hasta 4 ventanas desde el primero). Devuelve la función para cancelar (también
   * descarta la evaluación programada).
   */
  escucharEventos(): () => void
  /**
   * RN-AL-06 / RN-SIS-09: `manejador` recibe el resumen de atención de cada evaluación, sacado
   * de la MISMA lectura de situaciones que los avisos (el contador del botón Control no la
   * vuelve a hacer). Llega en orden, después de confirmar si la evaluación corre dentro de una
   * unidad de trabajo; debe ser "dispara y olvida" (un error se registra). Devuelve la función
   * para cancelar.
   */
  alCalcularLaAtencion(manejador: (resumen: ResumenDeAtencion) => void): () => void
  /**
   * Adelanta la evaluación programada (no espera la ventana), espera a que termine la última
   * encolada (incluida la que esté en curso) y, si mientras tanto se pidieron otras (eventos
   * encadenados), también a esas (Ola 3, ruling 4).
   */
  esperarEvaluacionesPendientes(): Promise<void>
}

export function crearModuloAlertas(d: DependenciasDeAlertas): ModuloAlertas {
  // Cola serializada: cada evaluación empieza (y lee situaciones()) solo cuando terminó la
  // anterior, así un snapshot viejo nunca se guarda después de uno nuevo. `cola` nunca rechaza.
  let cola: Promise<void> = Promise.resolve()
  const programada = new TareaEnRafaga(
    d.ventanaDeReevaluacionMs ?? VENTANA_DE_REEVALUACION_MS,
    () => {
      // RN-AL-11: la evaluación que piden los eventos no avisa del pago del local.
      void encolarEvaluacion({ pagoDelLocal: false })
    },
  )
  const manejadoresDeAtencion = new Set<(resumen: ResumenDeAtencion) => void>()

  function compartirAtencion(situaciones: readonly SituacionDeProducto[]): void {
    if (manejadoresDeAtencion.size === 0) return
    const resumen = resumenDeSituaciones(situaciones)
    // Una copia: lo que un manejador agregue o cancele aquí no cambia esta entrega.
    const manejadores = Array.from(manejadoresDeAtencion)
    d.uow.alConfirmar(() => {
      for (const manejador of manejadores) {
        try {
          manejador(resumen)
        } catch (error) {
          console.error('Falló un manejador del resumen de atención:', error)
        }
      }
    })
  }

  /** Ola 3, ruling 4: en bucle hasta que no quede nada programado ni la cola cambie. */
  async function esperarEvaluacionesPendientes(): Promise<void> {
    let ultima: Promise<void>
    do {
      programada.adelantar()
      ultima = cola
      await ultima
    } while (ultima !== cola || programada.pendiente())
  }

  function encolarEvaluacion(opciones?: { pagoDelLocal?: boolean }): Promise<Notificacion[]> {
    // Esta evaluación lee después de todo lo que pidió la programada: la cubre.
    programada.cancelar()
    const turno = cola.then(() => evaluarAvisos(d, compartirAtencion, opciones))
    cola = turno.then(
      (): void => undefined,
      (error: unknown): void => {
        console.error('Falló la evaluación de avisos:', error)
      },
    )
    return turno
  }

  return {
    evaluarAvisos: () => encolarEvaluacion(),
    resumenDeAtencion: () => resumenDeAtencion(d),
    recordatorioDelLocal: () => recordatorioVigenteDelLocal(d),
    solicitarPermiso: () => d.notificador.solicitarPermiso(),
    notificacionesPermitidas: () => notificacionesPermitidas(d),
    escucharEventos: () => {
      const cancelaciones = EVENTOS_QUE_RE_EVALUAN.map((tipo) =>
        // Solo programa y vuelve: quien publicó la operación no espera a los avisos.
        d.bus.suscribir(tipo, (): void => {
          programada.pedir()
        }),
      )
      return () => {
        for (const cancelar of cancelaciones) cancelar()
        programada.cancelar()
      }
    },
    alCalcularLaAtencion(manejador) {
      manejadoresDeAtencion.add(manejador)
      return () => {
        manejadoresDeAtencion.delete(manejador)
      }
    },
    esperarEvaluacionesPendientes,
  }
}

import type { AnalisisConsultable, TiendaConsultable } from '@/shared/contratos/entre-modulos'
import type { BusDeEventos, TipoDeEvento } from '@/shared/domain/eventos'
import type { Reloj } from '@/shared/domain/reloj'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import { evaluarAvisos } from './evaluar-avisos'
import type { Notificacion, Notificador, RepositorioDeAvisos } from './puertos'
import {
  cerrarResumenDelDia,
  resumenDeAtencion,
  resumenDelDia,
  type ResumenDeAtencion,
  type ResumenDelDia,
} from './resumen'

export type { ResumenDeAtencion, ResumenDelDia }

/** Dependencias perezosas: los otros módulos se reciben como funciones para permitir
 * referencias cruzadas en la composición (Ola 3). */
export interface DependenciasDeAlertas {
  avisos: RepositorioDeAvisos
  notificador: Notificador
  uow: UnidadDeTrabajo
  reloj: Reloj
  bus: BusDeEventos
  analisis: () => Pick<AnalisisConsultable, 'situaciones' | 'totalesDelDia'>
  tienda: () => TiendaConsultable
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
  /** Devuelve lo que de verdad se notificó (vacío si no hay permiso o nada que avisar). */
  evaluarAvisos(): Promise<Notificacion[]>
  resumenDeAtencion(): Promise<ResumenDeAtencion>
  /** `null` si el resumen del día ya se mostró hoy. */
  resumenDelDia(): Promise<ResumenDelDia | null>
  cerrarResumenDelDia(): Promise<void>
  /** RN-AL-08: solo se llama desde la pantalla que explica para qué sirven las notificaciones. */
  solicitarPermiso(): Promise<boolean>
  /** Permiso del navegador Y configuración de la tienda, ambos a la vez. */
  notificacionesPermitidas(): Promise<boolean>
  /** Suscribe evaluarAvisos a los eventos del bus (RN-AL-02). Devuelve la función para cancelar. */
  escucharEventos(): () => void
}

export function crearModuloAlertas(d: DependenciasDeAlertas): ModuloAlertas {
  return {
    evaluarAvisos: () => evaluarAvisos(d),
    resumenDeAtencion: () => resumenDeAtencion(d),
    resumenDelDia: () => resumenDelDia(d),
    cerrarResumenDelDia: () => cerrarResumenDelDia(d),
    solicitarPermiso: () => d.notificador.solicitarPermiso(),
    notificacionesPermitidas: async () => {
      const configuracion = await d.tienda().configuracion()
      return configuracion.notificacionesActivas && (await d.notificador.permitido())
    },
    escucharEventos: () => {
      const cancelaciones = EVENTOS_QUE_RE_EVALUAN.map((tipo) =>
        d.bus.suscribir(tipo, async (): Promise<void> => {
          await evaluarAvisos(d)
        }),
      )
      return () => {
        for (const cancelar of cancelaciones) cancelar()
      }
    },
  }
}

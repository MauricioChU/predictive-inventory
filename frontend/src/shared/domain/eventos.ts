import type { TipoDeOperacion } from '../contratos/operaciones'

export type EventoDeDominio =
  | { tipo: 'ProductoCreado'; productoId: string }
  | { tipo: 'ProductoActualizado'; productoId: string }
  | { tipo: 'ProductoArchivado'; productoId: string }
  | { tipo: 'ProductoReactivado'; productoId: string }
  | { tipo: 'OperacionRegistrada'; operacionId: string; tipoOperacion: TipoDeOperacion; productoIds: string[] }
  | { tipo: 'OperacionAnulada'; operacionId: string; anulacionId: string; productoIds: string[] }
  | { tipo: 'ConfiguracionActualizada' }

export type TipoDeEvento = EventoDeDominio['tipo']
export type EventoDe<T extends TipoDeEvento> = Extract<EventoDeDominio, { tipo: T }>
export type ManejadorDeEvento<T extends TipoDeEvento> = (evento: EventoDe<T>) => Promise<void> | void

export interface BusDeEventos {
  publicar(evento: EventoDeDominio): Promise<void>
  suscribir<T extends TipoDeEvento>(tipo: T, manejador: ManejadorDeEvento<T>): () => void
}

/** Bus síncrono en el mismo proceso. Se publica DESPUÉS de confirmar la unidad de trabajo. */
export class BusEnMemoria implements BusDeEventos {
  private readonly manejadores = new Map<TipoDeEvento, Set<(e: EventoDeDominio) => Promise<void> | void>>()

  async publicar(evento: EventoDeDominio): Promise<void> {
    for (const manejador of this.manejadores.get(evento.tipo) ?? []) {
      await manejador(evento)
    }
  }

  suscribir<T extends TipoDeEvento>(tipo: T, manejador: ManejadorDeEvento<T>): () => void {
    const lista = this.manejadores.get(tipo) ?? new Set()
    const envoltura = (e: EventoDeDominio) => manejador(e as EventoDe<T>)
    lista.add(envoltura)
    this.manejadores.set(tipo, lista)
    return () => lista.delete(envoltura)
  }
}

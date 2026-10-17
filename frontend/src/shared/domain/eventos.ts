import type { TipoDeOperacion } from '../contratos/operaciones'

export type EventoDeDominio =
  | { tipo: 'ProductoCreado'; productoId: string }
  | { tipo: 'ProductoActualizado'; productoId: string }
  | { tipo: 'ProductoArchivado'; productoId: string }
  | { tipo: 'ProductoReactivado'; productoId: string }
  | {
      tipo: 'OperacionRegistrada'
      operacionId: string
      tipoOperacion: TipoDeOperacion
      productoIds: string[]
    }
  | { tipo: 'OperacionAnulada'; operacionId: string; anulacionId: string; productoIds: string[] }
  | { tipo: 'ConfiguracionActualizada' }

export type TipoDeEvento = EventoDeDominio['tipo']
export type EventoDe<T extends TipoDeEvento> = Extract<EventoDeDominio, { tipo: T }>
export type ManejadorDeEvento<T extends TipoDeEvento> = (
  evento: EventoDe<T>,
) => Promise<void> | void

export interface BusDeEventos {
  publicar(evento: EventoDeDominio): Promise<void>
  suscribir<T extends TipoDeEvento>(tipo: T, manejador: ManejadorDeEvento<T>): () => void
}

export type ManejadorDeFalla = (error: unknown, evento: EventoDeDominio) => void

const alFallarPorDefecto: ManejadorDeFalla = (error, evento) => {
  console.error(`Error en un manejador de "${evento.tipo}":`, error)
}

/**
 * Bus síncrono en el mismo proceso. Se publica DESPUÉS de confirmar la unidad de trabajo,
 * así que `publicar` nunca rechaza por culpa de un manejador: un manejador que falla no
 * debe hacer que la UI reporte como fallida una operación que ya se guardó (ADR-0002).
 * Cada fallo se entrega a `alFallar` (por defecto, un `console.error`).
 */
export class BusEnMemoria implements BusDeEventos {
  private readonly manejadores = new Map<
    TipoDeEvento,
    Set<(e: EventoDeDominio) => Promise<void> | void>
  >()

  constructor(private readonly alFallar: ManejadorDeFalla = alFallarPorDefecto) {}

  async publicar(evento: EventoDeDominio): Promise<void> {
    // Copia los suscriptores ANTES de recorrerlos: lo que un manejador suscriba, cancele o
    // vuelva a suscribir durante esta publicación no afecta a la entrega en curso.
    const suscriptores = [...(this.manejadores.get(evento.tipo) ?? [])]
    for (const manejador of suscriptores) {
      try {
        await manejador(evento)
      } catch (error) {
        // Fix round 2, minor: si el propio alFallar lanza, no debe detener a los
        // manejadores restantes ni hacer que publicar() rechace (mismo principio que el
        // manejador original: un fallo aquí no puede tirar abajo una operación ya confirmada).
        try {
          this.alFallar(error, evento)
        } catch (errorDeAlFallar) {
          console.error('El manejador de fallas (alFallar) también falló:', errorDeAlFallar)
        }
      }
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

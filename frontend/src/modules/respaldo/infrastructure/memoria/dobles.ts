import type { HojaDeExcel } from '../../domain/hojas-de-excel'
import type {
  AlmacenamientoPersistente,
  GeneradorDeExcel,
  LectorDeExcel,
} from '../../application/puertos'

/** Guarda las hojas que recibió (para que el test las pueda inspeccionar) y devuelve un
 * Blob vacío: no genera un .xlsx real. */
export class GeneradorDeExcelEnMemoria implements GeneradorDeExcel {
  hojasGeneradas: readonly HojaDeExcel[] = []

  async generar(hojas: readonly HojaDeExcel[]): Promise<Blob> {
    this.hojasGeneradas = hojas
    return new Blob()
  }
}

/** Devuelve siempre las filas que el test fijó con fijarFilas(); ignora el archivo. */
export class LectorDeExcelEnMemoria implements LectorDeExcel {
  private filas: string[][] = []

  fijarFilas(filas: string[][]): void {
    this.filas = filas
  }

  async leerPrimeraHoja(_archivo: Blob): Promise<string[][]> {
    return this.filas
  }
}

/** Doble del pedido de almacenamiento persistente (RN-RE-09): responde lo fijado y cuenta
 * cuántas veces se pidió (`solicitudes`), como `NotificadorEnMemoria` con el permiso. */
export class AlmacenamientoPersistenteEnMemoria implements AlmacenamientoPersistente {
  private concedido = true
  solicitudes = 0

  fijarResultado(concedido: boolean): void {
    this.concedido = concedido
  }

  async solicitar(): Promise<boolean> {
    this.solicitudes += 1
    return this.concedido
  }
}

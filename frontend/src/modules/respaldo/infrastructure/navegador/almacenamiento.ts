import type { AlmacenamientoPersistente } from '../../application/puertos'

/** RN-RE-09: pide al navegador que no borre los datos al liberar espacio. */
export class AlmacenamientoPersistenteDelNavegador implements AlmacenamientoPersistente {
  async solicitar(): Promise<boolean> {
    try {
      return (await navigator.storage?.persist?.()) ?? false
    } catch {
      return false
    }
  }
}

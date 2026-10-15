import type { ProyeccionDeOperaciones } from '@/shared/contratos/entre-modulos'
import type { OperacionRegistro } from '@/shared/contratos/registros'

/** Proyección que anota lo que recibe y puede fallar a pedido (RN-OP-06). */
export class ProyeccionEspia implements ProyeccionDeOperaciones {
  readonly registradas: OperacionRegistro[] = []
  readonly anuladas: { original: OperacionRegistro; anulacion: OperacionRegistro }[] = []
  readonly reconstrucciones: OperacionRegistro[][] = []
  fallarAlRegistrar = false

  async alRegistrar(operacion: OperacionRegistro): Promise<void> {
    if (this.fallarAlRegistrar) throw new Error('La proyección falló')
    this.registradas.push(operacion)
  }

  async alAnular(original: OperacionRegistro, anulacion: OperacionRegistro): Promise<void> {
    this.anuladas.push({ original, anulacion })
  }

  async reconstruir(operaciones: readonly OperacionRegistro[]): Promise<void> {
    this.reconstrucciones.push([...operaciones])
  }
}

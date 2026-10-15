import type { UnidadDeTrabajo } from '../../application/unidad-de-trabajo'
import type { AlmacenEnMemoria } from './almacen-en-memoria'

export class UnidadDeTrabajoEnMemoria implements UnidadDeTrabajo {
  private profundidad = 0

  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.profundidad > 0) return trabajo()
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

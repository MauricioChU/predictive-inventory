import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import type { ProyeccionDeOperaciones } from '@/shared/contratos/entre-modulos'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import {
  aportesDeAnulacion,
  aportesDeOperacion,
  proyectarLibro,
  ResumenDiario,
} from '../domain/resumen-diario'
import type { RepositorioDeResumenes } from './puertos'

/**
 * Mantiene la proyección `ResumenDiario` en la MISMA unidad de trabajo que la operación
 * (ADR-0002): Inventario la llama dentro de su `ejecutar`, y aquí `ejecutar` se une a esa
 * transacción. Llamada sola, cada método es atómico por sí mismo.
 */
export class ProyeccionDeResumenes implements ProyeccionDeOperaciones {
  constructor(
    private readonly resumenes: RepositorioDeResumenes,
    private readonly uow: UnidadDeTrabajo,
  ) {}

  alRegistrar(operacion: OperacionRegistro): Promise<void> {
    return this.uow.ejecutar(() => this.acumular(aportesDeOperacion(operacion)))
  }

  alAnular(original: OperacionRegistro, anulacion: OperacionRegistro): Promise<void> {
    return this.uow.ejecutar(() => this.acumular(aportesDeAnulacion(original, anulacion)))
  }

  /** Escritura masiva (RN-SIS-09): con miles de operaciones, una fila a la vez sería lento. */
  reconstruir(operaciones: readonly OperacionRegistro[]): Promise<void> {
    return this.uow.ejecutar(async () => {
      const filas = proyectarLibro(operaciones).map((fila) => fila.aRegistro())
      await this.resumenes.vaciar()
      await this.resumenes.guardarVarios(filas)
    })
  }

  private async acumular(aportes: readonly ResumenDiario[]): Promise<void> {
    for (const aporte of aportes) {
      const actual = await this.resumenes.obtener(aporte.productoId, aporte.dia)
      const fila = actual ? ResumenDiario.desdeRegistro(actual).sumar(aporte) : aporte
      await this.resumenes.guardar(fila.aRegistro())
    }
  }
}

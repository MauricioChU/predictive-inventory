import type { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import type { Instante } from '@/shared/domain/fecha'
import type { ConteoGuiadoRegistro } from '@/shared/contratos/registros'
import { progresoDelConteo, resumenDelConteo } from './mensajes'
import { compararNormalizados } from './orden'

export interface ProductoParaConteo {
  id: string
  nombre: string
  categoriaNombre: string
}

/** RN-OP-21: agrupados por categoría y ordenados por nombre (comparación normalizada). */
export function ordenarParaConteo(productos: readonly ProductoParaConteo[]): string[] {
  return [...productos]
    .sort(
      (a, b) =>
        compararNormalizados(a.categoriaNombre, b.categoriaNombre) ||
        compararNormalizados(a.nombre, b.nombre),
    )
    .map((p) => p.id)
}

/**
 * Conteo guiado de toda la tienda (RN-OP-21), uno por pantalla. Inmutable: cada paso
 * devuelve un conteo nuevo para guardarlo al momento, así no se pierde nada si se interrumpe.
 */
export class ConteoGuiado {
  private constructor(private readonly registro: ConteoGuiadoRegistro) {}

  static iniciar(orden: readonly string[], ahora: Instante): ConteoGuiado {
    return new ConteoGuiado({
      id: 'actual',
      iniciadoEn: ahora,
      orden: [...orden],
      posicion: 0,
      contados: [],
      saltados: [],
      terminadoEn: orden.length === 0 ? ahora : null,
    })
  }

  static desdeRegistro(registro: ConteoGuiadoRegistro): ConteoGuiado {
    return new ConteoGuiado(structuredClone(registro))
  }

  aRegistro(): ConteoGuiadoRegistro {
    return structuredClone(this.registro)
  }

  get terminado(): boolean {
    return this.registro.terminadoEn !== null
  }

  /** El producto que toca contar, o null si el conteo terminó. */
  get productoActual(): string | null {
    if (this.terminado) return null
    return this.registro.orden[this.registro.posicion] ?? null
  }

  /** "Llevas 1 de 3": cuántos ya pasaron (contados, saltados u omitidos) de cuántos. */
  progreso(): string {
    const { hechos, total } = this.avance()
    return progresoDelConteo(hechos, total)
  }

  /** Lo mismo que `progreso()` en números, para la barra de progreso de la pantalla. */
  avance(): { hechos: number; total: number } {
    return { hechos: this.registro.posicion, total: this.registro.orden.length }
  }

  /** Registra lo contado del producto actual: diferencia (con signo) y su valor al costo. */
  contar(diferencia: Cantidad, valor: Dinero, ahora: Instante): ConteoGuiado {
    const productoId = this.exigirActual()
    return this.avanzar(ahora, {
      contados: [
        ...this.registro.contados,
        { productoId, diferencia: diferencia.milesimas, valor: valor.centimos },
      ],
    })
  }

  /** "Saltar": queda en "Te faltó contar". */
  saltar(ahora: Instante): ConteoGuiado {
    const productoId = this.exigirActual()
    return this.avanzar(ahora, { saltados: [...this.registro.saltados, productoId] })
  }

  /**
   * RN-OP-18 en el conteo guiado: la respuesta de `productoId` se deshizo (su AJUSTE se anuló).
   * Deja de contar en el resumen y pasa a "Te faltó contar", en el orden del recorrido. No
   * mueve el producto actual. Un producto que no estaba contado no cambia nada.
   */
  deshacerRespuesta(productoId: string): ConteoGuiado {
    const { contados, saltados, orden } = this.registro
    if (!contados.some((c) => c.productoId === productoId)) return this
    const posicion = (id: string) => orden.indexOf(id)
    return new ConteoGuiado({
      ...this.registro,
      contados: contados.filter((c) => c.productoId !== productoId),
      saltados: [...saltados, productoId].sort((a, b) => posicion(a) - posicion(b)),
    })
  }

  /** Pasa de largo los productos que ya no se pueden contar (p. ej. archivados durante el conteo). */
  omitirNoContables(esContable: (productoId: string) => boolean, ahora: Instante): ConteoGuiado {
    const productoId = this.productoActual
    if (productoId === null || esContable(productoId)) return this
    return this.avanzar(ahora, {}).omitirNoContables(esContable, ahora)
  }

  /** Solo al terminar: productos contados, con diferencia, valor total y los que faltaron. */
  resumen(nombreDe: (productoId: string) => string): string[] | null {
    if (!this.terminado) return null
    const conDiferencia = this.registro.contados.filter((c) => c.diferencia !== 0)
    return resumenDelConteo({
      contados: this.registro.contados.length,
      conDiferencia: conDiferencia.length,
      valorDeDiferencias: Dinero.sumarTodos(conDiferencia.map((c) => Dinero.deCentimos(c.valor))),
      faltantes: this.registro.saltados.map(nombreDe),
    })
  }

  private exigirActual(): string {
    const productoId = this.productoActual
    if (productoId === null) throw new Error('El conteo guiado ya terminó')
    return productoId
  }

  private avanzar(ahora: Instante, cambios: Partial<ConteoGuiadoRegistro>): ConteoGuiado {
    const posicion = this.registro.posicion + 1
    return new ConteoGuiado({
      ...this.registro,
      ...cambios,
      posicion,
      terminadoEn: posicion >= this.registro.orden.length ? ahora : null,
    })
  }
}

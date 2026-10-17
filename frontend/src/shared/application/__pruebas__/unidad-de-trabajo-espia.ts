import type { UnidadDeTrabajo } from '../unidad-de-trabajo'

/**
 * Envuelve una unidad de trabajo real para probar que una consulta corre ENTERA dentro de una
 * sola lectura (RN-SIS-09): cuenta los `leer` y `ejecutar` de nivel superior (los anidados se
 * unen al que está abierto) y, con `vigilar`, anota cada llamada a un puerto que ocurre fuera
 * de ellos. Para pruebas secuenciales: la profundidad es un contador simple.
 */
export class UnidadDeTrabajoEspia implements UnidadDeTrabajo {
  lecturas = 0
  escrituras = 0
  /** "objeto.método" de cada llamada vigilada que ocurrió fuera de un leer o un ejecutar. */
  readonly llamadasSueltas: string[] = []
  private profundidad = 0

  constructor(private readonly real: UnidadDeTrabajo) {}

  leer<T>(consulta: () => Promise<T>): Promise<T> {
    if (this.profundidad === 0) this.lecturas += 1
    return this.dentro(() => this.real.leer(consulta))
  }

  ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.profundidad === 0) this.escrituras += 1
    return this.dentro(() => this.real.ejecutar(trabajo))
  }

  alConfirmar(accion: () => void | Promise<void>): void {
    this.real.alConfirmar(accion)
  }

  /** Vuelve a contar desde cero (p. ej. después de preparar los datos). */
  reiniciar(): void {
    this.lecturas = 0
    this.escrituras = 0
    this.llamadasSueltas.length = 0
  }

  /** Lo que se cuenta: cuántas transacciones de cada clase abrió la consulta. */
  transacciones(): { lecturas: number; escrituras: number } {
    return { lecturas: this.lecturas, escrituras: this.escrituras }
  }

  /** Un proxy de `objeto` que anota en `llamadasSueltas` cada método llamado fuera. */
  vigilar<T extends object>(nombre: string, objeto: T): T {
    return new Proxy(objeto, {
      get: (destino, propiedad, receptor) => {
        const valor: unknown = Reflect.get(destino, propiedad, receptor)
        if (typeof valor !== 'function') return valor
        return (...argumentos: unknown[]) => {
          if (this.profundidad === 0) this.llamadasSueltas.push(`${nombre}.${String(propiedad)}`)
          return (valor as (...a: unknown[]) => unknown).apply(destino, argumentos)
        }
      },
    })
  }

  private async dentro<T>(transaccion: () => Promise<T>): Promise<T> {
    this.profundidad += 1
    try {
      return await transaccion()
    } finally {
      this.profundidad -= 1
    }
  }
}

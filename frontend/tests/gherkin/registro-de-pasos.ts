import { CucumberExpression, ParameterTypeRegistry } from '@cucumber/cucumber-expressions'

export interface TablaDeDatos {
  /** Filas como objetos usando la primera fila como encabezados. */
  filas: Record<string, string>[]
  /** Todas las celdas, incluida la fila de encabezados. */
  celdas: string[][]
}

export interface ArgumentoExtra {
  tabla?: TablaDeDatos
  texto?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada paso declara sus propios parámetros
export type ManejadorDePaso<M> = (mundo: M, ...args: any[]) => unknown

interface DefinicionDePaso<M> {
  texto: string
  expresion: CucumberExpression
  manejador: ManejadorDePaso<M>
}

export class RegistroDePasos<M> {
  private readonly definiciones: DefinicionDePaso<M>[] = []
  private readonly tipos = new ParameterTypeRegistry()

  paso(texto: string, manejador: ManejadorDePaso<M>): this {
    this.definiciones.push({
      texto,
      expresion: new CucumberExpression(texto, this.tipos),
      manejador,
    })
    return this
  }

  /** Las expresiones registradas, en orden (para comprobar que ningún paso quedó sin usar). */
  get expresiones(): readonly string[] {
    return this.definiciones.map((d) => d.texto)
  }

  buscar(
    texto: string,
  ): { manejador: ManejadorDePaso<M>; argumentos: unknown[]; expresion: string } | null {
    const coincidencias = this.definiciones.flatMap((d) => {
      const argumentos = d.expresion.match(texto)
      return argumentos
        ? [{ definicion: d, argumentos: argumentos.map((a) => a.getValue(null)) }]
        : []
    })
    if (coincidencias.length > 1) {
      throw new Error(
        `Paso ambiguo "${texto}": ${coincidencias.map((c) => c.definicion.texto).join(' | ')}`,
      )
    }
    const [unica] = coincidencias
    return unica
      ? {
          manejador: unica.definicion.manejador,
          argumentos: unica.argumentos,
          expresion: unica.definicion.texto,
        }
      : null
  }

  unir(otro: RegistroDePasos<M>): RegistroDePasos<M> {
    const todos = new RegistroDePasos<M>()
    for (const d of [...this.definiciones, ...otro.definiciones]) todos.paso(d.texto, d.manejador)
    return todos
  }
}

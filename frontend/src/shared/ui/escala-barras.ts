export interface EscalaDeBarra {
  /** Largo de la barra como porcentaje (0–100) de la pista, con 2 decimales. */
  porcentaje: number
  /** true si el valor es mayor que 0: la barra debe verse aunque su porcentaje sea casi 0. */
  visible: boolean
}

/**
 * N2 (ronda 4): una sola escala para todas las barras — cada una es el porcentaje del valor
 * MAYOR, y como todas las filas comparten el mismo ancho de pista (GraficoBarras), el mismo
 * porcentaje es el mismo largo en pantalla. Cero, negativos y valores no finitos no llevan
 * barra; todo valor > 0 sí (el componente le da un mínimo visible de 4 px).
 */
export function escalaComun(valores: readonly number[]): EscalaDeBarra[] {
  const validos = valores.map((valor) => (Number.isFinite(valor) && valor > 0 ? valor : 0))
  const maximo = Math.max(0, ...validos)
  return validos.map((valor) => ({
    porcentaje: maximo > 0 ? Math.round((valor / maximo) * 10_000) / 100 : 0,
    visible: valor > 0,
  }))
}

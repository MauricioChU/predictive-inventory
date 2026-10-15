/** Igual que la columna "resultado" de operaciones.feature: "registrada" o "error: <mensaje>". */
export function resultadoDe(accion: () => unknown): string {
  try {
    accion()
    return 'registrada'
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`
  }
}

export async function resultadoDeAsync(accion: () => Promise<unknown>): Promise<string> {
  try {
    await accion()
    return 'registrada'
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`
  }
}

import type { ArgumentoExtra, RegistroDePasos } from '../../gherkin/registro-de-pasos'
import type { Mundo } from './mundo'

export type Pasos = RegistroDePasos<Mundo>

/**
 * Manejador de un paso: recibe el mundo, los parámetros de la expresión y, al final, el
 * argumento extra (tabla o doc string). `never[]` acepta cualquier firma concreta.
 */
type Manejador = (m: Mundo, ...argumentos: never[]) => unknown

export interface OpcionesDePaso {
  /**
   * El paso mira lo que dejó la acción anterior (un error o una pregunta abierta): "el
   * resultado es …", "se avisa …", "confirmo"… Con una función, solo con esos argumentos (p. ej.
   * "toco 'Registrar igual'"). Cualquier otro paso falla si quedó algo sin revisar.
   */
  revisa?: boolean | ((...argumentos: never[]) => boolean)
}

function revisa(opciones: OpcionesDePaso, argumentos: unknown[]): boolean {
  const { revisa: criterio = false } = opciones
  return typeof criterio === 'function' ? criterio(...(argumentos as never[])) : criterio
}

/**
 * "Dado": prepara el escenario. Construye antes la historia pendiente; un error (también uno
 * de dominio) hace fallar el escenario.
 */
export function preparacion(
  pasos: Pasos,
  texto: string,
  manejador: Manejador,
  opciones: OpcionesDePaso = {},
): void {
  pasos.paso(texto, async (m: Mundo, ...argumentos: unknown[]) => {
    m.exigirRevisado(revisa(opciones, argumentos))
    await m.historia.materializar()
    await manejador(m, ...(argumentos as never[]))
    await m.app.esperarTareasPendientes()
  })
}

/**
 * "Cuando" (y los "Dado" que son la misma acción): lo que hace el usuario. Un ErrorDeDominio
 * queda en `m.resultado` ("error: …") para que lo verifique "el resultado es …"; si el paso
 * siguiente no lo revisa, falla (también un "Dado" que no pudo hacer lo que dice).
 */
export function accion(
  pasos: Pasos,
  texto: string,
  manejador: Manejador,
  opciones: OpcionesDePaso = {},
): void {
  pasos.paso(texto, async (m: Mundo, ...argumentos: unknown[]) => {
    m.exigirRevisado(revisa(opciones, argumentos))
    await m.historia.materializar()
    m.empezarAccion()
    await m.actuar(async () => manejador(m, ...(argumentos as never[])))
    m.terminarAccion()
  })
}

/** "Entonces": verifica, sin cambiar nada, cuando ya terminó todo lo pendiente. */
export function afirmacion(
  pasos: Pasos,
  texto: string,
  manejador: Manejador,
  opciones: OpcionesDePaso = {},
): void {
  pasos.paso(texto, async (m: Mundo, ...argumentos: unknown[]) => {
    m.exigirRevisado(revisa(opciones, argumentos))
    await m.historia.materializar()
    await m.app.esperarTareasPendientes()
    await manejador(m, ...(argumentos as never[]))
  })
}

/** Historia declarada ("vendió 56 entre …"): solo anota el plan (ver `historia.ts`). */
export function declaracion(pasos: Pasos, texto: string, manejador: Manejador): void {
  pasos.paso(texto, async (m: Mundo, ...argumentos: unknown[]) => {
    m.exigirRevisado(false)
    await manejador(m, ...(argumentos as never[]))
  })
}

/** Las filas de la tabla del paso (o un error claro si el paso no la trae). */
export function filasDe(extra: ArgumentoExtra | undefined): Record<string, string>[] {
  if (!extra?.tabla) throw new Error('El paso necesita una tabla')
  return extra.tabla.filas
}

/** Una celda de la fila (o un error claro si la columna no está). */
export function celda(fila: Record<string, string>, columna: string): string {
  const valor = fila[columna]
  if (valor === undefined) throw new Error(`La tabla no tiene la columna "${columna}"`)
  return valor
}

/** "A, B, C" → ["A", "B", "C"]; "" → []. */
export function lista(texto: string): string[] {
  return texto
    .split(',')
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '')
}

/** Instante absoluto en ISO 8601 UTC. */
export type Instante = string
/** Día de negocio "AAAA-MM-DD" en la zona de la tienda. */
export type Dia = string

/** Perú no usa horario de verano: America/Lima es siempre UTC−5. */
const DESFASE_MS = -5 * 60 * 60 * 1000
const MS_POR_DIA = 24 * 60 * 60 * 1000

export function diaDe(instante: Instante): Dia {
  return new Date(Date.parse(instante) + DESFASE_MS).toISOString().slice(0, 10)
}

/**
 * El día de negocio de la tienda en el instante `ahora` (America/Lima). Las pantallas le pasan
 * el reloj del celular (`hoyEnLaTienda(new Date())`) para "Hoy" / "Ayer" y los límites de las
 * fechas; los casos de uso usan su propio reloj. Un solo ayudante (plan 12, r2): antes había uno
 * en Inventario y otro en Catálogo.
 */
export function hoyEnLaTienda(ahora: Date): Dia {
  return diaDe(ahora.toISOString())
}

/** Hora del día en la tienda, "HH:mm" (24 h): la del Historial ("Hoy, 10:32"). */
export function horaDe(instante: Instante): string {
  return new Date(Date.parse(instante) + DESFASE_MS).toISOString().slice(11, 16)
}

/** "AAAA-MM-DD HH:mm" en hora de la tienda → Instante. */
export function instanteLocal(texto: string): Instante {
  const [dia, hora = '00:00'] = texto.trim().split(/\s+/)
  return new Date(Date.parse(`${dia}T${hora}:00.000Z`) - DESFASE_MS).toISOString()
}

export function inicioDelDia(dia: Dia): Instante {
  return instanteLocal(`${dia} 00:00`)
}

export function sumarDias(dia: Dia, n: number): Dia {
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) + n * MS_POR_DIA).toISOString().slice(0, 10)
}

export function diasEntre(desde: Dia, hasta: Dia): number {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00.000Z`) - Date.parse(`${desde}T00:00:00.000Z`)) / MS_POR_DIA,
  )
}

export function diaDeLaSemana(dia: Dia): number {
  const domingoEsCero = new Date(`${dia}T00:00:00.000Z`).getUTCDay()
  return domingoEsCero === 0 ? 7 : domingoEsCero
}

export function sumarSegundos(instante: Instante, segundos: number): Instante {
  return new Date(Date.parse(instante) + segundos * 1000).toISOString()
}

export function segundosEntre(desde: Instante, hasta: Instante): number {
  return (Date.parse(hasta) - Date.parse(desde)) / 1000
}

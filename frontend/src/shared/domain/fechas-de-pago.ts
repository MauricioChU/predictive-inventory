import type { Dia } from './fecha'

const dos = (n: number) => String(n).padStart(2, '0')
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

/** El día elegido en ese mes, o el último día si el mes no lo tiene (31 → 28/02). */
export function fechaDePagoEn(anio: number, mes: number, dia: number): Dia {
  return `${anio}-${dos(mes)}-${dos(Math.min(dia, diasDelMes(anio, mes)))}`
}

/** Fechas de pago del mes anterior, el actual y el siguiente, ordenadas. Con días ≤ 31 alcanza. */
function fechasAlrededor(dias: readonly number[], hoy: Dia): Dia[] {
  const [anio, mes] = hoy.split('-').map(Number) as [number, number]
  const meses: [number, number][] = [-1, 0, 1].map((d) => {
    const m = mes + d
    return m < 1 ? [anio - 1, 12] : m > 12 ? [anio + 1, 1] : [anio, m]
  })
  return meses.flatMap(([a, m]) => dias.map((d) => fechaDePagoEn(a, m, d))).sort()
}

/** Último pago: la fecha de pago más reciente igual o anterior a hoy (RN-AN-18). */
export function ultimoPago(dias: readonly number[], hoy: Dia): Dia {
  return fechasAlrededor(dias, hoy)
    .filter((f) => f <= hoy)
    .at(-1)!
}

/** Próximo pago: la primera fecha de pago posterior a hoy (RN-AN-18). */
export function proximoPago(dias: readonly number[], hoy: Dia): Dia {
  return fechasAlrededor(dias, hoy).find((f) => f > hoy)!
}

/** La siguiente fecha de pago igual o posterior a hoy (RN-AL-10). */
export function siguientePagoDesde(dias: readonly number[], hoy: Dia): Dia {
  return fechasAlrededor(dias, hoy).find((f) => f >= hoy)!
}

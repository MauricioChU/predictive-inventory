import { afterEach, describe, expect, it } from 'vitest'
import { diaDe } from '@/shared/domain/fecha'
import { etiquetaDeDia } from '../etiquetas-de-dia'

// 2026-10-16 es viernes (día de negocio en Lima).
const HOY = '2026-10-16'

describe('etiquetaDeDia: encabezados del Historial ("Hoy", "Ayer", "Lunes 12")', () => {
  it('el mismo día es "Hoy"', () => {
    expect(etiquetaDeDia(HOY, HOY)).toBe('Hoy')
  })

  it('el día anterior es "Ayer"', () => {
    expect(etiquetaDeDia('2026-10-15', HOY)).toBe('Ayer')
  })

  it.each([
    ['2026-10-14', 'Miércoles 14'],
    ['2026-10-13', 'Martes 13'],
    ['2026-10-12', 'Lunes 12'],
    ['2026-10-11', 'Domingo 11'],
    ['2026-10-10', 'Sábado 10'],
    // Hace exactamente 7 días todavía va con el nombre del día (más de 7 → fecha).
    ['2026-10-09', 'Viernes 9'],
  ])(
    'dentro de los últimos 7 días, %s es "%s" (día con mayúscula, número sin cero)',
    (dia, texto) => {
      expect(etiquetaDeDia(dia, HOY)).toBe(texto)
    },
  )

  it('hace más de 7 días es la fecha DD/MM/AAAA', () => {
    expect(etiquetaDeDia('2026-10-08', HOY)).toBe('08/10/2026')
    expect(etiquetaDeDia('2026-01-05', HOY)).toBe('05/01/2026')
  })

  it('el jueves de esa misma semana usa su nombre (todos los días de la semana tienen nombre)', () => {
    expect(etiquetaDeDia('2026-10-08', '2026-10-14')).toBe('Jueves 8')
  })

  it('cruza el fin de mes', () => {
    // 2026-11-02 es lunes.
    expect(etiquetaDeDia('2026-11-01', '2026-11-02')).toBe('Ayer')
    expect(etiquetaDeDia('2026-10-31', '2026-11-02')).toBe('Sábado 31')
    expect(etiquetaDeDia('2026-10-26', '2026-11-02')).toBe('Lunes 26')
    expect(etiquetaDeDia('2026-10-25', '2026-11-02')).toBe('25/10/2026')
  })

  it('cruza el fin de año', () => {
    // 2027-01-01 es viernes.
    expect(etiquetaDeDia('2026-12-31', '2027-01-01')).toBe('Ayer')
    expect(etiquetaDeDia('2026-12-28', '2027-01-01')).toBe('Lunes 28')
    expect(etiquetaDeDia('2026-12-24', '2027-01-01')).toBe('24/12/2026')
  })

  it('un día futuro (no debería pasar) se muestra con su fecha, nunca como "Hoy"', () => {
    expect(etiquetaDeDia('2026-10-17', HOY)).toBe('17/10/2026')
  })
})

describe('etiquetaDeDia: el día es el de la tienda en Lima, no el de UTC', () => {
  // 23:30 del jueves 15 en Lima = 04:30 del viernes 16 en UTC.
  const VENTA_DE_LA_NOCHE = '2026-10-16T04:30:00.000Z'

  it('una venta de las 23:30 en Lima es "Hoy" mientras en Lima siga siendo ese día (en UTC ya es mañana)', () => {
    const hoyEnLima = diaDe('2026-10-16T04:55:00.000Z') // 23:55 del jueves en Lima
    expect(etiquetaDeDia(diaDe(VENTA_DE_LA_NOCHE), hoyEnLima)).toBe('Hoy')
  })

  it('a la medianoche de Lima la misma venta pasa a ser "Ayer"', () => {
    const hoyEnLima = diaDe('2026-10-16T05:00:00.000Z') // 00:00 del viernes en Lima
    expect(etiquetaDeDia(diaDe(VENTA_DE_LA_NOCHE), hoyEnLima)).toBe('Ayer')
  })

  it('a la semana siguiente lleva el nombre del jueves (su día en Lima), no del viernes (su día en UTC)', () => {
    const hoyEnLima = diaDe('2026-10-20T15:00:00.000Z') // martes 20
    expect(etiquetaDeDia(diaDe(VENTA_DE_LA_NOCHE), hoyEnLima)).toBe('Jueves 15')
  })
})

describe('etiquetaDeDia: no depende de la zona horaria del celular', () => {
  const zonaOriginal = process.env.TZ
  afterEach(() => {
    if (zonaOriginal === undefined) delete process.env.TZ
    else process.env.TZ = zonaOriginal
  })

  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Lima', 'UTC'])(
    'con el sistema en %s, "2026-10-12" sigue siendo "Lunes 12"',
    (zona) => {
      process.env.TZ = zona
      expect(etiquetaDeDia('2026-10-12', HOY)).toBe('Lunes 12')
      expect(etiquetaDeDia('2026-10-15', HOY)).toBe('Ayer')
      expect(etiquetaDeDia('2026-10-01', HOY)).toBe('01/10/2026')
    },
  )
})

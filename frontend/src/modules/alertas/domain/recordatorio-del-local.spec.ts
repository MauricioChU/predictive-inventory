import { describe, expect, it } from 'vitest'
import type { AlquilerDelLocal } from '@/shared/contratos/configuracion'
import { RUTA_DE_CONTROL, recordatorioDelLocal } from './recordatorio-del-local'

const mensual20: AlquilerDelLocal = { tipo: 'MENSUAL', montoCentimos: 120000, dias: [20] }

describe('recordatorioDelLocal (RN-AL-10)', () => {
  it('RN-AL-10: dos días antes dice "Pasado mañana pagas el local"', () => {
    expect(recordatorioDelLocal(mensual20, '2026-10-18')).toEqual({
      fechaDePago: '2026-10-20',
      texto: 'Pasado mañana pagas el local: S/ 1 200.00',
    })
  })

  it('RN-AL-10: un día antes dice "Mañana pagas el local"', () => {
    expect(recordatorioDelLocal(mensual20, '2026-10-19')).toEqual({
      fechaDePago: '2026-10-20',
      texto: 'Mañana pagas el local: S/ 1 200.00',
    })
  })

  it('RN-AL-10: el mismo día dice "Hoy pagas el local"', () => {
    expect(recordatorioDelLocal(mensual20, '2026-10-20')).toEqual({
      fechaDePago: '2026-10-20',
      texto: 'Hoy pagas el local: S/ 1 200.00',
    })
  })

  it('RN-AL-10: a 3 días o más no hay recordatorio', () => {
    expect(recordatorioDelLocal(mensual20, '2026-10-17')).toBeNull()
  })

  it('RN-AL-10: pasado el pago, el siguiente queda lejos y no hay recordatorio', () => {
    expect(recordatorioDelLocal(mensual20, '2026-10-21')).toBeNull()
  })

  it('RN-AL-10: sin configurar o con "No pago" no hay recordatorio', () => {
    expect(recordatorioDelLocal(null, '2026-10-20')).toBeNull()
    expect(recordatorioDelLocal({ tipo: 'NO_PAGA' }, '2026-10-20')).toBeNull()
  })

  it('RN-AL-10: el pago del 31 cae el 28 en febrero ("Pasado mañana" el 26)', () => {
    const fin: AlquilerDelLocal = { tipo: 'MENSUAL', montoCentimos: 50000, dias: [31] }
    expect(recordatorioDelLocal(fin, '2027-02-26')).toEqual({
      fechaDePago: '2027-02-28',
      texto: 'Pasado mañana pagas el local: S/ 500.00',
    })
  })

  it('RN-AL-10: con pago quincenal avisa el más cercano', () => {
    const quincenal: AlquilerDelLocal = {
      tipo: 'QUINCENAL',
      montoCentimos: 60000,
      dias: [5, 20],
    }
    expect(recordatorioDelLocal(quincenal, '2026-11-04')?.fechaDePago).toBe('2026-11-05')
  })

  it('RN-AL-11: el recordatorio se abre en Control', () => {
    expect(RUTA_DE_CONTROL).toBe('/control')
  })
})

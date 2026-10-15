import { describe, expect, it } from 'vitest'
import { mensajeDeRecordatorio } from './recordatorio'

describe('mensajeDeRecordatorio', () => {
  it('RN-RE-06: nunca hubo copia', () => {
    expect(
      mensajeDeRecordatorio({
        ultimoRespaldoEn: null,
        almacenamientoPersistente: 'CONCEDIDO',
        hoy: '2026-10-15',
      }),
    ).toBe('Todavía no guardas una copia de tus datos')
  })

  it('RN-RE-06: hace 6 días (menos del umbral de 7) no muestra recordatorio', () => {
    expect(
      mensajeDeRecordatorio({
        ultimoRespaldoEn: '2026-10-09T05:00:00.000Z',
        almacenamientoPersistente: 'CONCEDIDO',
        hoy: '2026-10-15',
      }),
    ).toBeNull()
  })

  it('RN-RE-06: hace 7 días muestra el recordatorio', () => {
    expect(
      mensajeDeRecordatorio({
        ultimoRespaldoEn: '2026-10-08T05:00:00.000Z',
        almacenamientoPersistente: 'CONCEDIDO',
        hoy: '2026-10-15',
      }),
    ).toBe('Hace 7 días que no guardas una copia')
  })

  it('RN-RE-06: hace 30 días muestra el recordatorio', () => {
    expect(
      mensajeDeRecordatorio({
        ultimoRespaldoEn: '2026-09-15T05:00:00.000Z',
        almacenamientoPersistente: 'CONCEDIDO',
        hoy: '2026-10-15',
      }),
    ).toBe('Hace 30 días que no guardas una copia')
  })

  it('RN-RE-09: sin almacenamiento persistente (RECHAZADO), el umbral es 3 días', () => {
    expect(
      mensajeDeRecordatorio({
        ultimoRespaldoEn: '2026-10-12T05:00:00.000Z',
        almacenamientoPersistente: 'RECHAZADO',
        hoy: '2026-10-15',
      }),
    ).toBe('Hace 3 días que no guardas una copia')
  })

  it('RN-RE-09: RECHAZADO con 2 días (menos del umbral de 3) no muestra recordatorio', () => {
    expect(
      mensajeDeRecordatorio({
        ultimoRespaldoEn: '2026-10-13T05:00:00.000Z',
        almacenamientoPersistente: 'RECHAZADO',
        hoy: '2026-10-15',
      }),
    ).toBeNull()
  })

  it('DESCONOCIDO se comporta como el umbral normal de 7 días', () => {
    expect(
      mensajeDeRecordatorio({
        ultimoRespaldoEn: '2026-10-08T05:00:00.000Z',
        almacenamientoPersistente: 'DESCONOCIDO',
        hoy: '2026-10-15',
      }),
    ).toBe('Hace 7 días que no guardas una copia')
  })
})

import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FechaYHora from './FechaYHora.vue'

// 2026-10-19 20:24 UTC = lunes 19 de octubre, 3:24 p. m. en Lima (UTC−5).
const LUNES_3_24_PM = new Date('2026-10-19T20:24:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(LUNES_3_24_PM)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Inicio: fecha y hora', () => {
  it('06-experiencia-de-uso: muestra la fecha a la izquierda y la hora a la derecha, en hora de Lima', () => {
    const w = mount(FechaYHora)
    expect(w.get('.fecha').text()).toBe('lunes 19 de octubre')
    expect(w.get('.hora').text()).toBe('3:24 p. m.')
    expect(w.findAll('span').map((s) => s.classes()[0])).toEqual(['fecha', 'hora'])
    expect(w.find('[aria-live]').exists()).toBe(false)
    w.unmount()
  })

  it('usa el día de Lima aunque en UTC ya sea otro día', () => {
    vi.setSystemTime(new Date('2026-10-20T03:05:00Z')) // 10:05 p. m. del lunes en Lima
    const w = mount(FechaYHora)
    expect(w.get('.fecha').text()).toBe('lunes 19 de octubre')
    expect(w.get('.hora').text()).toBe('10:05 p. m.')
    w.unmount()
  })

  it('se actualiza cada 30 segundos', async () => {
    const w = mount(FechaYHora)
    vi.advanceTimersByTime(30_000)
    await nextTick()
    expect(w.get('.hora').text()).toBe('3:24 p. m.')
    vi.setSystemTime(new Date('2026-10-19T20:25:10Z'))
    vi.advanceTimersByTime(30_000)
    await nextTick()
    expect(w.get('.hora').text()).toBe('3:25 p. m.')
    w.unmount()
  })

  it('al salir de la pantalla deja de actualizarse', () => {
    const w = mount(FechaYHora)
    expect(vi.getTimerCount()).toBe(1)
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

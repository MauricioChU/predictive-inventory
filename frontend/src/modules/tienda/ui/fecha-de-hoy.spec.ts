import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FechaDeHoy from './FechaDeHoy.vue'

// 2026-10-19 20:24 UTC = lunes 19 de octubre en Lima (UTC−5).
const LUNES = new Date('2026-10-19T20:24:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(LUNES)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Inicio: fecha', () => {
  it('06-experiencia-de-uso: muestra solo la fecha, en mayúsculas y sin hora', () => {
    const w = mount(FechaDeHoy)
    expect(w.get('.fecha-de-hoy').text()).toBe('LUNES 19 DE OCTUBRE')
    expect(w.text()).not.toMatch(/\d:\d\d/)
    expect(w.find('[aria-live]').exists()).toBe(false)
    w.unmount()
  })

  it('usa el día de Lima aunque en UTC ya sea otro día', () => {
    vi.setSystemTime(new Date('2026-10-20T03:05:00Z')) // 10:05 p. m. del lunes en Lima
    const w = mount(FechaDeHoy)
    expect(w.get('.fecha-de-hoy').text()).toBe('LUNES 19 DE OCTUBRE')
    w.unmount()
  })

  it('no usa ningún intervalo', () => {
    const w = mount(FechaDeHoy)
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })

  it('cambia al pasar la medianoche cuando la pestaña vuelve a estar a la vista', async () => {
    const w = mount(FechaDeHoy)
    vi.setSystemTime(new Date('2026-10-20T05:01:00Z')) // 12:01 a. m. del martes en Lima
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(w.get('.fecha-de-hoy').text()).toBe('MARTES 20 DE OCTUBRE')
    w.unmount()
  })

  it('al salir de la pantalla deja de escuchar', () => {
    const quitar = vi.spyOn(document, 'removeEventListener')
    const w = mount(FechaDeHoy)
    w.unmount()
    expect(quitar).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})

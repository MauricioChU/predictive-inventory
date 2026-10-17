import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// M8 (plan 12, r1): el aviso cuenta por defecto los mismos segundos que la regla, sin su propia
// copia. Se simula otro valor para probar que el componente lo toma de la constante compartida.
vi.mock('@/shared/contratos/operaciones', async (original) => ({
  ...(await original<typeof import('@/shared/contratos/operaciones')>()),
  SEGUNDOS_PARA_DESHACER: 7,
}))

describe('M8: AvisoDeshacer usa SEGUNDOS_PARA_DESHACER por defecto', () => {
  it('RN-OP-18: sin "segundos", el contador arranca en la constante compartida', async () => {
    const { default: AvisoDeshacer } = await import('../componentes/AvisoDeshacer.vue')
    const w = mount(AvisoDeshacer, { props: { mensaje: 'Venta registrada' } })
    expect(w.get('.contador').text()).toBe('(7)')
  })

  // Plan 17: ya no hay prop pública "segundos": nadie (pantalla ni prueba) cambia los 10 s.
  it('RN-OP-18: aunque alguien le pase "segundos", cuenta SEGUNDOS_PARA_DESHACER', async () => {
    vi.useFakeTimers()
    try {
      const { default: AvisoDeshacer } = await import('../componentes/AvisoDeshacer.vue')
      const w = mount(AvisoDeshacer, {
        props: { mensaje: 'Venta registrada', segundos: 3 } as never,
      })
      expect(w.get('.contador').text()).toBe('(7)')
      await vi.advanceTimersByTimeAsync(3000)
      expect(w.emitted('cerrar'), 'sigue abierto a los 3 s').toBeUndefined()
      await vi.advanceTimersByTimeAsync(4000)
      expect(w.emitted('cerrar'), 'se cierra a los 7 s').toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

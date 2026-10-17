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
})

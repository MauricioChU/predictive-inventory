import { describe, expect, it, vi } from 'vitest'

// M9 (plan 12): una sola constante. Si el módulo de inventario cambia su tiempo, el aviso de la
// pantalla lo sigue solo. Se simula otro valor para probar que el aviso NO tiene su propia copia.
vi.mock('@/modules/inventario', () => ({ SEGUNDOS_PARA_DESHACER: 7 }))

describe('M9: el aviso Deshacer usa la constante del módulo de inventario', () => {
  it('RN-OP-18: SEGUNDOS_PARA_DESHACER del aviso es la de inventario, no una copia', async () => {
    const { SEGUNDOS_PARA_DESHACER } = await import('../aviso-deshacer')
    expect(SEGUNDOS_PARA_DESHACER).toBe(7)
  })
})

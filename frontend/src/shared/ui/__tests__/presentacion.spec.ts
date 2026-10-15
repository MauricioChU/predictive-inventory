import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { PRESENTACION_DE_ESTADO } from '../presentacion-estado'
import InsigniaEstado from '../componentes/InsigniaEstado.vue'
import EstadoVacio from '../componentes/EstadoVacio.vue'

describe('RN-AL-05: cada estado con color, ícono y texto', () => {
  it.each([
    ['AGOTADO', 'rojo', 'círculo-x', 'Agotado'],
    ['POR_ACABARSE', 'naranja', 'advertencia', 'Queda poco'],
    ['NORMAL', 'verde', 'check', 'Bien'],
  ] as const)('%s', (estado, color, icono, texto) => {
    expect(PRESENTACION_DE_ESTADO[estado]).toMatchObject({ color, icono, texto })
    const w = mount(InsigniaEstado, { props: { estado } })
    expect(w.text()).toContain(texto)
    expect(w.find('svg').exists()).toBe(true)
  })
})

describe('RN-UX-10: estado vacío útil', () => {
  it('explica y ofrece la acción siguiente', async () => {
    const w = mount(EstadoVacio, { props: { titulo: 'Aún no tienes productos.', accion: 'Agregar el primero' } })
    await w.get('button').trigger('click')
    expect(w.emitted('accion')).toHaveLength(1)
  })
})

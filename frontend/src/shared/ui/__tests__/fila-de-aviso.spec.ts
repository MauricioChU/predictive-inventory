import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FilaDeAviso from '../componentes/FilaDeAviso.vue'

describe('FilaDeAviso', () => {
  it('con acción, la flecha es un botón con nombre accesible y avisa al tocarla', async () => {
    const fila = mount(FilaDeAviso, {
      props: { tono: 'atencion', texto: '4 productos se acaban', textoAccion: 'Ver productos' },
    })
    expect(fila.text()).toContain('4 productos se acaban')
    const boton = fila.get('button')
    expect(boton.attributes('aria-label')).toBe('Ver productos')
    await boton.trigger('click')
    expect(fila.emitted('accion')).toHaveLength(1)
  })

  it('sin acción es solo un aviso, sin botón', () => {
    const fila = mount(FilaDeAviso, { props: { tono: 'exito', texto: 'Todo en orden' } })
    expect(fila.find('button').exists()).toBe(false)
  })
})

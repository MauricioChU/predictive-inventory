import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import type { Aplicacion } from '../composicion'
import { proveerAplicacion, useAplicacion } from '../proveer-aplicacion'

const Pantalla = defineComponent({
  setup() {
    const aplicacion = useAplicacion()
    return () => h('p', typeof aplicacion.catalogo.buscarProductos)
  },
})

describe('proveerAplicacion y useAplicacion', () => {
  it('cada pantalla recibe la aplicación que instaló main.ts', () => {
    const aplicacion = {
      catalogo: { buscarProductos: async () => [] },
    } as unknown as Aplicacion

    const envoltura = mount(Pantalla, { global: { plugins: [proveerAplicacion(aplicacion)] } })

    expect(envoltura.text()).toBe('function')
  })

  it('sin el plugin, useAplicacion explica qué falta', () => {
    expect(() => mount(Pantalla)).toThrow(
      'useAplicacion necesita que main.ts instale proveerAplicacion(aplicacion)',
    )
  })
})

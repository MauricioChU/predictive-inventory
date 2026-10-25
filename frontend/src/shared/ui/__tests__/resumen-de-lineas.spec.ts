import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResumenDeLineas, { type LineaDeResumen } from '../componentes/ResumenDeLineas.vue'

const lineas = (n: number): LineaDeResumen[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `l${i}`,
    nombre: `Producto ${i + 1}`,
    detalle: '1 unid. × S/ 3.50',
    importe: 'S/ 3.50',
  }))

describe('ResumenDeLineas', () => {
  it('hasta 4 líneas: una lista con nombre, sin región que se desplace ni pista', () => {
    const resumen = mount(ResumenDeLineas, {
      props: { lineas: lineas(4), etiqueta: 'Lo que vendiste' },
    })
    expect(resumen.get('ul').attributes('aria-label')).toBe('Lo que vendiste')
    expect(resumen.findAll('li')).toHaveLength(4)
    expect(resumen.find('[role="region"]').exists()).toBe(false)
    expect(resumen.find('.pista').exists()).toBe(false)
  })

  it('más de 4: región con nombre que el teclado alcanza y pista "y N más"', () => {
    const resumen = mount(ResumenDeLineas, {
      props: { lineas: lineas(7), etiqueta: 'Lo que vendiste' },
    })
    const region = resumen.get('[role="region"]')
    expect(region.attributes('aria-label')).toBe('Lo que vendiste: 7 productos')
    expect(region.attributes('tabindex')).toBe('0')
    expect(resumen.findAll('li')).toHaveLength(7)
    expect(resumen.get('.pista').text()).toBe('y 3 más')
  })
})

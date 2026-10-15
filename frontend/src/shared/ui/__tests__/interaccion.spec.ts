import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvisoDeshacer from '../componentes/AvisoDeshacer.vue'
import GraficoBarras from '../componentes/GraficoBarras.vue'

describe('RN-OP-18: aviso Deshacer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('ofrece deshacer y se cierra solo a los 10 segundos', async () => {
    const w = mount(AvisoDeshacer, { props: { mensaje: 'Venta registrada' } })
    expect(w.text()).toContain('Deshacer')
    await vi.advanceTimersByTimeAsync(5000)
    await w.get('button').trigger('click')
    expect(w.emitted('deshacer')).toHaveLength(1)
  })
  it('emite cerrar al terminar el tiempo', async () => {
    const w = mount(AvisoDeshacer, { props: { mensaje: 'Venta registrada', segundos: 10 } })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(w.emitted('cerrar')).toHaveLength(1)
  })
})

describe('GraficoBarras', () => {
  it('es legible por lector de pantalla', () => {
    const w = mount(GraficoBarras, {
      props: {
        titulo: 'Ventas por día',
        barras: [
          { etiqueta: 'lun', valor: 100, textoValor: 'S/ 100.00' },
          { etiqueta: 'sáb', valor: 200, textoValor: 'S/ 200.00', destacada: true },
        ],
      },
    })
    expect(w.get('table').text()).toContain('S/ 200.00')
  })
  it('hallazgo 2: la tabla (envuelta en un div .solo-lector, no aplicado directo a la tabla) es la única fuente de datos; lo visual queda aria-hidden', () => {
    const w = mount(GraficoBarras, {
      props: {
        titulo: 'Ventas por día',
        barras: [
          { etiqueta: 'lun', valor: 100, textoValor: 'S/ 100.00' },
          { etiqueta: 'sáb', valor: 200, textoValor: 'S/ 200.00', destacada: true },
        ],
      },
    })
    expect(w.get('.filas').attributes('aria-hidden')).toBe('true')
    expect(w.get('.solo-lector').element.tagName).toBe('DIV')
    expect(w.find('.solo-lector table').exists()).toBe(true)
    const figura = w.get('figure')
    const idTitulo = figura.attributes('aria-labelledby')!
    expect(w.get(`#${idTitulo}`).text()).toBe('Ventas por día')
  })
  it('hallazgo 2: cada barra es una fila horizontal (etiqueta · barra · valor en HTML, no en <text> de SVG)', () => {
    const w = mount(GraficoBarras, {
      props: {
        titulo: 'Ventas por día',
        barras: [{ etiqueta: 'lun', valor: 100, textoValor: 'S/ 100.00' }],
      },
    })
    expect(w.find('svg').exists()).toBe(false)
    expect(w.get('.etiqueta').text()).toBe('lun')
    expect(w.get('.valor').text()).toBe('S/ 100.00')
  })
  it('hallazgo 2: la barra destacada se distingue también sin color (borde de acento + negrita)', () => {
    const w = mount(GraficoBarras, {
      props: {
        titulo: 'Ventas por día',
        barras: [
          { etiqueta: 'lun', valor: 100, textoValor: 'S/ 100.00' },
          { etiqueta: 'sáb', valor: 200, textoValor: 'S/ 200.00', destacada: true },
        ],
      },
    })
    const filas = w.findAll('.fila')
    expect(filas[0]?.classes()).not.toContain('fila--destacada')
    expect(filas[1]?.classes()).toContain('fila--destacada')
  })
})

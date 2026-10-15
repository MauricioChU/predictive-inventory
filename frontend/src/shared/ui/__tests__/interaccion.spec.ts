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
  it('N2: todas las filas usan la misma escala (porcentaje del mayor) y un valor > 0 nunca queda sin barra', () => {
    const w = mount(GraficoBarras, {
      props: {
        titulo: 'Ventas por mes',
        barras: [
          { etiqueta: 'ene', valor: 200, textoValor: 'S/ 200.00' },
          { etiqueta: 'feb', valor: 0.01, textoValor: 'S/ 0.01' },
          { etiqueta: 'mar', valor: 0, textoValor: 'S/ 0.00' },
        ],
      },
    })
    const barras = w.findAll('.barra')
    expect(
      barras.map((b) => (b.element as HTMLElement).style.getPropertyValue('--porcentaje')),
    ).toEqual(['100%', '0.01%', '0%'])
    expect(barras.map((b) => b.classes().includes('barra--visible'))).toEqual([true, true, false])
  })
  it('N2: las filas comparten una sola grilla (un único contenedor .filas con las tres partes de cada fila)', () => {
    const w = mount(GraficoBarras, {
      props: {
        titulo: 'Ventas por día',
        barras: [
          { etiqueta: 'lun', valor: 100, textoValor: 'S/ 100.00' },
          { etiqueta: 'mar', valor: 50, textoValor: 'S/ 50.00' },
        ],
      },
    })
    expect(w.findAll('.filas')).toHaveLength(1)
    for (const fila of w.findAll('.filas > .fila')) {
      expect(fila.findAll(':scope > .etiqueta, :scope > .pista, :scope > .valor')).toHaveLength(3)
    }
  })
  it('ronda 5: publica el largo del valor y de la etiqueta más largos (columnas fijas e iguales si no hay subgrid)', () => {
    const w = mount(GraficoBarras, {
      props: {
        titulo: 'Ventas por mes',
        barras: [
          { etiqueta: 'Limpiavidrios', valor: 9.5, textoValor: 'S/ 9.50' },
          { etiqueta: 'Desinfectante multiuso', valor: 12345.67, textoValor: 'S/ 12 345.67' },
        ],
      },
    })
    const filas = w.get('.filas').element as HTMLElement
    expect(filas.style.getPropertyValue('--caracteres-valor')).toBe('12')
    expect(filas.style.getPropertyValue('--caracteres-etiqueta')).toBe('22')
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

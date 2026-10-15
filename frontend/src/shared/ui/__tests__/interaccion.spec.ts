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
      props: { titulo: 'Ventas por día', barras: [{ etiqueta: 'lun', valor: 100, textoValor: 'S/ 100.00' }, { etiqueta: 'sáb', valor: 200, textoValor: 'S/ 200.00', destacada: true }] },
    })
    expect(w.get('svg').attributes('role')).toBe('img')
    expect(w.get('table').text()).toContain('S/ 200.00')
  })
})

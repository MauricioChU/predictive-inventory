/// <reference lib="es2022.array" />
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SelectorDeDia from '../componentes/SelectorDeDia.vue'

describe('SelectorDeDia (día del mes, 1 a 31)', () => {
  it('RN-UX-15: es un <select> con nombre accesible (su etiqueta visible) y las opciones 1 a 31', () => {
    const w = mount(SelectorDeDia, { props: { etiqueta: '¿Qué día pagas?', modelValue: 5 } })
    const select = w.get('select')
    expect(w.get('label').attributes('for')).toBe(select.attributes('id'))
    expect(w.get('label').text()).toBe('¿Qué día pagas?')
    const dias = w
      .findAll('option')
      .map((o) => o.element.value)
      .filter((valor) => valor !== '')
    expect(dias).toEqual(Array.from({ length: 31 }, (_, i) => String(i + 1)))
    expect(select.element.value).toBe('5')
  })

  it('sin día elegido muestra "Elige un día" y emite el número al elegir', async () => {
    const w = mount(SelectorDeDia, { props: { etiqueta: 'Primer día de pago', modelValue: null } })
    const select = w.get('select')
    expect(select.element.value).toBe('')
    expect(w.findAll('option')[0]!.text()).toBe('Elige un día')
    await select.setValue('20')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([20])
  })

  it('volver a "Elige un día" emite null', async () => {
    const w = mount(SelectorDeDia, { props: { etiqueta: 'Día', modelValue: 7 } })
    await w.get('select').setValue('')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('RN-UX-15: el error se anuncia, queda ligado al campo y lo marca inválido', () => {
    const w = mount(SelectorDeDia, {
      props: { etiqueta: 'Día', modelValue: null, error: 'Elige el día de pago' },
    })
    const select = w.get('select')
    expect(select.attributes('aria-invalid')).toBe('true')
    const aviso = w.get(`#${select.attributes('aria-describedby')!}`)
    expect(aviso.text()).toBe('Elige el día de pago')
    expect(aviso.attributes('role')).toBe('alert')
  })

  it('sin error no hay aria-invalid ni aria-describedby', () => {
    const w = mount(SelectorDeDia, { props: { etiqueta: 'Día', modelValue: 3 } })
    expect(w.get('select').attributes('aria-invalid')).toBeUndefined()
    expect(w.get('select').attributes('aria-describedby')).toBeUndefined()
  })
})

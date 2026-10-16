import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BuscadorGrande from '../componentes/BuscadorGrande.vue'

/** La espera del buscador antes de avisar lo escrito (plan 09b). */
const ESPERA_MS = 200

function montar(props: Partial<{ modelValue: string; marcador: string; autofoco: boolean }> = {}) {
  return mount(BuscadorGrande, {
    props: { modelValue: '', etiqueta: 'Buscar producto', ...props },
    attachTo: document.body,
  })
}

describe('BuscadorGrande', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('RN-UX-15: la etiqueta visible nombra al campo; abre el teclado de búsqueda', () => {
    const w = montar({ marcador: 'Ej.: lejía' })
    const input = w.get('input')
    expect(w.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(w.get('label').text()).toBe('Buscar producto')
    expect(input.attributes('type')).toBe('search')
    expect(input.attributes('inputmode')).toBe('search')
    expect(input.attributes('enterkeyhint')).toBe('search')
    expect(input.attributes('placeholder')).toBe('Ej.: lejía')
    expect(input.attributes('autocomplete')).toBe('off')
    // La lupa es decoración: no se lee.
    expect(w.get('svg').attributes('aria-hidden')).toBe('true')
    w.unmount()
  })

  it('avisa lo escrito recién a los 200 ms de la última tecla, una sola vez', async () => {
    const w = montar()
    const input = w.get('input')
    await input.setValue('le')
    await vi.advanceTimersByTimeAsync(ESPERA_MS - 1)
    await input.setValue('lej')
    await vi.advanceTimersByTimeAsync(ESPERA_MS - 1)
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(w.emitted('update:modelValue')).toEqual([['lej']])
    w.unmount()
  })

  it('Enter (la tecla "Buscar" del teclado) avisa enseguida, sin esperar', async () => {
    const w = montar()
    const input = w.get('input')
    await input.setValue('bolsa')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toEqual([['bolsa']])
    await vi.advanceTimersByTimeAsync(ESPERA_MS)
    expect(w.emitted('update:modelValue')).toHaveLength(1)
    w.unmount()
  })

  it('el botón "Borrar" solo aparece cuando hay texto', async () => {
    const w = montar()
    expect(w.find('button').exists()).toBe(false)
    await w.get('input').setValue('l')
    const borrar = w.get('button')
    expect(borrar.text()).toBe('Borrar')
    expect(borrar.attributes('type')).toBe('button')
    w.unmount()
  })

  it('"Borrar" vacía el campo, avisa "" y limpiar al instante y deja el foco en el campo', async () => {
    const w = montar({ modelValue: 'lejía' })
    const input = w.get('input')
    expect((input.element as HTMLInputElement).value).toBe('lejía')
    await input.setValue('lejías')
    await w.get('button').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['']])
    expect(w.emitted('limpiar')).toEqual([[]])
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(input.element)
    // Lo que estaba por avisarse ("lejías") ya no se avisa.
    await vi.advanceTimersByTimeAsync(ESPERA_MS)
    expect(w.emitted('update:modelValue')).toEqual([['']])
    w.unmount()
  })

  it('si quien lo usa cambia el valor (p. ej. lo vacía tras elegir), el campo lo muestra', async () => {
    const w = montar({ modelValue: 'lej' })
    await w.setProps({ modelValue: '' })
    expect((w.get('input').element as HTMLInputElement).value).toBe('')
  })

  it('el eco de lo que él mismo avisó no pisa lo que la persona siguió escribiendo', async () => {
    const w = montar()
    const input = w.get('input')
    await input.setValue('lej')
    await vi.advanceTimersByTimeAsync(ESPERA_MS)
    await input.setValue('lejia') // sigue escribiendo
    await w.setProps({ modelValue: 'lej' }) // llega el eco del aviso anterior
    expect((input.element as HTMLInputElement).value).toBe('lejia')
    await vi.advanceTimersByTimeAsync(ESPERA_MS)
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['lejia'])
    w.unmount()
  })

  it('autofoco (opcional) enfoca el campo al aparecer; sin él no lo enfoca', () => {
    const con = montar({ autofoco: true })
    expect(document.activeElement).toBe(con.get('input').element)
    con.unmount()
    const sin = montar()
    expect(document.activeElement).not.toBe(sin.get('input').element)
    sin.unmount()
  })

  it('no avisa nada después de desmontarse', async () => {
    const w = montar()
    await w.get('input').setValue('lej')
    w.unmount()
    await vi.advanceTimersByTimeAsync(ESPERA_MS)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('ronda 1 (a): vaciar() limpia aunque modelValue ya sea "" y anula lo que estaba por avisarse', async () => {
    // La pantalla quiere vaciar el buscador mientras corre la espera: poner otra vez "" en
    // modelValue no cambia nada (ya era ""), así que no alcanza; para eso está vaciar().
    const w = montar()
    const input = w.get('input')
    await input.setValue('lej')
    ;(w.vm as unknown as { vaciar: () => void }).vaciar()
    await w.vm.$nextTick()
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(w.emitted('update:modelValue')).toEqual([['']])
    await vi.advanceTimersByTimeAsync(ESPERA_MS)
    expect(w.emitted('update:modelValue')).toEqual([['']])
    expect(w.find('button').exists()).toBe(false)
    w.unmount()
  })

  it('ronda 1 (b): un eco tardío (asíncrono) de un aviso viejo no pisa lo escrito después', async () => {
    const w = montar()
    const input = w.get('input')
    await input.setValue('lej')
    await vi.advanceTimersByTimeAsync(ESPERA_MS) // avisa "lej"
    await input.setValue('lejia')
    await vi.advanceTimersByTimeAsync(ESPERA_MS) // avisa "lejia"
    await input.setValue('lejias') // sigue escribiendo
    // Recién ahora llegan, en orden, los ecos de "lej" y "lejia".
    await w.setProps({ modelValue: 'lej' })
    expect((input.element as HTMLInputElement).value).toBe('lejias')
    await w.setProps({ modelValue: 'lejia' })
    expect((input.element as HTMLInputElement).value).toBe('lejias')
    // Un cambio que no es eco (la pantalla lo vacía) sí manda.
    await w.setProps({ modelValue: '' })
    expect((input.element as HTMLInputElement).value).toBe('')
    w.unmount()
  })

  it('expone enfocar() para que la pantalla devuelva el foco al buscador', () => {
    const w = montar()
    ;(w.vm as unknown as { enfocar: () => void }).enfocar()
    expect(document.activeElement).toBe(w.get('input').element)
    w.unmount()
  })
})

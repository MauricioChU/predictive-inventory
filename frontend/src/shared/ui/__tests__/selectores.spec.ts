/// <reference lib="es2022.array" />
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { Droplets } from 'lucide-vue-next'
import BotonesDeOpcion from '../componentes/BotonesDeOpcion.vue'
import SelectorSegmentado from '../componentes/SelectorSegmentado.vue'

const ESTADOS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'poco', etiqueta: 'Queda poco' },
  { valor: 'agotados', etiqueta: 'Agotados' },
  { valor: 'archivados', etiqueta: 'Archivados' },
]

type Montar = (modelValue: string | null) => VueWrapper

const montarSegmentado: Montar = (modelValue) =>
  mount(SelectorSegmentado, {
    props: { opciones: ESTADOS, modelValue: modelValue ?? 'nada', etiqueta: 'Mostrar' },
    attachTo: document.body,
  })

const montarBotones: Montar = (modelValue) =>
  mount(BotonesDeOpcion, {
    props: { opciones: ESTADOS, modelValue, etiqueta: 'Mostrar' },
    attachTo: document.body,
  })

const radios = (w: VueWrapper) => w.findAll('[role="radio"]')

describe.each([
  ['SelectorSegmentado', montarSegmentado],
  ['BotonesDeOpcion', montarBotones],
])('%s: grupo de opciones accesible (radiogroup)', (_nombre, montar) => {
  const montados: VueWrapper[] = []
  const abrir = (modelValue: string | null): VueWrapper => {
    const w = montar(modelValue)
    montados.push(w)
    return w
  }
  afterEach(() => {
    for (const w of montados.splice(0)) w.unmount()
  })

  it('RN-UX-15: es un radiogroup con el nombre de su etiqueta visible y una opción "radio" por valor', () => {
    const w = abrir('poco')
    const grupo = w.get('[role="radiogroup"]')
    const idEtiqueta = grupo.attributes('aria-labelledby')!
    expect(w.get(`#${idEtiqueta}`).text()).toBe('Mostrar')
    expect(radios(w).map((r) => r.text())).toEqual([
      'Todos',
      'Queda poco',
      'Agotados',
      'Archivados',
    ])
    expect(radios(w).map((r) => r.element.tagName)).toEqual([
      'BUTTON',
      'BUTTON',
      'BUTTON',
      'BUTTON',
    ])
  })

  it('marca la opción elegida con aria-checked y deja solo esa en el orden de tabulación', () => {
    const w = abrir('poco')
    expect(radios(w).map((r) => r.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ])
    expect(radios(w).map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1', '-1'])
  })

  it('sin ninguna elegida, la primera opción es la que recibe el Tab', () => {
    const w = abrir(null)
    expect(radios(w).map((r) => r.attributes('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ])
    expect(radios(w).map((r) => r.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
  })

  it('RN-UX-05: un toque elige la opción (emite update:modelValue); tocar la ya elegida no emite', async () => {
    const w = abrir('poco')
    await radios(w)[2]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['agotados']])
    await radios(w)[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toHaveLength(1)
  })

  it('las flechas → y ↓ eligen la siguiente y le pasan el foco; desde la última vuelven a la primera', async () => {
    const w = abrir('agotados')
    const agotados = radios(w)[2]!.element as HTMLElement
    agotados.focus()
    await radios(w)[2]!.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['archivados'])
    expect(document.activeElement).toBe(radios(w)[3]!.element)

    await w.setProps({ modelValue: 'archivados' })
    await radios(w)[3]!.trigger('keydown', { key: 'ArrowDown' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['todos'])
    expect(document.activeElement).toBe(radios(w)[0]!.element)
  })

  it('las flechas ← y ↑ eligen la anterior; desde la primera vuelven a la última', async () => {
    const w = abrir('todos')
    await radios(w)[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['archivados'])
    expect(document.activeElement).toBe(radios(w)[3]!.element)

    await w.setProps({ modelValue: 'archivados' })
    await radios(w)[3]!.trigger('keydown', { key: 'ArrowUp' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['agotados'])
  })

  it('las flechas no desplazan la página (preventDefault) y las demás teclas no eligen nada', async () => {
    const w = abrir('todos')
    const flecha = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
    radios(w)[0]!.element.dispatchEvent(flecha)
    expect(flecha.defaultPrevented).toBe(true)

    const letra = new KeyboardEvent('keydown', { key: 'a', cancelable: true })
    radios(w)[1]!.element.dispatchEvent(letra)
    expect(letra.defaultPrevented).toBe(false)
    expect(w.emitted('update:modelValue')).toHaveLength(1)
  })
})

describe('SelectorSegmentado', () => {
  it('con etiquetaOculta, la etiqueta queda solo para el lector de pantalla pero sigue nombrando al grupo', () => {
    const w = mount(SelectorSegmentado, {
      props: { opciones: ESTADOS, modelValue: 'todos', etiqueta: 'Mostrar', etiquetaOculta: true },
    })
    const idEtiqueta = w.get('[role="radiogroup"]').attributes('aria-labelledby')!
    const etiqueta = w.get(`#${idEtiqueta}`)
    expect(etiqueta.text()).toBe('Mostrar')
    expect(etiqueta.classes()).toContain('solo-lector')
  })

  it('acepta valores numéricos (p. ej. semanas)', async () => {
    const w = mount(SelectorSegmentado, {
      props: {
        opciones: [
          { valor: 1, etiqueta: '1 semana' },
          { valor: 4, etiqueta: '4 semanas' },
        ],
        modelValue: 1,
        etiqueta: 'Periodo',
      },
    })
    await w.findAll('[role="radio"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[4]])
  })
})

describe('BotonesDeOpcion', () => {
  const MOTIVOS = [
    { valor: 'DANADO', etiqueta: 'Se dañó' },
    { valor: 'DERRAMADO', etiqueta: 'Se derramó', icono: Droplets },
    { valor: 'VENCIDO', etiqueta: 'Se venció' },
  ]

  it('RN-UX-04: el ícono de la opción acompaña al texto y no se lee (aria-hidden)', () => {
    const w = mount(BotonesDeOpcion, {
      props: { opciones: MOTIVOS, modelValue: null, etiqueta: '¿Qué pasó?' },
    })
    const derramado = w.findAll('[role="radio"]')[1]!
    expect(derramado.text()).toBe('Se derramó')
    const iconos = derramado.findAll('svg')
    expect(iconos.length).toBeGreaterThan(0)
    for (const icono of iconos) expect(icono.attributes('aria-hidden')).toBe('true')
  })

  it('RN-UX-04: la elegida lleva una marca de "elegida" que no es solo color', () => {
    const w = mount(BotonesDeOpcion, {
      props: { opciones: MOTIVOS, modelValue: 'VENCIDO', etiqueta: '¿Qué pasó?' },
    })
    const [danado, , vencido] = w.findAll('[role="radio"]')
    expect(vencido!.find('.marca--elegida').exists()).toBe(true)
    expect(danado!.find('.marca--elegida').exists()).toBe(false)
    expect(danado!.find('.marca').exists()).toBe(true)
  })

  it('RN-UX-07: con error, lo muestra (role="alert"), lo asocia al grupo y lo marca inválido', () => {
    const w = mount(BotonesDeOpcion, {
      props: {
        opciones: MOTIVOS,
        modelValue: null,
        etiqueta: '¿Qué pasó?',
        error: 'Elige qué pasó con el producto.',
      },
    })
    const grupo = w.get('[role="radiogroup"]')
    expect(grupo.attributes('aria-invalid')).toBe('true')
    const error = w.get(`#${grupo.attributes('aria-describedby')!}`)
    expect(error.text()).toBe('Elige qué pasó con el producto.')
    expect(error.attributes('role')).toBe('alert')
  })

  it('sin error, el grupo no está marcado inválido ni tiene descripción', () => {
    const w = mount(BotonesDeOpcion, {
      props: { opciones: MOTIVOS, modelValue: null, etiqueta: '¿Qué pasó?' },
    })
    const grupo = w.get('[role="radiogroup"]')
    expect(grupo.attributes('aria-invalid')).toBeUndefined()
    expect(grupo.attributes('aria-describedby')).toBeUndefined()
  })
})

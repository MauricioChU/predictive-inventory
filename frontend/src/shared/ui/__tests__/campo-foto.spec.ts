import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CampoFoto from '../componentes/CampoFoto.vue'
import FotoDeProducto from '../componentes/FotoDeProducto.vue'
import { elegirArchivo, simularUrlsDeObjeto } from './utilidades-kit-productos'

function boton(w: ReturnType<typeof mount>, texto: string) {
  const encontrado = w.findAll('button').find((b) => b.text() === texto)
  if (!encontrado) throw new Error(`No hay un botón "${texto}"`)
  return encontrado
}

describe('CampoFoto', () => {
  let urls: ReturnType<typeof simularUrlsDeObjeto>
  beforeEach(() => {
    urls = simularUrlsDeObjeto()
  })
  afterEach(() => {
    urls.restaurar()
    document.body.innerHTML = ''
  })

  it('agrupa sus botones bajo la etiqueta (fieldset + legend)', () => {
    const w = mount(CampoFoto, { props: { etiqueta: 'Foto del producto', modelValue: null } })
    expect(w.get('fieldset legend').text()).toBe('Foto del producto')
  })

  it('"Tomar foto" abre la cámara de atrás y "Elegir de la galería", las fotos guardadas', async () => {
    const w = mount(CampoFoto, { props: { etiqueta: 'Foto del producto', modelValue: null } })
    const camara = w.get('input[capture]')
    expect(camara.attributes('capture')).toBe('environment')
    expect(camara.attributes('accept')).toBe('image/*')
    const galeria = w.get('input[type="file"]:not([capture])')
    expect(galeria.attributes('accept')).toBe('image/*')

    const clicCamara = vi.spyOn(camara.element as HTMLInputElement, 'click')
    const clicGaleria = vi.spyOn(galeria.element as HTMLInputElement, 'click')
    await boton(w, 'Tomar foto').trigger('click')
    expect(clicCamara).toHaveBeenCalledTimes(1)
    await boton(w, 'Elegir de la galería').trigger('click')
    expect(clicGaleria).toHaveBeenCalledTimes(1)
  })

  it('los <input type="file"> no reciben foco ni se leen: se usan con los botones visibles', () => {
    const w = mount(CampoFoto, { props: { etiqueta: 'Foto del producto', modelValue: null } })
    for (const input of w.findAll('input[type="file"]')) {
      expect(input.attributes('tabindex')).toBe('-1')
      expect(input.attributes('aria-hidden')).toBe('true')
    }
  })

  it('al elegir una imagen emite update:modelValue con el archivo (sin procesarlo)', async () => {
    const w = mount(CampoFoto, { props: { etiqueta: 'Foto del producto', modelValue: null } })
    const input = w.get('input[capture]')
    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    elegirArchivo(input.element as HTMLInputElement, foto)
    await input.trigger('change')
    expect(w.emitted('update:modelValue')).toEqual([[foto]])
    expect(w.emitted('error')).toBeUndefined()
    // Se vacía el input para que volver a elegir el mismo archivo también avise.
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('RN-UX-07: si el archivo no es una imagen emite error en lenguaje simple y no cambia la foto', async () => {
    const w = mount(CampoFoto, { props: { etiqueta: 'Foto del producto', modelValue: null } })
    const input = w.get('input[type="file"]:not([capture])')
    elegirArchivo(
      input.element as HTMLInputElement,
      new File(['x'], 'lista.pdf', { type: 'application/pdf' }),
    )
    await input.trigger('change')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('error')).toEqual([
      ['Ese archivo no es una foto. Elige una foto de la galería o toma una nueva.'],
    ])
  })

  it('si la persona cierra la cámara sin tomar nada, no pasa nada', async () => {
    const w = mount(CampoFoto, { props: { etiqueta: 'Foto del producto', modelValue: null } })
    const input = w.get('input[capture]')
    elegirArchivo(input.element as HTMLInputElement, null)
    await input.trigger('change')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('error')).toBeUndefined()
  })

  it('con foto: la muestra con FotoDeProducto y ofrece "Quitar foto", que emite null', async () => {
    const foto = new Blob(['x'], { type: 'image/jpeg' })
    const w = mount(CampoFoto, {
      props: { etiqueta: 'Foto del producto', modelValue: foto, nombre: 'Lejía Clorox 1 L' },
      attachTo: document.body,
    })
    const vista = w.getComponent(FotoDeProducto)
    expect(vista.props('imagen')).toBe(foto)
    expect(w.get('img').attributes('alt')).toBe('Lejía Clorox 1 L')
    await boton(w, 'Quitar foto').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[null]])
  })

  it('al quitar la foto el foco no se pierde: va a "Tomar foto"', async () => {
    const w = mount(CampoFoto, {
      props: { etiqueta: 'Foto del producto', modelValue: new Blob(['x']) },
      attachTo: document.body,
    })
    const quitar = boton(w, 'Quitar foto')
    ;(quitar.element as HTMLButtonElement).focus()
    await quitar.trigger('click')
    await w.setProps({ modelValue: null })
    expect(document.activeElement).toBe(boton(w, 'Tomar foto').element)
  })

  it('sin foto no ofrece "Quitar foto" y la vista previa dice que aún no hay foto', () => {
    const w = mount(CampoFoto, { props: { etiqueta: 'Foto del producto', modelValue: null } })
    expect(w.findAll('button').some((b) => b.text() === 'Quitar foto')).toBe(false)
    expect(w.text()).toContain('Todavía no tiene foto')
    // El ícono de la vista previa vacía es decorativo: ya lo dice el texto.
    expect(w.getComponent(FotoDeProducto).props('decorativa')).toBe(true)
  })
})

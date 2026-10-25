import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CarruselDeAvisos, { type AvisoDelCarrusel } from '../componentes/CarruselDeAvisos.vue'

const TRES: AvisoDelCarrusel[] = [
  { id: 'a', tono: 'atencion', texto: '4 productos se acaban', textoAccion: 'Ver productos' },
  { id: 'b', tono: 'info', texto: 'Hace 9 días que no guardas una copia' },
  { id: 'c', tono: 'exito', texto: 'Todo en orden' },
]

describe('CarruselDeAvisos', () => {
  it('con un solo aviso es solo la fila: sin controles ni posición', () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: [TRES[0]!], etiqueta: 'Avisos' } })
    expect(carrusel.text()).toContain('4 productos se acaban')
    expect(carrusel.find('.controles').exists()).toBe(false)
    expect(carrusel.text()).not.toContain(' de ')
  })

  it('con varios muestra uno, "1 de 3", y ‹ › lo cambian dando la vuelta', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    expect(carrusel.text()).toContain('1 de 3')
    expect(carrusel.text()).toContain('4 productos se acaban')
    expect(carrusel.text()).not.toContain('Todo en orden')

    await carrusel.get('[aria-label="Aviso siguiente"]').trigger('click')
    expect(carrusel.text()).toContain('2 de 3')
    expect(carrusel.text()).toContain('que no guardas')

    await carrusel.get('[aria-label="Aviso anterior"]').trigger('click')
    await carrusel.get('[aria-label="Aviso anterior"]').trigger('click')
    expect(carrusel.text()).toContain('3 de 3')
    expect(carrusel.text()).toContain('Todo en orden')
  })

  it('los puntos son botones "Aviso N de M" que llevan a ese aviso; el actual va marcado', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    const puntos = carrusel.findAll('.punto')
    expect(puntos.map((p) => p.attributes('aria-label'))).toEqual([
      'Aviso 1 de 3',
      'Aviso 2 de 3',
      'Aviso 3 de 3',
    ])
    expect(puntos.map((p) => p.attributes('aria-current'))).toEqual(['true', undefined, undefined])
    await puntos[2]!.trigger('click')
    expect(carrusel.text()).toContain('Todo en orden')
    expect(carrusel.findAll('.punto')[2]!.attributes('aria-current')).toBe('true')
  })

  it('es una región con nombre y la acción del aviso lleva su id', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    expect(carrusel.get('section').attributes('aria-label')).toBe('Avisos')
    await carrusel.get('[aria-label="Ver productos"]').trigger('click')
    expect(carrusel.emitted('accion')).toEqual([['a']])
  })

  it('si quedan menos avisos, no se queda en uno que ya no existe', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    await carrusel.get('[aria-label="Aviso anterior"]').trigger('click')
    await carrusel.setProps({ avisos: [TRES[0]!] })
    expect(carrusel.text()).toContain('4 productos se acaban')
    expect(carrusel.find('.controles').exists()).toBe(false)
  })
})

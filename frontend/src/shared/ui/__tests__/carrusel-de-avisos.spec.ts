import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CarruselDeAvisos, { type AvisoDelCarrusel } from '../componentes/CarruselDeAvisos.vue'

const TRES: AvisoDelCarrusel[] = [
  { id: 'a', tono: 'atencion', texto: '4 productos se acaban', textoAccion: 'Ver productos' },
  {
    id: 'b',
    tono: 'info',
    texto: 'Hace 9 días que no guardas una copia',
    textoAccion: 'Guardar copia',
  },
  { id: 'c', tono: 'exito', texto: 'Todo en orden' },
]

const SIGUIENTE = '.paso'

describe('CarruselDeAvisos', () => {
  it('con un solo aviso es solo el bloque tocable: sin flecha de siguiente ni contador', () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: [TRES[0]!], etiqueta: 'Avisos' } })
    expect(carrusel.text()).toContain('4 productos se acaban')
    expect(carrusel.find(SIGUIENTE).exists()).toBe(false)
    expect(carrusel.find('.contador').exists()).toBe(false)
    expect(carrusel.findAll('button')).toHaveLength(1)
  })

  it('con varios muestra uno, «1/3», y la flecha pasa al siguiente dando la vuelta', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    expect(carrusel.get('.contador').text()).toBe('1/3')
    expect(carrusel.text()).toContain('4 productos se acaban')
    expect(carrusel.text()).not.toContain('Todo en orden')
    expect(carrusel.get(SIGUIENTE).attributes('aria-label')).toBe('Siguiente aviso, 2 de 3')

    await carrusel.get(SIGUIENTE).trigger('click')
    expect(carrusel.get('.contador').text()).toBe('2/3')
    expect(carrusel.text()).toContain('que no guardas')
    await carrusel.get(SIGUIENTE).trigger('click')
    expect(carrusel.text()).toContain('Todo en orden')
    expect(carrusel.get(SIGUIENTE).attributes('aria-label')).toBe('Siguiente aviso, 1 de 3')
    await carrusel.get(SIGUIENTE).trigger('click')
    expect(carrusel.get('.contador').text()).toBe('1/3')
    expect(carrusel.text()).toContain('4 productos se acaban')
  })

  it('el bloque entero es un botón con el nombre de la acción y la flecha es su hermano, no un hijo', () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    const aviso = carrusel.get('button.aviso')
    expect(aviso.attributes('aria-label')).toBe('Ver productos')
    expect(aviso.find('button').exists()).toBe(false)
    expect(aviso.element.contains(carrusel.get(SIGUIENTE).element)).toBe(false)
    expect(carrusel.findAll('button')).toHaveLength(2)
  })

  it('un aviso sin acción no es tocable', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    await carrusel.get(SIGUIENTE).trigger('click')
    await carrusel.get(SIGUIENTE).trigger('click')
    expect(carrusel.find('button.aviso').exists()).toBe(false)
    expect(carrusel.text()).toContain('Todo en orden')
  })

  it('es una región con nombre y tocar el bloque emite el id del aviso', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    expect(carrusel.get('section').attributes('aria-label')).toBe('Avisos')
    await carrusel.get('[aria-label="Ver productos"]').trigger('click')
    expect(carrusel.emitted('accion')).toEqual([['a']])
  })

  it('si quedan menos avisos, no se queda en uno que ya no existe', async () => {
    const carrusel = mount(CarruselDeAvisos, { props: { avisos: TRES, etiqueta: 'Avisos' } })
    await carrusel.get(SIGUIENTE).trigger('click')
    await carrusel.get(SIGUIENTE).trigger('click')
    await carrusel.setProps({ avisos: [TRES[0]!] })
    expect(carrusel.text()).toContain('4 productos se acaban')
    expect(carrusel.find(SIGUIENTE).exists()).toBe(false)
  })

  it('si bajan a un aviso con el foco en «siguiente», el foco pasa al bloque', async () => {
    const carrusel = mount(CarruselDeAvisos, {
      props: { avisos: TRES, etiqueta: 'Avisos' },
      attachTo: document.body,
    })
    ;(carrusel.get(SIGUIENTE).element as HTMLElement).focus()
    await carrusel.setProps({ avisos: [TRES[0]!] })
    await carrusel.vm.$nextTick()
    expect(document.activeElement).toBe(carrusel.get('button.aviso').element)
    carrusel.unmount()
  })
})

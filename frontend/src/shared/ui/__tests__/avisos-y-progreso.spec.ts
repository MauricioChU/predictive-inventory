import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AvisoEnPagina from '../componentes/AvisoEnPagina.vue'
import BarraDeProgreso from '../componentes/BarraDeProgreso.vue'
import MensajeDeError from '../componentes/MensajeDeError.vue'

const NBSP = '\u00A0'

describe('AvisoEnPagina', () => {
  it('RN-UX-04: ícono (que no se lee) + título + texto, con el aspecto de su tono', () => {
    const w = mount(AvisoEnPagina, {
      props: { tono: 'atencion', titulo: '4 productos se acaban', texto: 'Revisa la lista' },
    })
    expect(w.classes()).toContain('aviso-en-pagina--atencion')
    expect(w.get('.titulo').text()).toBe('4 productos se acaban')
    expect(w.get('.texto').text()).toBe('Revisa la lista')
    const iconos = w.findAll('svg')
    expect(iconos.length).toBeGreaterThan(0)
    for (const icono of iconos) expect(icono.attributes('aria-hidden')).toBe('true')
  })

  it('RN-UX-09: los montos y cantidades del título y del texto no se parten entre líneas', () => {
    const w = mount(AvisoEnPagina, {
      props: {
        tono: 'exito',
        titulo: 'Hoy vendiste S/ 1 162.50',
        texto: 'Vendiste S/ 162.50 y ganaste S/ 48.20.',
      },
    })
    expect(w.get('.titulo').text()).toBe(`Hoy vendiste S/${NBSP}1${NBSP}162.50`)
    expect(w.get('.texto').text()).toBe(`Vendiste S/${NBSP}162.50 y ganaste S/${NBSP}48.20.`)
  })

  it('es contenido normal de la página: no es una región viva (no se anuncia solo al cargar)', () => {
    const w = mount(AvisoEnPagina, { props: { tono: 'info', titulo: 'Guarda una copia' } })
    expect(w.find('[role="alert"], [role="status"], [aria-live]').exists()).toBe(false)
  })

  it('con textoAccion, un botón con ese texto emite accion', async () => {
    const w = mount(AvisoEnPagina, {
      props: { tono: 'atencion', titulo: '4 productos se acaban', textoAccion: 'Ver qué comprar' },
    })
    const botones = w.findAll('button')
    expect(botones.map((b) => b.text())).toEqual(['Ver qué comprar'])
    await botones[0]!.trigger('click')
    expect(w.emitted('accion')).toHaveLength(1)
    expect(w.emitted('cerrar')).toBeUndefined()
  })

  it('con textoCerrar, un botón visible con ese texto (no solo una ✕) emite cerrar', async () => {
    const w = mount(AvisoEnPagina, {
      props: { tono: 'exito', titulo: 'Hoy vendiste S/ 162.50', textoCerrar: 'Cerrar' },
    })
    const botones = w.findAll('button')
    expect(botones.map((b) => b.text())).toEqual(['Cerrar'])
    await botones[0]!.trigger('click')
    expect(w.emitted('cerrar')).toHaveLength(1)
  })

  it('con acción y cierre, primero la acción y luego el cierre; sin ninguno, no hay botones', () => {
    const ambos = mount(AvisoEnPagina, {
      props: {
        tono: 'info',
        titulo: 'Hace 9 días que no guardas una copia',
        textoAccion: 'Guardar copia',
        textoCerrar: 'Ahora no',
      },
    })
    expect(ambos.findAll('button').map((b) => b.text())).toEqual(['Guardar copia', 'Ahora no'])
    const ninguno = mount(AvisoEnPagina, { props: { tono: 'info', titulo: 'Listo' } })
    expect(ninguno.find('button').exists()).toBe(false)
    expect(ninguno.find('.texto').exists()).toBe(false)
  })
})

describe('MensajeDeError', () => {
  it('RN-UX-07: muestra el mensaje del dominio tal cual y la ayuda, como alerta', () => {
    const w = mount(MensajeDeError, {
      props: {
        mensaje: 'Solo quedan 2 unid. de Lejía 1 L.',
        ayuda: 'Cambia la cantidad o registra la llegada de mercadería.',
      },
    })
    expect(w.attributes('role')).toBe('alert')
    // "Tal cual": las mismas palabras (los espacios de las cantidades no cortan la línea).
    const sinNbsp = (texto: string) => texto.replaceAll(NBSP, ' ')
    expect(sinNbsp(w.get('.mensaje').text())).toBe('Solo quedan 2 unid. de Lejía 1 L.')
    expect(w.get('.ayuda').text()).toBe('Cambia la cantidad o registra la llegada de mercadería.')
    for (const icono of w.findAll('svg')) expect(icono.attributes('aria-hidden')).toBe('true')
  })

  it('RN-UX-09: las cantidades del mensaje no se parten entre líneas ("2 unid.", "1 L")', () => {
    const w = mount(MensajeDeError, {
      props: { mensaje: 'Solo quedan 2 unid. de Lejía 1 L.', ayuda: 'Vende hasta 2 unid.' },
    })
    expect(w.get('.mensaje').text()).toBe(`Solo quedan 2${NBSP}unid. de Lejía 1${NBSP}L.`)
    expect(w.get('.ayuda').text()).toBe(`Vende hasta 2${NBSP}unid.`)
  })

  it('sin ayuda, solo el mensaje', () => {
    const w = mount(MensajeDeError, { props: { mensaje: 'Escribe el nombre del producto.' } })
    expect(w.find('.ayuda').exists()).toBe(false)
  })

  it('pasa los atributos (p. ej. un id para aria-describedby de un campo)', () => {
    const w = mount(MensajeDeError, { props: { mensaje: 'Algo pasó.' }, attrs: { id: 'error-1' } })
    expect(w.attributes('id')).toBe('error-1')
  })
})

describe('BarraDeProgreso', () => {
  it('RN-UX-15: es un progressbar con nombre, valores y el texto "Llevas 1 de 3"', () => {
    const w = mount(BarraDeProgreso, { props: { actual: 1, total: 3, texto: 'Llevas 1 de 3' } })
    const barra = w.get('[role="progressbar"]')
    expect(barra.attributes()).toMatchObject({
      'aria-label': 'Avance',
      'aria-valuemin': '0',
      'aria-valuemax': '3',
      'aria-valuenow': '1',
      'aria-valuetext': 'Llevas 1 de 3',
    })
  })

  it('el texto se ve, pero no se lee dos veces (ya lo dice el progressbar)', () => {
    const w = mount(BarraDeProgreso, { props: { actual: 1, total: 3, texto: 'Llevas 1 de 3' } })
    const visible = w.get('.texto')
    expect(visible.text()).toBe('Llevas 1 de 3')
    expect(visible.attributes('aria-hidden')).toBe('true')
  })

  it('acepta otro nombre para el progressbar', () => {
    const w = mount(BarraDeProgreso, {
      props: { actual: 23, total: 80, texto: 'Llevas 23 de 80', etiqueta: 'Conteo' },
    })
    expect(w.get('[role="progressbar"]').attributes('aria-label')).toBe('Conteo')
  })

  it.each([0, -3])(
    'M6: con total %d el máximo es 1 (nunca 0 ni negativo) y el valor se acota a él',
    (total) => {
      const w = mount(BarraDeProgreso, { props: { actual: 0, total, texto: 'Nada que contar' } })
      const barra = w.get('[role="progressbar"]')
      expect(barra.attributes('aria-valuemax')).toBe('1')
      expect(barra.attributes('aria-valuenow')).toBe('0')
      const conAvance = mount(BarraDeProgreso, { props: { actual: 4, total, texto: 'Listo' } })
      expect(conAvance.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('1')
    },
  )

  it('el relleno es la fracción hecha', () => {
    const w = mount(BarraDeProgreso, { props: { actual: 1, total: 4, texto: 'Llevas 1 de 4' } })
    expect(w.get('.relleno').attributes('style')).toContain('scaleX(0.25)')
  })

  it.each([
    [5, 3, '3', 'scaleX(1)'],
    [-2, 3, '0', 'scaleX(0)'],
    [0, 0, '0', 'scaleX(0)'],
  ])('actual %d de %d: se acota a lo posible (valuenow %s, %s)', (actual, total, ahora, escala) => {
    const w = mount(BarraDeProgreso, { props: { actual, total, texto: 'Llevas' } })
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBe(ahora)
    expect(w.get('.relleno').attributes('style')).toContain(escala)
  })
})

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLAVE_ANUNCIADOR, crearAnunciador, ESPERA_ANUNCIO_MS } from '../anunciador'
import FilaDeDato from '../componentes/FilaDeDato.vue'
import RespuestaGrande from '../componentes/RespuestaGrande.vue'
import TarjetaDeCifra from '../componentes/TarjetaDeCifra.vue'

const NBSP = ' '

function proveer(anunciador: ReturnType<typeof crearAnunciador>) {
  return { provide: { [CLAVE_ANUNCIADOR as unknown as string]: anunciador } }
}

describe('TarjetaDeCifra', () => {
  it('título y cifra van en una sola frase ("Hoy ganaste S/ 48.20"); el detalle, aparte', () => {
    const w = mount(TarjetaDeCifra, {
      props: { titulo: 'Hoy ganaste', textoValor: 'S/ 48.20', textoDetalle: 'Vendiste S/ 162.50' },
    })
    const parrafos = w.findAll('p')
    expect(parrafos.map((p) => p.text())).toEqual([
      `Hoy ganaste S/${NBSP}48.20`,
      `Vendiste S/${NBSP}162.50`,
    ])
    expect(w.get('.valor').text()).toBe(`S/${NBSP}48.20`)
  })

  it('sin detalle, no deja un párrafo vacío', () => {
    const w = mount(TarjetaDeCifra, { props: { titulo: 'Vendiste', textoValor: 'S/ 162.50' } })
    expect(w.findAll('p')).toHaveLength(1)
  })

  it('RN-UX-09: el monto nunca se parte y la letra se ajusta a su largo (--caracteres)', () => {
    const w = mount(TarjetaDeCifra, { props: { titulo: 'Vendiste', textoValor: 'S/ 12 345.67' } })
    const valor = w.get('.valor')
    expect(valor.text()).toBe(`S/${NBSP}12${NBSP}345.67`)
    expect(valor.attributes('style')).toContain('--caracteres: 12')
  })

  it('RN-UX-04: el tono solo cambia el aspecto; lo que dice la tarjeta es igual en todos', () => {
    const textos = (['normal', 'exito', 'peligro'] as const).map((tono) => {
      const w = mount(TarjetaDeCifra, {
        props: { titulo: 'Perdiste', textoValor: 'S/ 3.00', tono },
      })
      expect(w.classes()).toContain(`tarjeta-de-cifra--${tono}`)
      return w.text()
    })
    expect(new Set(textos).size).toBe(1)
  })

  it('por omisión el tono es normal', () => {
    const w = mount(TarjetaDeCifra, { props: { titulo: 'Vendiste', textoValor: 'S/ 1.00' } })
    expect(w.classes()).toContain('tarjeta-de-cifra--normal')
  })
})

describe('FilaDeDato', () => {
  it('es un par etiqueta/valor semántico (dl > dt + dd) y el valor no se parte', () => {
    const w = mount(FilaDeDato, { props: { etiqueta: 'Stock', textoValor: '12 unid.' } })
    expect(w.element.tagName).toBe('DL')
    expect(w.get('dt').text()).toBe('Stock')
    expect(w.get('dd').text()).toBe(`12${NBSP}unid.`)
    expect(w.classes()).not.toContain('fila-de-dato--destacado')
  })

  it('destacado: lo marca para letra más grande y negrita (no solo color)', () => {
    const w = mount(FilaDeDato, {
      props: { etiqueta: 'Total', textoValor: 'S/ 14.63', destacado: true },
    })
    expect(w.classes()).toContain('fila-de-dato--destacado')
  })
})

describe('RespuestaGrande ("¿Necesito comprar?")', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('muestra la frase entera, con la cantidad pegada a su unidad, y el ícono no se lee', () => {
    const w = mount(RespuestaGrande, { props: { texto: 'Sí, compra ~12 unid.', tono: 'atencion' } })
    const texto = w.get('.texto')
    expect(texto.text()).toBe(`Sí, compra ~12${NBSP}unid.`)
    expect(texto.attributes('style')).toContain('--caracteres: 9')
    expect(w.classes()).toContain('respuesta-grande--atencion')
    for (const icono of w.findAll('svg')) expect(icono.attributes('aria-hidden')).toBe('true')
  })

  it('RN-UX-15: al aparecer, anuncia la frase con el anunciador global (no con su propia región viva)', async () => {
    const anunciador = crearAnunciador()
    const w = mount(RespuestaGrande, {
      props: { texto: 'No hace falta: te alcanza para ~20 días', tono: 'exito' },
      global: proveer(anunciador),
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('No hace falta: te alcanza para ~20 días')
    expect(w.find('[aria-live]').exists()).toBe(false)
    expect(w.find('[role="status"], [role="alert"]').exists()).toBe(false)
  })

  it('RN-UX-15: al cambiar la frase (otro producto), anuncia la nueva en lugar de la anterior', async () => {
    const anunciador = crearAnunciador()
    const w = mount(RespuestaGrande, {
      props: { texto: 'Sí, compra ~12 unid.', tono: 'atencion' },
      global: proveer(anunciador),
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    await w.setProps({ texto: 'No compres: no se vende hace 45 días', tono: 'peligro' })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('No compres: no se vende hace 45 días')
  })

  it('al irse retira su anuncio, pero no uno más nuevo de otra pantalla', async () => {
    const anunciador = crearAnunciador()
    const primera = mount(RespuestaGrande, {
      props: { texto: 'Sí, compra ~12 unid.', tono: 'atencion' },
      global: proveer(anunciador),
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    primera.unmount()
    expect(anunciador.texto.value).toBe('')

    const segunda = mount(RespuestaGrande, {
      props: { texto: 'Sí, compra ~12 unid.', tono: 'atencion' },
      global: proveer(anunciador),
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    anunciador.anunciar('Producto guardado')
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    segunda.unmount()
    expect(anunciador.texto.value).toBe('Producto guardado')
  })

  it('sin anunciador provisto, no falla y muestra la frase', () => {
    const w = mount(RespuestaGrande, { props: { texto: 'Sí, compra ~12 unid.', tono: 'atencion' } })
    expect(w.text()).toContain('Sí, compra')
    expect(() => w.unmount()).not.toThrow()
  })
})

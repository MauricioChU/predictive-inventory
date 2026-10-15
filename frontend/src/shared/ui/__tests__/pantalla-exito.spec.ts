import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLAVE_ANUNCIADOR, crearAnunciador, ESPERA_ANUNCIO_MS } from '@/app/anunciador'
import PantallaExito from '../componentes/PantallaExito.vue'

function proveer(anunciador: ReturnType<typeof crearAnunciador>) {
  return { provide: { [CLAVE_ANUNCIADOR as unknown as string]: anunciador } }
}

describe('PantallaExito (hallazgo 4)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('al montarse, anuncia título y detalle con el anunciador inyectado y enfoca su <h1>', async () => {
    const anunciador = crearAnunciador()
    const w = mount(PantallaExito, {
      props: { titulo: 'Venta registrada', detalle: 'Total S/ 14.63' },
      global: proveer(anunciador),
      attachTo: document.body,
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada. Total S/ 14.63')
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
  })

  it('con solo título (sin detalle), anuncia solo el título', async () => {
    const anunciador = crearAnunciador()
    mount(PantallaExito, { props: { titulo: 'Venta registrada' }, global: proveer(anunciador) })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada')
  })

  it('m7: al desmontarse limpia su mensaje de la región viva (no deja texto viejo)', async () => {
    const anunciador = crearAnunciador()
    const w = mount(PantallaExito, {
      props: { titulo: 'Venta registrada' },
      global: proveer(anunciador),
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada')
    w.unmount()
    expect(anunciador.texto.value).toBe('')
  })

  it('m7: al desmontarse no borra un anuncio más nuevo de otra pantalla', async () => {
    const anunciador = crearAnunciador()
    const w = mount(PantallaExito, {
      props: { titulo: 'Venta registrada' },
      global: proveer(anunciador),
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    anunciador.anunciar('Producto guardado')
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    w.unmount()
    expect(anunciador.texto.value).toBe('Producto guardado')
  })

  it('sin anunciador provisto (p. ej. montado solo en un test), no falla y sigue mostrando el contenido', () => {
    expect(() =>
      mount(PantallaExito, { props: { titulo: 'Venta registrada' } }).unmount(),
    ).not.toThrow()
  })
})

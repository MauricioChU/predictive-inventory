import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearContextoAvisoDeshacer } from '@/app/aviso-deshacer'
import { exponerGanchosDePrueba } from '@/app/ganchos-de-prueba'
import { crearAnunciador, ESPERA_ANUNCIO_MS } from '../anunciador'
import CatalogoKitPaneles from '../__catalogo__/CatalogoKitPaneles.vue'

const COMPONENTES = [
  'SelectorSegmentado',
  'BotonesDeOpcion',
  'TarjetaDeCifra',
  'AvisoEnPagina',
  'ListaAgrupadaPorDia',
  'BarraDeProgreso',
  'MensajeDeError',
  'FilaDeDato',
  'RespuestaGrande',
]

describe('Catálogo del kit B (solo pruebas)', () => {
  afterEach(() => {
    vi.useRealTimers()
    delete window.__pruebas
    document.body.innerHTML = ''
  })

  it('muestra una sección (h2) por cada componente del kit', () => {
    const w = mount(CatalogoKitPaneles)
    expect(w.findAll('h2').map((h2) => h2.text())).toEqual(COMPONENTES)
  })

  it('RespuestaGrande se anuncia en la región viva del catálogo al cambiar de respuesta', async () => {
    vi.useFakeTimers()
    const w = mount(CatalogoKitPaneles, { attachTo: document.body })
    const region = w.get('[data-prueba="anuncios-del-catalogo"]')
    expect(region.attributes('role')).toBe('status')
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(region.text()).toBe('Sí, compra ~12 unid.')

    const alcanza = w.findAll('[role="radio"]').find((r) => r.text() === 'Alcanza')!
    await alcanza.trigger('click')
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(region.text()).toBe('No hace falta: te alcanza para ~20 días')
    w.unmount()
  })

  it('el gancho de pruebas lo monta al final de #contenido con mostrarCatalogo("paneles")', async () => {
    document.body.innerHTML = '<main id="contenido"><p>Pantalla</p></main>'
    const retirar = exponerGanchosDePrueba(crearContextoAvisoDeshacer(crearAnunciador()))
    await window.__pruebas?.mostrarCatalogo('paneles')
    await flushPromises()
    const contenido = document.getElementById('contenido')!
    expect(contenido.firstElementChild?.textContent).toBe('Pantalla')
    expect(contenido.querySelector('.catalogo-kit-paneles h2')?.textContent).toBe(
      'SelectorSegmentado',
    )
    retirar()
  })

  it('el gancho rechaza un catálogo que no existe', async () => {
    document.body.innerHTML = '<main id="contenido"></main>'
    const retirar = exponerGanchosDePrueba(crearContextoAvisoDeshacer(crearAnunciador()))
    await expect(window.__pruebas?.mostrarCatalogo('inexistente')).rejects.toThrow(
      'No hay un catálogo "inexistente"',
    )
    retirar()
  })
})

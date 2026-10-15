import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { CLAVE_ANUNCIADOR, crearAnunciador } from '@/app/anunciador'
import PantallaExito from '../componentes/PantallaExito.vue'

describe('PantallaExito (hallazgo 4)', () => {
  it('al montarse, anuncia título y detalle con el anunciador inyectado y enfoca su <h1>', async () => {
    const anunciador = crearAnunciador()
    const w = mount(PantallaExito, {
      props: { titulo: 'Venta registrada', detalle: 'Total S/ 14.63' },
      global: { provide: { [CLAVE_ANUNCIADOR as unknown as string]: anunciador } },
      attachTo: document.body,
    })
    await nextTick()
    expect(anunciador.texto.value).toBe('Venta registrada. Total S/ 14.63')
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
  })

  it('con solo título (sin detalle), anuncia solo el título', async () => {
    const anunciador = crearAnunciador()
    mount(PantallaExito, {
      props: { titulo: 'Venta registrada' },
      global: { provide: { [CLAVE_ANUNCIADOR as unknown as string]: anunciador } },
    })
    await nextTick()
    expect(anunciador.texto.value).toBe('Venta registrada')
  })

  it('sin anunciador provisto (p. ej. montado solo en un test), no falla y sigue mostrando el contenido', () => {
    expect(() => mount(PantallaExito, { props: { titulo: 'Venta registrada' } })).not.toThrow()
  })
})

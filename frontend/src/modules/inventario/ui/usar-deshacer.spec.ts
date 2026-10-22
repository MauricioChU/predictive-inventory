import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { CLAVE_APLICACION } from '@/app/proveer-aplicacion'
import { CLAVE_AVISO_DESHACER, crearContextoAvisoDeshacer } from '@/app/aviso-deshacer'
import { CLAVE_ANUNCIADOR, crearAnunciador } from '@/shared/ui/anunciador'
import { usarDeshacer } from './usar-deshacer'

/** RN-OP-18: la oferta en pantalla dura 10 s, no usa el aviso global y muere al irse. */
describe('usarDeshacer con enPantalla', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function montar() {
    const anunciador = crearAnunciador()
    const aviso = crearContextoAvisoDeshacer(anunciador)
    const ejecutar = vi.fn(async () => {})
    let api!: ReturnType<typeof usarDeshacer>
    const Host = defineComponent({
      setup() {
        api = usarDeshacer()
        return () => h('div')
      },
    })
    const w = mount(Host, {
      global: {
        provide: {
          [CLAVE_APLICACION as symbol]: {},
          [CLAVE_AVISO_DESHACER as symbol]: aviso,
          [CLAVE_ANUNCIADOR as symbol]: anunciador,
        },
      },
    })
    const oferta = { mensaje: 'Venta registrada', ejecutar, alDeshacer: () => 'Deshiciste' }
    return { api, aviso, w, ejecutar, oferta }
  }

  it('cuenta hacia atrás, no abre el aviso global y desaparece a los 10 s', async () => {
    const { api, aviso, oferta } = montar()
    api.ofrecer(oferta, { enPantalla: true })
    expect(api.restante.value).toBe(10)
    expect(aviso.activo.value).toBeUndefined()
    await vi.advanceTimersByTimeAsync(3000)
    expect(api.restante.value).toBe(7)
    await vi.advanceTimersByTimeAsync(7000)
    expect(api.restante.value).toBeUndefined()
  })

  it('deshacerAqui ejecuta y retira el botón; irse de la pantalla cancela la oferta', async () => {
    const a = montar()
    a.api.ofrecer(a.oferta, { enPantalla: true })
    a.api.deshacerAqui()
    await vi.advanceTimersByTimeAsync(0)
    expect(a.ejecutar).toHaveBeenCalledOnce()
    expect(a.api.restante.value).toBeUndefined()
    expect(a.aviso.resultado.value?.titulo).toBe('Deshiciste')

    const b = montar()
    b.api.ofrecer(b.oferta, { enPantalla: true })
    b.w.unmount()
    expect(b.api.restante.value).toBeUndefined()
  })
})

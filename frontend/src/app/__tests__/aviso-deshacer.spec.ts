import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvisoDeshacer from '../../shared/ui/componentes/AvisoDeshacer.vue'
import { crearAnunciador, ESPERA_ANUNCIO_MS } from '@/shared/ui/anunciador'
import { CLAVE_AVISO_DESHACER, crearContextoAvisoDeshacer } from '../aviso-deshacer'

/** Arnés mínimo que reproduce cómo LayoutApp consume el contexto: monta <AvisoDeshacer>
 * con :key = activo.id, para que cada mostrar() dentro de los 10 s obtenga una instancia
 * (y un temporizador) nuevos en vez de reutilizar los del aviso anterior (Q1). */
function montarArnes() {
  const anunciador = crearAnunciador()
  const contexto = crearContextoAvisoDeshacer(anunciador)
  const Arnes = defineComponent({
    setup() {
      return () =>
        contexto.activo.value
          ? h(AvisoDeshacer, {
              key: contexto.activo.value.id,
              mensaje: contexto.activo.value.mensaje,
              segundos: contexto.activo.value.segundos,
              onDeshacer: () => {
                contexto.activo.value?.alDeshacer()
                contexto.cerrar()
              },
              onCerrar: () => contexto.cerrar(),
            })
          : null
    },
  })
  const w = mount(Arnes, {
    global: { provide: { [CLAVE_AVISO_DESHACER as unknown as string]: contexto } },
  })
  return { w, contexto, anunciador }
}

describe('RN-OP-18: contexto de aviso Deshacer (Q1)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('activo empieza indefinido y mostrar() lo activa con un id', () => {
    const { contexto } = montarArnes()
    expect(contexto.activo.value).toBeUndefined()
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: vi.fn<() => void>() })
    expect(contexto.activo.value?.mensaje).toBe('Venta registrada')
    expect(contexto.activo.value?.id).toBeTypeOf('number')
  })

  it('cada mostrar() tiene un id distinto', () => {
    const { contexto } = montarArnes()
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: vi.fn<() => void>() })
    const primerId = contexto.activo.value?.id
    contexto.cerrar()
    contexto.mostrar({ mensaje: 'Otra venta', alDeshacer: vi.fn<() => void>() })
    expect(contexto.activo.value?.id).not.toBe(primerId)
  })

  it('cerrar() limpia el aviso activo', () => {
    const { contexto } = montarArnes()
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: vi.fn<() => void>() })
    contexto.cerrar()
    expect(contexto.activo.value).toBeUndefined()
  })

  it('anuncia solo el mensaje (sin el número que cambia cada segundo) vía el anunciador compartido (Q2)', async () => {
    const { contexto, anunciador } = montarArnes()
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: vi.fn<() => void>() })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada. Puedes deshacer durante 10 segundos.')
  })

  it('cerrar() limpia el anunciador (hallazgo 3: no deja texto viejo)', async () => {
    const { contexto, anunciador } = montarArnes()
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: vi.fn<() => void>() })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada. Puedes deshacer durante 10 segundos.')
    contexto.cerrar()
    expect(anunciador.texto.value).toBe('')
  })

  it('N4: si PantallaExito anuncia en el mismo flujo, se oyen los dos mensajes (no se pierde "Puedes deshacer")', async () => {
    const { contexto, anunciador } = montarArnes()
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: vi.fn<() => void>() })
    anunciador.anunciar('Venta registrada. Total S/ 14.63') // lo que haría PantallaExito al montarse
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe(
      'Venta registrada. Puedes deshacer durante 10 segundos. Venta registrada. Total S/ 14.63',
    )
  })

  it('N4: al cerrarse a los 10 s no borra un anuncio más nuevo de otra pantalla', async () => {
    const { contexto, anunciador } = montarArnes()
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: vi.fn<() => void>() })
    await vi.advanceTimersByTimeAsync(3000)
    anunciador.anunciar('Producto guardado')
    await vi.advanceTimersByTimeAsync(7000) // el aviso se cierra solo
    expect(contexto.activo.value).toBeUndefined()
    expect(anunciador.texto.value).toBe('Producto guardado')
  })

  it('un segundo mostrar() dentro de los 10 s recibe los 10 s completos y no lo cierra el temporizador del primero', async () => {
    const alDeshacer1 = vi.fn<() => void>()
    const alDeshacer2 = vi.fn<() => void>()
    const { w, contexto } = montarArnes()

    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: alDeshacer1 })
    await vi.advanceTimersByTimeAsync(7000) // quedan ~3 s del primer aviso

    contexto.mostrar({ mensaje: 'Otra venta', alDeshacer: alDeshacer2 }) // debe reiniciar a 10 s completos
    await nextTick()
    expect(w.text()).toContain('Deshacer')

    // En el escenario roto, el temporizador viejo (creado en t=0, 10 s) cerraría el aviso aquí.
    await vi.advanceTimersByTimeAsync(3000)
    expect(contexto.activo.value).toBeDefined()
    expect(contexto.activo.value?.mensaje).toBe('Otra venta')

    // Complementa los 10 s reales del segundo aviso: ahora sí debe cerrarse solo.
    await vi.advanceTimersByTimeAsync(7000)
    expect(contexto.activo.value).toBeUndefined()
    expect(alDeshacer1).not.toHaveBeenCalled()
    expect(alDeshacer2).not.toHaveBeenCalled()
  })
})

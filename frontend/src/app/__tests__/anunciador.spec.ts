import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearAnunciador, ESPERA_ANUNCIO_MS } from '../anunciador'

describe('anunciador (RN-UX-15): avisos repetidos y limpieza', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('empieza vacío', () => {
    const anunciador = crearAnunciador()
    expect(anunciador.texto.value).toBe('')
  })

  it('anunciar() vacía la región en el acto y escribe el texto ~100 ms después (nunca en el mismo frame)', () => {
    const anunciador = crearAnunciador()
    anunciador.anunciar('Venta registrada')
    expect(anunciador.texto.value).toBe('')
    vi.advanceTimersByTime(99)
    expect(anunciador.texto.value).toBe('') // ni el mismo frame ni el siguiente
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS - 99)
    expect(anunciador.texto.value).toBe('Venta registrada')
  })

  it('el mismo mensaje dos veces produce dos anuncios reales: vacía y vuelve a poner el texto cada vez', () => {
    const anunciador = crearAnunciador()

    anunciador.anunciar('Venta registrada')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada')

    anunciador.anunciar('Venta registrada') // mismo mensaje otra vez, ya fuera de la ventana
    expect(anunciador.texto.value).toBe('') // se vuelve a vaciar: el lector de pantalla SÍ nota el cambio
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada')
  })

  it('N4: los mensajes que llegan en menos de 150 ms se unen en un solo anuncio (no gana solo el último)', () => {
    const anunciador = crearAnunciador()
    anunciador.anunciar('Venta registrada. Puedes deshacer durante 10 segundos.')
    vi.advanceTimersByTime(20)
    anunciador.anunciar('Venta registrada. Total S/ 14.63')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe(
      'Venta registrada. Puedes deshacer durante 10 segundos. Venta registrada. Total S/ 14.63',
    )
  })

  it('N4: une con ". " sin duplicar la puntuación que ya trae cada mensaje', () => {
    const anunciador = crearAnunciador()
    anunciador.anunciar('Producto guardado')
    anunciador.anunciar('¡Queda poco!')
    anunciador.anunciar('Revisa Control.')
    anunciador.anunciar('Listo')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Producto guardado. ¡Queda poco! Revisa Control. Listo')
  })

  it('N4: no repite un mensaje idéntico dentro del mismo anuncio', () => {
    const anunciador = crearAnunciador()
    anunciador.anunciar('Venta registrada')
    anunciador.anunciar('Venta registrada')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada')
  })

  it('un mensaje que llega después de la ventana es un anuncio nuevo, no se une al anterior', () => {
    const anunciador = crearAnunciador()
    anunciador.anunciar('Venta registrada')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS + 500)
    anunciador.anunciar('Producto guardado')
    expect(anunciador.texto.value).toBe('')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Producto guardado')
  })

  it('N4: anunciar() devuelve un identificador distinto por mensaje', () => {
    const anunciador = crearAnunciador()
    const a = anunciador.anunciar('Uno')
    const b = anunciador.anunciar('Uno')
    expect(a).not.toBe(b)
  })

  it('N4: limpiar(id) borra la región si ese mensaje es parte del anuncio actual', () => {
    const anunciador = crearAnunciador()
    const id = anunciador.anunciar('Venta registrada')
    anunciador.anunciar('Total S/ 14.63')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Venta registrada. Total S/ 14.63')

    anunciador.limpiar(id)
    expect(anunciador.texto.value).toBe('')
  })

  it('N4: limpiar(id) de un mensaje viejo NO borra un anuncio más nuevo de otra pantalla', () => {
    const anunciador = crearAnunciador()
    const idViejo = anunciador.anunciar('Venta registrada. Puedes deshacer durante 10 segundos.')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS + 2000)
    anunciador.anunciar('Producto guardado')
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)

    anunciador.limpiar(idViejo) // p. ej. el aviso Deshacer se cierra a los 10 s
    expect(anunciador.texto.value).toBe('Producto guardado')
  })

  it('N4: limpiar(id) de un mensaje todavía pendiente lo saca del anuncio sin tocar a los demás', () => {
    const anunciador = crearAnunciador()
    const id = anunciador.anunciar('Venta registrada')
    anunciador.anunciar('Total S/ 14.63')
    anunciador.limpiar(id)
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Total S/ 14.63')
  })

  it('N4: limpiar(id) del único mensaje pendiente cancela el anuncio', () => {
    const anunciador = crearAnunciador()
    const id = anunciador.anunciar('Venta registrada')
    anunciador.limpiar(id)
    vi.advanceTimersByTime(ESPERA_ANUNCIO_MS * 2)
    expect(anunciador.texto.value).toBe('')
  })
})

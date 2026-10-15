import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { crearAnunciador } from '../anunciador'

describe('anunciador (hallazgo 3): avisos repetidos y limpieza', () => {
  it('empieza vacío', () => {
    const anunciador = crearAnunciador()
    expect(anunciador.texto.value).toBe('')
  })

  it('anunciar() pone el texto (en el siguiente tick)', async () => {
    const anunciador = crearAnunciador()
    anunciador.anunciar('Venta registrada')
    await nextTick()
    expect(anunciador.texto.value).toBe('Venta registrada')
  })

  it('el mismo mensaje dos veces produce dos anuncios reales: vacía y vuelve a poner el texto cada vez', async () => {
    const anunciador = crearAnunciador()

    anunciador.anunciar('Venta registrada')
    expect(anunciador.texto.value).toBe('') // primera mutación: vacío
    await nextTick()
    expect(anunciador.texto.value).toBe('Venta registrada') // segunda mutación: el texto

    anunciador.anunciar('Venta registrada') // mismo mensaje otra vez
    expect(anunciador.texto.value).toBe('') // se vuelve a vaciar: el lector de pantalla SÍ nota el cambio
    await nextTick()
    expect(anunciador.texto.value).toBe('Venta registrada')
  })

  it('limpiar() deja la región vacía de inmediato', async () => {
    const anunciador = crearAnunciador()
    anunciador.anunciar('Venta registrada')
    await nextTick()
    expect(anunciador.texto.value).toBe('Venta registrada')

    anunciador.limpiar()
    expect(anunciador.texto.value).toBe('')
  })
})

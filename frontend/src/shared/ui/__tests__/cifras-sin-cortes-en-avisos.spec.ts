import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AvisoDeshacer from '../componentes/AvisoDeshacer.vue'
import DialogoConfirmacion from '../componentes/DialogoConfirmacion.vue'
import PantallaExito from '../componentes/PantallaExito.vue'

/**
 * Plan 12 (RN-UX-09): en 320 px con letra Muy grande, "S/ 2.60" se partía en "S/" | "2.60" y
 * "9 kg" en "9" | "kg" dentro del diálogo de precio de compra, del aviso Deshacer y de la
 * pantalla de éxito: se lee otro número. Como en el kit B (pegarCifras), lo que se VE lleva
 * espacios duros entre el monto o la cantidad y su símbolo; las palabras se envuelven igual.
 */
const NBSP = ' '

describe('plan 12: montos y cantidades que no se parten en avisos y diálogos', () => {
  it('DialogoConfirmacion: título y mensaje', () => {
    const w = mount(DialogoConfirmacion, {
      props: {
        abierto: false,
        titulo: 'Cambió el costo de Lejía 1 L',
        mensaje: '¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad',
        textoConfirmar: 'Sí, actualizar',
      },
    })
    expect(w.get('h2').text()).toBe(`Cambió el costo de Lejía 1${NBSP}L`)
    expect(w.get('p').text()).toBe(
      `¿Actualizar el precio de compra a S/${NBSP}2.60? Ganarás S/${NBSP}0.90 por unidad`,
    )
  })

  it('AvisoDeshacer: el mensaje', () => {
    const w = mount(AvisoDeshacer, { props: { mensaje: 'Carbón: ahora hay 9 kg' } })
    expect(w.get('.mensaje').text()).toBe(`Carbón: ahora hay 9${NBSP}kg`)
  })

  it('PantallaExito: el detalle (el título no lleva cifras)', () => {
    const w = mount(PantallaExito, {
      props: { titulo: 'Venta registrada', detalle: 'Total S/ 46.80 · Vuelto S/ 3.20' },
    })
    expect(w.get('.detalle').text()).toBe(`Total S/${NBSP}46.80 · Vuelto S/${NBSP}3.20`)
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import DialogoConfirmacion from '../componentes/DialogoConfirmacion.vue'
import { prepararDialogos } from './dialogo-en-jsdom'

beforeAll(prepararDialogos)

const PROPS = {
  abierto: true,
  titulo: 'Cambió el precio de compra',
  mensaje: '¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad',
  textoConfirmar: 'Sí, actualizar',
  textoCancelar: 'No, dejar S/ 2.40',
}

describe('DialogoConfirmacion', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('abierto, muestra título, mensaje y las dos opciones; cada una emite lo suyo', async () => {
    const w = mount(DialogoConfirmacion, { props: PROPS, attachTo: document.body })
    await flushPromises()
    expect(w.get('dialog').attributes('open')).toBeDefined()
    expect(w.get('h2').text()).toBe(PROPS.titulo)
    // Con espacios duros (pegarCifras): "S/ 2.60" no se parte.
    expect(
      w
        .get('p')
        .text()
        .replace(/\u00a0/g, ' '),
    ).toBe(PROPS.mensaje)
    await w.get('.confirmar').trigger('click')
    await w.get('.cancelar').trigger('click')
    expect(w.emitted('confirmar')).toHaveLength(1)
    expect(w.emitted('cancelar')).toHaveLength(1)
  })

  it('por defecto el foco va a Cancelar (lo seguro ante un riesgo)', async () => {
    const w = mount(DialogoConfirmacion, { props: PROPS, attachTo: document.body })
    await flushPromises()
    expect(document.activeElement).toBe(w.get('.cancelar').element)
  })

  it('RN-OP-14: con enfocar="confirmar" la opción por defecto (con el foco) es la de confirmar', async () => {
    const w = mount(DialogoConfirmacion, {
      props: { ...PROPS, enfocar: 'confirmar' as const },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.activeElement).toBe(w.get('.confirmar').element)
  })

  it('por defecto, Escape o "atrás" del celular (cancel nativo) es lo mismo que Cancelar', async () => {
    const w = mount(DialogoConfirmacion, { props: PROPS, attachTo: document.body })
    await flushPromises()
    await w.get('dialog').trigger('cancel')
    expect(w.emitted('cancelar')).toHaveLength(1)
    expect(w.emitted('cerrar')).toBeUndefined()
  })

  it('r1 M1: con cierre-nativo="cerrar", Escape cierra SIN responder (emite cerrar, no cancelar)', async () => {
    const w = mount(DialogoConfirmacion, {
      props: { ...PROPS, cierreNativo: 'cerrar' as const },
      attachTo: document.body,
    })
    await flushPromises()
    await w.get('dialog').trigger('cancel')
    expect(w.emitted('cerrar')).toHaveLength(1)
    expect(w.emitted('cancelar')).toBeUndefined()
  })
})

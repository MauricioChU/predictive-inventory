import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import DialogoConfirmacion from '../componentes/DialogoConfirmacion.vue'
import { simularDialogos } from './dialogo-en-jsdom'

beforeAll(simularDialogos)

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

  it('plan 17: el mensaje es la descripción accesible del diálogo (aria-describedby)', async () => {
    const w = mount(DialogoConfirmacion, { props: PROPS, attachTo: document.body })
    await flushPromises()
    const dialogo = w.get('dialog')
    const idMensaje = dialogo.attributes('aria-describedby')
    expect(idMensaje).toBeTruthy()
    const mensaje = document.getElementById(idMensaje!)
    expect(mensaje).toBe(w.get('p').element)
    // Y el título sigue siendo su nombre.
    expect(document.getElementById(dialogo.attributes('aria-labelledby')!)).toBe(
      w.get('h2').element,
    )
  })

  it('plan 17: el foco queda dentro del diálogo al abrirse, Escape responde Cancelar y al cerrarse el foco vuelve a quien lo abrió', async () => {
    const abridor = document.createElement('button')
    abridor.textContent = 'Archivar producto'
    document.body.append(abridor)
    abridor.focus()
    const w = mount(DialogoConfirmacion, {
      props: { ...PROPS, abierto: false },
      attachTo: document.body,
    })
    await flushPromises()
    expect(w.get('dialog').attributes('open')).toBeUndefined()
    await w.setProps({ abierto: true })
    await flushPromises()
    expect(w.get('dialog').element.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(w.get('.cancelar').element)
    // Escape: el navegador avisa "cancel" en el <dialog> (aquí se simula ese evento).
    const evento = new Event('cancel', { cancelable: true })
    w.get('dialog').element.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(true) // quien lo usa decide si se cierra
    expect(w.emitted('cancelar')).toHaveLength(1)
    await w.setProps({ abierto: false })
    await flushPromises()
    expect(w.get('dialog').attributes('open')).toBeUndefined()
    expect(document.activeElement).toBe(abridor)
  })

  it('plan 17: si quien lo abrió ya no está (o el foco se fue a otro lado), no lo toca', async () => {
    const abridor = document.createElement('button')
    document.body.append(abridor)
    abridor.focus()
    const w = mount(DialogoConfirmacion, {
      props: { ...PROPS, abierto: false },
      attachTo: document.body,
    })
    await w.setProps({ abierto: true })
    await flushPromises()
    abridor.remove()
    const otro = document.createElement('h1')
    otro.tabIndex = -1
    document.body.append(otro)
    otro.focus() // la pantalla movió el foco a su título al responder
    await w.setProps({ abierto: false })
    await flushPromises()
    expect(document.activeElement).toBe(otro)
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

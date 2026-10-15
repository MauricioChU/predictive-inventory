/// <reference lib="es2022.array" />
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BotonPrincipal from '../componentes/BotonPrincipal.vue'
import CampoNumero from '../componentes/CampoNumero.vue'
import CampoTexto from '../componentes/CampoTexto.vue'

describe('BotonPrincipal', () => {
  it('RN-UX-04: muestra el texto aunque tenga ícono, y emite click', async () => {
    const w = mount(BotonPrincipal, { props: { texto: 'Vender' } })
    expect(w.text()).toContain('Vender')
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })
  it('no emite click deshabilitado', async () => {
    const w = mount(BotonPrincipal, { props: { texto: 'Cobrar', deshabilitado: true } })
    await w.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })
})

describe('CampoTexto', () => {
  it('asocia etiqueta y error al input (RN-UX-15)', () => {
    const w = mount(CampoTexto, {
      props: { etiqueta: 'Nombre', modelValue: '', error: 'Escribe el nombre del producto' },
    })
    const input = w.get('input')
    expect(w.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-invalid')).toBe('true')
    const idError = input.attributes('aria-describedby')!
    expect(w.get(`#${idError}`).text()).toBe('Escribe el nombre del producto')
  })
})

describe('CampoNumero (RN-UX-06)', () => {
  it('suma y resta con los botones grandes', async () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Cantidad', modelValue: '2' } })
    await w.get('[aria-label="Agregar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['3'])
    await w.setProps({ modelValue: '3' })
    await w.get('[aria-label="Quitar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['2'])
  })
  it('no baja del mínimo', async () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Cantidad', modelValue: '0', minimo: 0 } })
    await w.get('[aria-label="Quitar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
  it('acepta coma decimal y abre el teclado numérico', async () => {
    const w = mount(CampoNumero, {
      props: { etiqueta: 'Kilos', modelValue: '1,5', decimales: true },
    })
    expect(w.get('input').attributes('inputmode')).toBe('decimal')
    await w.get('[aria-label="Agregar uno"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['2.5'])
  })
  it('M10: deshabilita de verdad el botón "−" al llegar al mínimo', () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Cantidad', modelValue: '0', minimo: 0 } })
    const boton = w.get('[aria-label="Quitar uno"]')
    expect(boton.attributes('disabled')).toBeDefined()
    expect(boton.attributes('aria-disabled')).toBe('true')
  })
  it('M10: el botón "−" no está deshabilitado por encima del mínimo', () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Cantidad', modelValue: '2', minimo: 0 } })
    const boton = w.get('[aria-label="Quitar uno"]')
    expect(boton.attributes('disabled')).toBeUndefined()
  })
  it('M10: el sufijo se asocia al input con aria-describedby', () => {
    const w = mount(CampoNumero, { props: { etiqueta: 'Kilos', modelValue: '1', sufijo: 'kg' } })
    const input = w.get('input')
    const idDescrito = input.attributes('aria-describedby')!
    expect(w.get(`#${idDescrito}`).text()).toBe('kg')
  })
})

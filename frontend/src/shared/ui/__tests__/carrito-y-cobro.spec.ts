import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import BarraDeTotal from '../componentes/BarraDeTotal.vue'
import BotonPrincipal from '../componentes/BotonPrincipal.vue'
import CampoNumero from '../componentes/CampoNumero.vue'
import FilaDeCarrito from '../componentes/FilaDeCarrito.vue'
import SelectorDeBilletes from '../componentes/SelectorDeBilletes.vue'
import { textoReferido } from './utilidades-kit-productos'

const LINEA = {
  nombre: 'Lejía Clorox 1 L',
  unidad: 'UNIDAD' as const,
  cantidad: '2',
  textoPrecio: 'S/ 4.50 c/u',
  textoImporte: 'S/ 9.00',
}

function boton(w: ReturnType<typeof mount>, texto: string) {
  const encontrado = w.findAll('button').find((b) => b.text() === texto)
  if (!encontrado) throw new Error(`No hay un botón "${texto}"`)
  return encontrado
}

describe('FilaDeCarrito', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('muestra el nombre, el precio y el importe; la fila es un grupo con el nombre del producto', () => {
    const w = mount(FilaDeCarrito, { props: LINEA })
    expect(w.text()).toContain('Lejía Clorox 1 L')
    expect(w.text()).toContain('S/ 4.50 c/u')
    expect(w.get('.importe').text()).toContain('S/ 9.00')
    const grupo = w.get('[role="group"]')
    expect(textoReferido(grupo.element, 'aria-labelledby')).toBe('Lejía Clorox 1 L')
  })

  it('RN-UX-06: la cantidad usa CampoNumero; por unidades, sin decimales y sin bajar de 1', () => {
    const w = mount(FilaDeCarrito, { props: LINEA })
    const campo = w.getComponent(CampoNumero)
    expect(campo.props('decimales')).toBe(false)
    expect(campo.props('minimo')).toBe(1)
    // La unidad va en la etiqueta (no como sufijo: le quitaba ancho al número en 320 px).
    expect(campo.props('etiqueta')).toBe('Cantidad (unid.)')
    expect(campo.props('sufijo')).toBeUndefined()
    expect(w.get('input').attributes('inputmode')).toBe('numeric')
  })

  it('por kilo o litro acepta decimales y nunca baja a cero con "−"', () => {
    const w = mount(FilaDeCarrito, { props: { ...LINEA, unidad: 'KILO', cantidad: '1' } })
    const campo = w.getComponent(CampoNumero)
    expect(campo.props('decimales')).toBe(true)
    expect(campo.props('etiqueta')).toBe('Cantidad (kg)')
    expect(w.get('input').attributes('inputmode')).toBe('decimal')
    // 1 kg − 1 = 0 kg: el botón "−" queda deshabilitado.
    expect(w.get('[aria-label="Quitar uno"]').attributes('disabled')).toBeDefined()
    const litros = mount(FilaDeCarrito, { props: { ...LINEA, unidad: 'LITRO' } })
    expect(litros.getComponent(CampoNumero).props('etiqueta')).toBe('Cantidad (L)')
  })

  it('cambiar la cantidad emite update:cantidad (v-model:cantidad)', async () => {
    const w = mount(FilaDeCarrito, { props: LINEA })
    await w.get('[aria-label="Agregar uno"]').trigger('click')
    expect(w.emitted('update:cantidad')).toEqual([['3']])
    await w.get('input').setValue('5')
    expect(w.emitted('update:cantidad')?.at(-1)).toEqual(['5'])
  })

  it('RN-UX-05: "Quitar" es un botón visible (no hay que deslizar) que nombra al producto', async () => {
    const w = mount(FilaDeCarrito, { props: LINEA })
    const quitar = boton(w, 'Quitar')
    // WCAG 2.5.3: el nombre accesible contiene el texto visible.
    expect(quitar.attributes('aria-label')).toBe('Quitar Lejía Clorox 1 L')
    await quitar.trigger('click')
    expect(w.emitted('quitar')).toEqual([[]])
  })

  it('sin precioEditable no ofrece "Cambiar precio"', () => {
    const w = mount(FilaDeCarrito, { props: LINEA })
    expect(w.findAll('button').some((b) => b.text() === 'Cambiar precio')).toBe(false)
  })

  it('"Cambiar precio" abre la edición en línea con el precio actual y el foco en el campo', async () => {
    const w = mount(FilaDeCarrito, {
      props: { ...LINEA, precioEditable: true, valorPrecio: '4.50' },
      attachTo: document.body,
    })
    const cambiar = boton(w, 'Cambiar precio')
    expect(cambiar.attributes('aria-label')).toBe('Cambiar precio de Lejía Clorox 1 L')
    expect(cambiar.attributes('aria-expanded')).toBe('false')
    await cambiar.trigger('click')
    expect(cambiar.attributes('aria-expanded')).toBe('true')
    const campos = w.findAllComponents(CampoNumero)
    expect(campos).toHaveLength(2)
    const precio = campos[1]!
    expect(precio.props('etiqueta')).toBe('Nuevo precio en S/')
    expect(precio.props('decimales')).toBe(true)
    const input = precio.get('input').element as HTMLInputElement
    expect(input.value).toBe('4.50')
    expect(document.activeElement).toBe(input)
  })

  it('"Guardar precio" emite cambiarPrecio con lo escrito, cierra y devuelve el foco', async () => {
    const w = mount(FilaDeCarrito, {
      props: { ...LINEA, precioEditable: true, valorPrecio: '4.50' },
      attachTo: document.body,
    })
    await boton(w, 'Cambiar precio').trigger('click')
    await w.findAllComponents(CampoNumero)[1]!.get('input').setValue('4,20')
    await boton(w, 'Guardar precio').trigger('click')
    expect(w.emitted('cambiarPrecio')).toEqual([['4,20']])
    expect(w.findAllComponents(CampoNumero)).toHaveLength(1)
    expect(document.activeElement).toBe(boton(w, 'Cambiar precio').element)
  })

  it('"Cancelar" (o Escape) cierra sin cambiar el precio y devuelve el foco', async () => {
    const w = mount(FilaDeCarrito, {
      props: { ...LINEA, precioEditable: true },
      attachTo: document.body,
    })
    await boton(w, 'Cambiar precio').trigger('click')
    // Sin valorPrecio el campo arranca vacío.
    expect(
      (w.findAllComponents(CampoNumero)[1]!.get('input').element as HTMLInputElement).value,
    ).toBe('')
    await boton(w, 'Cancelar').trigger('click')
    expect(w.findAllComponents(CampoNumero)).toHaveLength(1)
    expect(document.activeElement).toBe(boton(w, 'Cambiar precio').element)

    await boton(w, 'Cambiar precio').trigger('click')
    await w.get('.edicion-precio').trigger('keydown', { key: 'Escape' })
    expect(w.findAllComponents(CampoNumero)).toHaveLength(1)
    expect(w.emitted('cambiarPrecio')).toBeUndefined()
  })

  it('en Recibir edita el costo: los textos dicen "costo"', async () => {
    const w = mount(FilaDeCarrito, {
      props: { ...LINEA, precioEditable: true, concepto: 'costo' },
      attachTo: document.body,
    })
    await boton(w, 'Cambiar costo').trigger('click')
    expect(w.findAllComponents(CampoNumero)[1]!.props('etiqueta')).toBe('Nuevo costo en S/')
    expect(boton(w, 'Guardar costo').exists()).toBe(true)
  })

  it('RN-UX-04: el precio especial se marca con ícono y texto', () => {
    const w = mount(FilaDeCarrito, { props: { ...LINEA, textoPrecioEspecial: 'Precio especial' } })
    const marca = w.get('.precio-especial')
    expect(marca.text()).toBe('Precio especial')
    expect(marca.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('la foto es decorativa (el nombre ya está escrito al lado)', () => {
    const w = mount(FilaDeCarrito, { props: { ...LINEA, imagen: 'https://ejemplo.pe/l.jpg' } })
    expect(w.get('img').attributes('alt')).toBe('')
  })
})

describe('BarraDeTotal', () => {
  it('muestra la etiqueta y el total, y el botón principal emite accion', async () => {
    const w = mount(BarraDeTotal, {
      props: { etiqueta: 'Total', textoTotal: 'S/ 14.63', textoAccion: 'Cobrar' },
    })
    expect(w.get('.etiqueta').text()).toBe('Total')
    expect(w.get('.total').text()).toBe('S/ 14.63')
    const principal = w.getComponent(BotonPrincipal)
    expect(principal.text()).toBe('Cobrar')
    await principal.trigger('click')
    expect(w.emitted('accion')).toHaveLength(1)
  })

  it('deshabilitada no emite accion', async () => {
    const w = mount(BarraDeTotal, {
      props: {
        etiqueta: 'Total',
        textoTotal: 'S/ 0.00',
        textoAccion: 'Cobrar',
        deshabilitado: true,
      },
    })
    await w.get('button').trigger('click')
    expect(w.emitted('accion')).toBeUndefined()
  })
})

describe('SelectorDeBilletes', () => {
  const BILLETES = [
    { etiqueta: 'S/ 10', valor: '10' },
    { etiqueta: 'S/ 20', valor: '20' },
    { etiqueta: 'S/ 50', valor: '50' },
    { etiqueta: 'S/ 100', valor: '100' },
  ]
  const PROPS = { textoTotal: 'S/ 14.63', billetes: BILLETES, modelValue: '' }

  it('muestra el total y un botón por billete, más "Exacto", en un grupo con nombre', () => {
    const w = mount(SelectorDeBilletes, { props: PROPS })
    expect(w.text()).toContain('S/ 14.63')
    expect(w.findAll('.billete').map((b) => b.text())).toEqual([
      'S/ 10',
      'S/ 20',
      'S/ 50',
      'S/ 100',
      'Exacto',
    ])
    const grupo = w.get('[role="group"]')
    expect(textoReferido(grupo.element, 'aria-labelledby')).toBe('¿Con cuánto paga?')
  })

  it('tocar un billete emite update:modelValue con su valor; "Exacto" emite exacto', async () => {
    const w = mount(SelectorDeBilletes, { props: PROPS })
    await boton(w, 'S/ 20').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['20']])
    await boton(w, 'Exacto').trigger('click')
    expect(w.emitted('exacto')).toEqual([[]])
  })

  it('RN-UX-06: el monto se puede escribir con CampoNumero decimal', async () => {
    const w = mount(SelectorDeBilletes, { props: { ...PROPS, modelValue: '20' } })
    const campo = w.getComponent(CampoNumero)
    expect(campo.props('decimales')).toBe(true)
    expect(campo.props('etiqueta')).toBe('Paga con (S/)')
    expect((w.get('input').element as HTMLInputElement).value).toBe('20')
    await w.get('input').setValue('25,50')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['25,50'])
  })

  it('RN-UX-15: el mensaje (vuelto o lo que falta) se anuncia en una región aria-live presente desde el inicio', async () => {
    const w = mount(SelectorDeBilletes, { props: PROPS })
    const region = w.get('[aria-live="polite"]')
    expect(region.text()).toBe('')
    await w.setProps({ mensaje: 'Vuelto S/ 5.37', tonoMensaje: 'exito' })
    expect(w.get('[aria-live="polite"]').text()).toBe('Vuelto S/ 5.37')
    expect(w.get('[aria-live="polite"]').element).toBe(region.element)
  })

  it('RN-UX-04: "Faltan…" lleva ícono además del color (el texto lo dice)', async () => {
    const w = mount(SelectorDeBilletes, {
      props: { ...PROPS, mensaje: 'Faltan S/ 4.63', tonoMensaje: 'atencion' },
    })
    const mensaje = w.get('.mensaje')
    expect(mensaje.classes()).toContain('mensaje--atencion')
    expect(mensaje.get('svg').attributes('aria-hidden')).toBe('true')
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import BarraDeTotal from '../componentes/BarraDeTotal.vue'
import BotonPrincipal from '../componentes/BotonPrincipal.vue'
import CampoNumero from '../componentes/CampoNumero.vue'
import FilaDeCarrito from '../componentes/FilaDeCarrito.vue'
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

  it('RN-OP-11: con una sola unidad, "otro precio" no pregunta cuántos: pide a cuánto y emite separar con 1', async () => {
    const w = mount(FilaDeCarrito, {
      props: {
        ...LINEA,
        cantidad: '1',
        compacta: true,
        precioEditable: true,
        puedeSeparar: true,
        maximoSeparar: 1,
        valorPrecio: '4.50',
      },
      attachTo: document.body,
    })
    await boton(w, '¿Vendiste alguno a otro precio?').trigger('click')
    await flushPromises()
    const campos = w.findAll('.separar input')
    expect(campos).toHaveLength(1)
    expect(w.get('.separar').text()).toContain('¿A cuánto lo vendiste?')
    expect(w.get('.separar').text()).not.toContain('¿Cuántos?')
    await campos[0]!.setValue('5.20')
    await boton(w, 'Guardar').trigger('click')
    expect(w.emitted('separar')).toEqual([['1', '5.20']])
  })

  it('plan 20 (RN-OP-22): con textoQuedan muestra cuánto queda tras la venta; sin él, no muestra nada', async () => {
    const w = mount(FilaDeCarrito, { props: { ...LINEA, textoQuedan: 'Quedan 8 unid.' } })
    expect(w.get('.quedan').text()).toBe('Quedan 8 unid.')
    await w.setProps({ textoQuedan: 'Se acaba' })
    expect(w.get('.quedan').text()).toBe('Se acaba')
    expect(w.get('.quedan').classes()).toContain('quedan--acaba')
    await w.setProps({ textoQuedan: undefined })
    expect(w.find('.quedan').exists()).toBe(false)
  })

  // Plan 13: en Para comprar el monto de la línea es el "Costo estimado" (RN-AN-08).
  it('el monto de la línea dice "Importe" salvo que la pantalla le dé otro nombre', () => {
    expect(mount(FilaDeCarrito, { props: LINEA }).get('.etiqueta-importe').text()).toBe('Importe')
    const w = mount(FilaDeCarrito, { props: { ...LINEA, etiquetaImporte: 'Costo estimado' } })
    expect(w.get('.etiqueta-importe').text()).toBe('Costo estimado')
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
    await flushPromises()
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
    // Ronda 1: los dos cierres avisan, para que la pantalla borre su error de precio.
    expect(w.emitted('cancelarPrecio')).toEqual([[], []])
  })

  it('ronda 1 (RN-UX-07): errorCantidad se muestra junto al campo de cantidad y lo marca inválido', () => {
    const error =
      'Solo quedan 2 unid. de Lejía Clorox 1 L. Cambia la cantidad o registra la llegada de mercadería.'
    const w = mount(FilaDeCarrito, { props: { ...LINEA, cantidad: '5', errorCantidad: error } })
    const campo = w.getComponent(CampoNumero)
    expect(campo.props('error')).toBe(error)
    expect(campo.get('input').attributes('aria-invalid')).toBe('true')
    expect(w.get('[role="alert"]').text()).toBe(error)
  })

  describe('ronda 1: errores de precio junto al campo (RN-UX-07, RN-OP-04)', () => {
    const ERROR = 'Escribe un precio válido, por ejemplo 4.50'
    /** Una pantalla como la de Vender: valida en el acto (sincrónico, como el dominio) y, si el
     * precio no sirve, deja su mensaje en errorPrecio; al cancelar, lo borra. */
    function montarEnPantalla() {
      const recibidos: string[] = []
      let cancelados = 0
      const Pantalla = defineComponent({
        setup() {
          const errorPrecio = ref<string>()
          const precio = ref('4.50')
          return () =>
            h(FilaDeCarrito, {
              ...LINEA,
              precioEditable: true,
              valorPrecio: precio.value,
              errorPrecio: errorPrecio.value,
              onCambiarPrecio: (texto: string) => {
                recibidos.push(texto)
                if (!/^\d+([.,]\d{1,2})?$/.test(texto.trim())) {
                  errorPrecio.value = ERROR
                  return
                }
                errorPrecio.value = undefined
                precio.value = texto
              },
              onCancelarPrecio: () => {
                cancelados += 1
                errorPrecio.value = undefined
              },
            })
        },
      })
      const w = mount(Pantalla, { attachTo: document.body })
      const campoPrecio = () => w.findAllComponents(CampoNumero)[1]
      return { w, recibidos, cancelados: () => cancelados, campoPrecio }
    }

    it('precio inválido: queda abierta con lo escrito, el error anunciado y el foco en el campo', async () => {
      const { w, recibidos, campoPrecio } = montarEnPantalla()
      await boton(w, 'Cambiar precio').trigger('click')
      await campoPrecio()!.get('input').setValue('4..5')
      await boton(w, 'Guardar precio').trigger('click')
      await flushPromises()
      expect(recibidos).toEqual(['4..5'])
      const input = campoPrecio()!.get('input')
      expect((input.element as HTMLInputElement).value).toBe('4..5')
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(w.get('.edicion-precio [role="alert"]').text()).toBe(ERROR)
      expect(document.activeElement).toBe(input.element)
    })

    it('precio válido: cierra la edición y devuelve el foco a "Cambiar precio"', async () => {
      const { w, recibidos, campoPrecio } = montarEnPantalla()
      await boton(w, 'Cambiar precio').trigger('click')
      await campoPrecio()!.get('input').setValue('4..5')
      await boton(w, 'Guardar precio').trigger('click')
      await flushPromises()
      await campoPrecio()!.get('input').setValue('4,20')
      await boton(w, 'Guardar precio').trigger('click')
      await flushPromises()
      expect(recibidos).toEqual(['4..5', '4,20'])
      expect(campoPrecio()).toBeUndefined()
      expect(document.activeElement).toBe(boton(w, 'Cambiar precio').element)
    })

    it('Enter en el campo guarda (la tecla del teclado numérico); Enter en un botón, no', async () => {
      const { w, recibidos, campoPrecio } = montarEnPantalla()
      await boton(w, 'Cambiar precio').trigger('click')
      await boton(w, 'Cancelar').trigger('keydown', { key: 'Enter' })
      expect(recibidos).toEqual([])
      const input = campoPrecio()!.get('input')
      await input.setValue('5')
      await input.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(recibidos).toEqual(['5'])
      expect(campoPrecio()).toBeUndefined()
    })

    it('Cancelar y Escape emiten cancelarPrecio: la pantalla borra el error y no queda viejo', async () => {
      const { w, cancelados, campoPrecio } = montarEnPantalla()
      await boton(w, 'Cambiar precio').trigger('click')
      await campoPrecio()!.get('input').setValue('abc')
      await boton(w, 'Guardar precio').trigger('click')
      await flushPromises()
      expect(w.find('.edicion-precio [role="alert"]').exists()).toBe(true)
      await boton(w, 'Cancelar').trigger('click')
      expect(cancelados()).toBe(1)
      expect(campoPrecio()).toBeUndefined()
      await boton(w, 'Cambiar precio').trigger('click')
      expect(w.find('.edicion-precio [role="alert"]').exists()).toBe(false)
      await w.get('.edicion-precio').trigger('keydown', { key: 'Escape' })
      expect(cancelados()).toBe(2)
    })
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
      props: { etiqueta: 'Total', textoTotal: 'S/ 14.63', textoAccion: 'Confirmar venta' },
    })
    expect(w.get('.etiqueta').text()).toBe('Total')
    expect(w.get('.total').text()).toBe('S/ 14.63')
    const principal = w.getComponent(BotonPrincipal)
    expect(principal.text()).toBe('Confirmar venta')
    await principal.trigger('click')
    expect(w.emitted('accion')).toHaveLength(1)
  })

  it('deshabilitada no emite accion', async () => {
    const w = mount(BarraDeTotal, {
      props: {
        etiqueta: 'Total',
        textoTotal: 'S/ 0.00',
        textoAccion: 'Confirmar venta',
        deshabilitado: true,
      },
    })
    await w.get('button').trigger('click')
    expect(w.emitted('accion')).toBeUndefined()
  })

  describe('plan 12 (WCAG 2.4.11): publica su alto para que el foco nunca quede tapado', () => {
    const variable = () => document.documentElement.style.getPropertyValue('--alto-barra-de-total')
    let observados: Element[] = []

    beforeEach(() => {
      observados = []
      // jsdom no trae ResizeObserver: uno que solo recuerda qué observa.
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe(el: Element) {
            observados.push(el)
          }
          unobserve() {}
          disconnect() {}
        },
      )
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        () => ({ height: 131.4 }) as DOMRect,
      )
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
      document.documentElement.style.removeProperty('--alto-barra-de-total')
    })

    it('mientras está montada, --alto-barra-de-total vale su alto real; al desmontarse se quita', async () => {
      const w = mount(BarraDeTotal, {
        props: { etiqueta: 'Total', textoTotal: 'S/ 14.63', textoAccion: 'Confirmar venta' },
        attachTo: document.body,
      })
      await flushPromises()
      expect(variable()).toBe('132px')
      expect(observados).toContain(w.get('.barra-de-total').element)
      w.unmount()
      expect(variable()).toBe('')
    })
  })
})

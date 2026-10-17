import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VistaNecesitoComprar from '../VistaNecesitoComprar.vue'
import { esperarCarga, montarVista } from '../__pruebas__/montar-vista'
import { textoLeido as texto } from '../__pruebas__/texto-leido'
import { TiendaDePrueba } from '../__pruebas__/tienda-de-prueba'

const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }
const DETERGENTE = {
  nombre: 'Detergente a granel',
  unidad: 'KILO' as const,
  compra: '5.30',
  venta: '7.90',
  minimo: '2',
}
const JABON = { nombre: 'Jabón', compra: '1.20', venta: '2.00', minimo: '3' }
const ESCOBA = { nombre: 'Escoba', compra: '6.00', venta: '9.00', minimo: '1' }

/** Los cuatro casos de RN-AN-16 con los datos de torre-de-control.feature. */
async function tiendaDelMercado(): Promise<TiendaDePrueba> {
  const tienda = new TiendaDePrueba()
  await tienda.producto({ ...LEJIA, stockInicial: '51' }, '2026-08-01 08:00')
  await tienda.producto({ ...DETERGENTE, stockInicial: '34' }, '2026-08-01 08:00')
  await tienda.recibir('Lejía 1 L', '10', '2.40', '2026-10-10 09:30')
  // 28 días completos antes de hoy (17/09 a 14/10): Lejía 2 por día y Detergente 0.5 kg.
  for (let d = 0; d < 28; d += 1) {
    const dia = new Date(Date.UTC(2026, 8, 17 + d)).toISOString().slice(0, 10)
    await tienda.vender('Lejía 1 L', '2', `${dia} 10:00`)
    await tienda.vender('Detergente a granel', '0.5', `${dia} 11:00`)
  }
  await tienda.producto({ ...JABON, stockInicial: '10' })
  await tienda.producto({ ...ESCOBA, stockInicial: '5' }, '2026-07-17 08:00')
  await tienda.vender('Escoba', '1', '2026-08-31 10:00')
  return tienda
}

let tiendaCompartida: Promise<TiendaDePrueba> | undefined
let montada: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.restoreAllMocks()
  montada?.unmount()
  montada = undefined
  vi.useRealTimers()
})

async function abrir(tienda: TiendaDePrueba) {
  const montaje = await montarVista(VistaNecesitoComprar, {
    aplicacion: tienda.app,
    ruta: '/control/necesito-comprar',
  })
  montada = montaje.envoltura
  return montaje
}

async function buscar(w: VueWrapper, textoBuscado: string): Promise<void> {
  await w.get('input[type="search"]').setValue(textoBuscado)
  await vi.advanceTimersByTimeAsync(250)
  await esperarCarga()
}

function resultados(w: VueWrapper): DOMWrapper<Element>[] {
  return w.findAll('.tarjeta-de-producto')
}

async function preguntar(w: VueWrapper, textoBuscado: string, nombre: string): Promise<void> {
  await buscar(w, textoBuscado)
  const tarjeta = resultados(w).find((t) => texto(t.get('.nombre')) === nombre)
  if (!tarjeta) throw new Error(`No apareció "${nombre}" al buscar "${textoBuscado}"`)
  await tarjeta.trigger('click')
  await esperarCarga()
}

describe('¿Necesito comprar?', () => {
  it('abre con el buscador grande listo para escribir y dice qué hacer', async () => {
    const { envoltura } = await abrir(new TiendaDePrueba())
    expect(texto(envoltura.get('h1'))).toBe('¿Necesito comprar?')
    expect(texto(envoltura.get('.buscador-grande label'))).toBe('¿Qué producto quieres comprar?')
    expect(document.activeElement).toBe(envoltura.get('input[type="search"]').element)
    expect(texto(envoltura.get('.ayuda'))).toBe(
      'Escribe el nombre del producto y tócalo: te digo si te conviene comprarlo.',
    )
  })

  it('RN-AN-16: al tocar un producto responde con una sola frase en letra grande, con el stock y la última llegada', async () => {
    tiendaCompartida ??= tiendaDelMercado()
    const { envoltura } = await abrir(await tiendaCompartida)
    await buscar(envoltura, 'lej')
    expect(resultados(envoltura).map(texto)).toEqual(['Lejía 1 L 5 unid.'])

    await resultados(envoltura)[0]!.trigger('click')
    await esperarCarga()
    const respuesta = envoltura.get('.respuesta')
    const titulo = respuesta.get('h2')
    expect(texto(titulo)).toBe('Lejía 1 L')
    // La tarjeta tocada desaparece: el foco pasa al producto respondido.
    expect(document.activeElement).toBe(titulo.element)
    expect(texto(respuesta.get('.respuesta-grande'))).toBe('Sí, compra ~12 unid. (S/ 28.80)')
    expect(respuesta.get('.respuesta-grande').classes()).toContain('respuesta-grande--atencion')
    expect(respuesta.findAll('.fila-de-dato').map(texto)).toEqual([
      'Tienes 5 unid.',
      'Última llegada 10/10/2026 (hace 5 días)',
    ])
    // Listo para preguntar por otro: el buscador quedó vacío y sin resultados.
    expect((envoltura.get('input[type="search"]').element as HTMLInputElement).value).toBe('')
    expect(resultados(envoltura)).toHaveLength(0)
  })

  it.each([
    [
      'det',
      'Detergente a granel',
      'No hace falta: te alcanza para ~40 días',
      'exito',
      'Tienes 20 kg',
    ],
    [
      'jab',
      'Jabón',
      'Tienes 10 unid. Todavía no sé cuánto vendes; vuelve a preguntar en unos días',
      'info',
      'Tienes 10 unid.',
    ],
    [
      'esc',
      'Escoba',
      'No compres: no se vende hace 45 días y tienes 4 unid.',
      'peligro',
      'Tienes 4 unid.',
    ],
  ])('RN-AN-16: "%s" → %s: "%s" (tono %s)', async (buscado, nombre, frase, tono, stock) => {
    tiendaCompartida ??= tiendaDelMercado()
    const { envoltura } = await abrir(await tiendaCompartida)
    await preguntar(envoltura, buscado, nombre)
    const respuesta = envoltura.get('.respuesta-grande')
    expect(texto(respuesta)).toBe(frase)
    expect(respuesta.classes()).toContain(`respuesta-grande--${tono}`)
    expect(texto(envoltura.findAll('.respuesta .fila-de-dato')[0]!)).toBe(stock)
  })

  it('RN-AN-16: sin llegadas de mercadería lo dice', async () => {
    tiendaCompartida ??= tiendaDelMercado()
    const { envoltura } = await abrir(await tiendaCompartida)
    await preguntar(envoltura, 'jab', 'Jabón')
    expect(texto(envoltura.findAll('.respuesta .fila-de-dato')[1]!)).toBe(
      'Última llegada Todavía no registras llegadas de este producto',
    )
  })

  it('al volver a buscar se ven los resultados en lugar de la respuesta anterior', async () => {
    tiendaCompartida ??= tiendaDelMercado()
    const { envoltura } = await abrir(await tiendaCompartida)
    await preguntar(envoltura, 'jab', 'Jabón')
    await buscar(envoltura, 'esc')
    expect(envoltura.find('.respuesta').exists()).toBe(false)
    expect(resultados(envoltura).map((t) => texto(t.get('.nombre')))).toEqual(['Escoba'])
  })

  it('RN-UX-10: si la búsqueda no encuentra nada, lo dice y sugiere qué hacer', async () => {
    const tienda = new TiendaDePrueba()
    await tienda.producto({ ...JABON, stockInicial: '10' })
    const { envoltura } = await abrir(tienda)
    await buscar(envoltura, 'xyz')
    expect(texto(envoltura.get('.estado-vacio'))).toBe(
      'No hay productos con ese nombre Revisa cómo lo escribiste o prueba con otra palabra.',
    )
  })

  // Ronda 1: un fallo que no es del dominio (p. ej. la base no responde) también se dice.
  it('RN-UX-07: si no se pudo responder, lo dice con qué hacer (no queda en silencio)', async () => {
    const tienda = new TiendaDePrueba()
    await tienda.producto({ ...JABON, stockInicial: '10' })
    const { envoltura } = await abrir(tienda)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(tienda.app.analisis, 'necesitoComprar').mockRejectedValue(new Error('base cerrada'))
    await preguntar(envoltura, 'jab', 'Jabón')
    expect(texto(envoltura.get('.mensaje-de-error'))).toBe(
      'No pudimos responder Vuelve a tocar el producto en un momento.',
    )
    expect(envoltura.find('.respuesta').exists()).toBe(false)
  })

  it('RN-UX-07: si no se pudo buscar, lo dice con qué hacer', async () => {
    const tienda = new TiendaDePrueba()
    const { envoltura } = await abrir(tienda)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(tienda.app.catalogo, 'buscarProductos').mockRejectedValue(new Error('base cerrada'))
    await buscar(envoltura, 'jab')
    expect(texto(envoltura.get('.mensaje-de-error'))).toBe(
      'No pudimos buscar Vuelve a escribir el nombre en un momento.',
    )
  })

  it('RN-AN-16: un producto archivado mientras se elegía: "No encontramos ese producto"', async () => {
    const tienda = new TiendaDePrueba()
    await tienda.producto({ ...JABON, stockInicial: '10' })
    const { envoltura } = await abrir(tienda)
    await buscar(envoltura, 'jab')
    await tienda.app.catalogo.archivarProducto({ productoId: tienda.id('Jabón'), confirmado: true })
    await resultados(envoltura)[0]!.trigger('click')
    await esperarCarga()
    expect(texto(envoltura.get('.mensaje-de-error'))).toBe(
      'No encontramos ese producto Búscalo otra vez: puede que ya no esté entre tus productos.',
    )
    expect(envoltura.find('.respuesta').exists()).toBe(false)
  })
})

import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AplicacionDePrueba } from '../../../../../tests/soporte/aplicacion-de-prueba'
import {
  crearAplicacion,
  crearProducto,
  esperar,
  esperarRuta,
  montarVista,
  type VistaMontada,
} from '../../../../../tests/soporte/pantallas-de-productos'

function nombres(w: VueWrapper): string[] {
  return w.findAll('.tarjeta-de-producto .nombre').map((n) => n.text())
}

function boton(w: VueWrapper, texto: string) {
  const encontrado = w.findAll('button').find((b) => b.text().trim() === texto)
  if (!encontrado) throw new Error(`No hay un botón "${texto}"`)
  return encontrado
}

async function buscar(w: VueWrapper, texto: string) {
  const campo = w.get('input[type="search"]')
  await campo.setValue(texto)
  await campo.trigger('keydown', { key: 'Enter' })
  await esperar()
}

async function elegirEstado(w: VueWrapper, etiqueta: string) {
  await boton(w, etiqueta).trigger('click')
  await esperar()
}

describe('Productos (lista)', () => {
  let app: AplicacionDePrueba
  let vista: VistaMontada | undefined

  beforeEach(async () => {
    app = await crearAplicacion()
  })

  afterEach(async () => {
    vista?.wrapper.unmount()
    vista = undefined
    await app.cerrar()
  })

  async function conProductos() {
    await crearProducto(app, {
      nombre: 'Lejía Tradicional 1 L',
      categoria: 'Lejías y desinfectantes',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stockInicial: '2',
    })
    await crearProducto(app, {
      nombre: 'Carbón vegetal',
      categoria: 'Carbón y combustibles',
      unidad: 'KILO',
      compra: '2.75',
      venta: '4.00',
      minimo: '1',
    })
    await crearProducto(app, {
      nombre: 'Escoba',
      categoria: 'Escobas, trapeadores y accesorios',
      compra: '6.00',
      venta: '9.00',
      minimo: '2',
      stockInicial: '5',
    })
    const bolsa = await crearProducto(app, {
      nombre: 'Bolsa chica',
      categoria: 'Bolsas',
      compra: '0.05',
      venta: '0.10',
    })
    await app.catalogo.archivarProducto({ productoId: bolsa, confirmado: true })
    await app.esperarTareasPendientes()
  }

  it('RN-UX-10: sin productos explica por qué y ofrece agregar el primero (sin buscador)', async () => {
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    expect(w.get('h1').text()).toBe('Productos')
    expect(w.text()).toContain('Aún no tienes productos')
    expect(w.find('input[type="search"]').exists()).toBe(false)
    // Una sola acción principal: la del estado vacío.
    expect(w.findAll('button').some((b) => b.text().trim() === 'Agregar producto')).toBe(false)

    await boton(w, 'Agregar el primero').trigger('click')
    await esperarRuta(vista.router, 'producto-nuevo')
  })

  it('cada fila: foto, nombre, stock con unidad, precio y estado con texto (los archivados no)', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    expect(nombres(w).sort()).toEqual(['Carbón vegetal', 'Escoba', 'Lejía Tradicional 1 L'])
    expect(w.find('ul[aria-label="Productos"]').exists()).toBe(true)
    const lejia = w.findAll('.tarjeta-de-producto').find((t) => t.text().includes('Lejía'))!
    expect(lejia.text()).toContain('2 unid.')
    expect(lejia.text()).toContain('S/ 3.50')
    expect(lejia.text()).toContain('Queda poco')
    const carbon = w.findAll('.tarjeta-de-producto').find((t) => t.text().includes('Carbón'))!
    expect(carbon.text()).toContain('0 kg')
    expect(carbon.text()).toContain('Agotado')
    expect(w.text()).toContain('3 productos')
  })

  it('RN-CAT-12: busca sin tildes y en cualquier orden, con el caso de uso del catálogo', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    await buscar(vista.wrapper, 'lejia')
    expect(nombres(vista.wrapper)).toEqual(['Lejía Tradicional 1 L'])
    await buscar(vista.wrapper, 'CARBON')
    expect(nombres(vista.wrapper)).toEqual(['Carbón vegetal'])
    await buscar(vista.wrapper, '1 l trad')
    expect(nombres(vista.wrapper)).toEqual(['Lejía Tradicional 1 L'])
    expect(vista.wrapper.text()).toContain('1 producto')
  })

  it('una búsqueda sin resultados ofrece agregarlo con ese nombre', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    await buscar(vista.wrapper, 'shampoo')
    expect(vista.wrapper.text()).toContain('No encontramos «shampoo»')
    await boton(vista.wrapper, 'Agregar producto').trigger('click')
    await esperarRuta(vista.router, 'producto-nuevo')
    expect(vista.router.currentRoute.value.query).toEqual({ nombre: 'shampoo' })
  })

  it('filtros por estado: Queda poco · Agotados · Archivados', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    const opciones = w.findAll('[role="radiogroup"] [role="radio"]').map((o) => o.text())
    expect(opciones).toEqual(['Todos', 'Queda poco', 'Agotados', 'Archivados'])

    await elegirEstado(w, 'Queda poco')
    expect(nombres(w)).toEqual(['Lejía Tradicional 1 L'])
    await elegirEstado(w, 'Agotados')
    expect(nombres(w)).toEqual(['Carbón vegetal'])
    await elegirEstado(w, 'Archivados')
    expect(nombres(w)).toEqual(['Bolsa chica'])
    expect(w.get('.tarjeta-de-producto').text()).toContain('Archivado')
    expect(w.find('.insignia').exists()).toBe(false)
  })

  it('un filtro sin productos lo explica y "Ver todos" lo quita', async () => {
    await crearProducto(app, { nombre: 'Escoba', compra: '6', venta: '9', stockInicial: '5' })
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    await elegirEstado(w, 'Agotados')
    expect(w.text()).toContain('No tienes productos agotados')
    await boton(w, 'Ver todos').trigger('click')
    await esperar()
    expect(nombres(w)).toEqual(['Escoba'])
    expect(w.get('[role="radio"][aria-checked="true"]').text()).toBe('Todos')
  })

  it('filtro por categoría: se abre con un botón y la elegida se ve en el botón', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    const abrir = boton(w, 'Categoría: Todas')
    expect(abrir.attributes('aria-expanded')).toBe('false')
    await abrir.trigger('click')
    expect(abrir.attributes('aria-expanded')).toBe('true')
    const categorias = w.findAll('.filtro-de-categoria [role="radio"]').map((o) => o.text())
    expect(categorias[0]).toBe('Todas las categorías')
    expect(categorias.at(-1)).toBe('Otros')

    await boton(w, 'Carbón y combustibles').trigger('click')
    await esperar()
    expect(nombres(w)).toEqual(['Carbón vegetal'])
    expect(boton(w, 'Categoría: Carbón y combustibles').attributes('aria-expanded')).toBe('false')
    expect(w.findAll('.filtro-de-categoria [role="radio"]')).toHaveLength(0)
  })

  it('tocar un producto abre su detalle; "Agregar producto" abre el formulario', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    await vista.wrapper
      .findAll('.tarjeta-de-producto')
      .find((t) => t.text().includes('Escoba'))!
      .trigger('click')
    await esperarRuta(vista.router, 'producto')

    await vista.router.push('/productos')
    await esperar()
    await boton(vista.wrapper, 'Agregar producto').trigger('click')
    await esperarRuta(vista.router, 'producto-nuevo')
    expect(vista.router.currentRoute.value.query).toEqual({})
  })

  it('al volver del detalle conserva la búsqueda y el filtro', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    await elegirEstado(vista.wrapper, 'Queda poco')
    await buscar(vista.wrapper, 'lejia')
    await vista.wrapper.get('.tarjeta-de-producto').trigger('click')
    await esperar()
    await vista.router.push('/productos')
    await esperar()
    expect((vista.wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe(
      'lejia',
    )
    expect(vista.wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Queda poco')
    expect(nombres(vista.wrapper)).toEqual(['Lejía Tradicional 1 L'])
  })

  it('"Categorías" abre la pantalla de categorías', async () => {
    vista = await montarVista(app, '/productos')
    await boton(vista.wrapper, 'Categorías').trigger('click')
    await esperarRuta(vista.router, 'categorias')
    expect(vista.router.currentRoute.value.path).toBe('/productos/categorias')
  })
})

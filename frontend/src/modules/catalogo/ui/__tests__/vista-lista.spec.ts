import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simularUrlsDeObjeto } from '@/shared/ui/__tests__/utilidades-kit-productos'
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

/** Abre la hoja de filtros (si no está abierta). */
async function abrirFiltros(w: VueWrapper) {
  if (w.find('.hoja-inferior').exists()) return
  const abrir = w.findAll('button').find((b) => b.text().trim().startsWith('Filtros'))
  if (!abrir) throw new Error('No hay botón "Filtros"')
  await abrir.trigger('click')
  await esperar()
}

/** Elige una opción dentro de la hoja de filtros (abriéndola antes). */
async function elegirOpcion(w: VueWrapper, etiqueta: string) {
  await abrirFiltros(w)
  const opcion = w
    .findAll('.hoja-inferior [role="radio"]')
    .find((o) => o.text().trim() === etiqueta)
  if (!opcion) throw new Error(`No hay una opción "${etiqueta}"`)
  await opcion.trigger('click')
  await esperar()
}
const elegirEstado = elegirOpcion

/** Los chips de lo activo, debajo del buscador. */
function chips(w: VueWrapper): string[] {
  return w.findAll('.chips .chip-texto').map((c) => c.text())
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
    await esperar()
    // El formulario abre en una hoja, sin salir de la lista.
    expect(w.get('.hoja-inferior h2').text()).toBe('Producto nuevo')
    expect(vista.router.currentRoute.value.name).toBe('productos')
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

  it('las fotos se ven en la lista y llegan juntas: la lista no se redibuja una vez por foto', async () => {
    const urls = simularUrlsDeObjeto()
    for (const nombre of ['Bolsa 1', 'Bolsa 2', 'Bolsa 3', 'Bolsa 4', 'Bolsa 5', 'Bolsa 6']) {
      const id = await crearProducto(app, {
        nombre,
        compra: '0.05',
        venta: '0.10',
        stockInicial: '9',
      })
      await app.catalogo.guardarFoto(id, new Blob([nombre], { type: 'image/webp' }))
    }
    // Como en IndexedDB, cada lectura termina en su propio momento.
    const leer = app.catalogo.obtenerFoto.bind(app.catalogo)
    let orden = 0
    vi.spyOn(app.catalogo, 'obtenerFoto').mockImplementation(async (id) => {
      orden += 1
      await new Promise((listo) => setTimeout(listo, orden * 5))
      return leer(id)
    })
    let redibujos = 0
    vista = await montarVista(app, '/productos', {
      alActualizar: (componente) => {
        if (componente === 'ListaDeProductos') redibujos += 1
      },
    })
    await vi.waitFor(() =>
      expect(vista!.wrapper.findAll('.tarjeta-de-producto img')).toHaveLength(6),
    )
    const fotos = vista.wrapper.findAll('.tarjeta-de-producto img')
    expect(fotos.every((f) => f.attributes('src')?.startsWith('blob:'))).toBe(true)
    // Primer dibujo con la lista; a lo sumo uno más cuando llegan TODAS las fotos.
    expect(redibujos).toBeLessThanOrEqual(1)
    urls.restaurar()
    vi.restoreAllMocks()
  })

  it('con productos activos no busca también los archivados al abrir', async () => {
    await crearProducto(app, { nombre: 'Escoba', compra: '6', venta: '9', stockInicial: '2' })
    const buscar = vi.spyOn(app.catalogo, 'buscarProductos')
    vista = await montarVista(app, '/productos')
    expect(buscar.mock.calls.map(([filtro]) => filtro)).toEqual([{ texto: '' }])
    vi.restoreAllMocks()
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
    // Una sola acción "Agregar producto": la del estado vacío (que lleva el nombre buscado).
    expect(
      vista.wrapper.findAll('button').filter((b) => b.text().trim() === 'Agregar producto'),
    ).toHaveLength(1)
    expect(vista.wrapper.find('.accion-principal').exists()).toBe(false)
    await boton(vista.wrapper, 'Agregar producto').trigger('click')
    await esperar()
    expect(vista.wrapper.get('.hoja-inferior h2').text()).toBe('Producto nuevo')
    expect(
      (vista.wrapper.get('.hoja-inferior input[type="text"]').element as HTMLInputElement).value,
    ).toBe('shampoo')
    expect(vista.router.currentRoute.value.name).toBe('productos')
  })

  it('filtros por estado: Se acaban · Queda poco · Agotados · Archivados', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    await abrirFiltros(w)
    const opciones = w
      .get('.hoja-inferior [role="radiogroup"]')
      .findAll('[role="radio"]')
      .map((o) => o.text())
    expect(opciones).toEqual(['Todos', 'Se acaban', 'Queda poco', 'Agotados', 'Archivados'])

    await elegirEstado(w, 'Se acaban')
    expect(nombres(w).sort()).toEqual(['Carbón vegetal', 'Lejía Tradicional 1 L'])

    await elegirEstado(w, 'Queda poco')
    expect(nombres(w)).toEqual(['Lejía Tradicional 1 L'])
    await elegirEstado(w, 'Agotados')
    expect(nombres(w)).toEqual(['Carbón vegetal'])
    await elegirEstado(w, 'Archivados')
    expect(nombres(w)).toEqual(['Bolsa chica'])
    expect(w.get('.tarjeta-de-producto').text()).toContain('Archivado')
    expect(w.find('.insignia').exists()).toBe(false)
    expect(chips(w)).toEqual(['Archivados'])
  })

  it('RN-CAT-16: /productos?estado=se-acaban abre la lista ya filtrada', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos?estado=se-acaban')
    const w = vista.wrapper
    expect(chips(w)).toEqual(['Se acaban'])
    expect(w.get('.boton-filtros').attributes('aria-label')).toBe('Filtros · 1 activo')
    expect(nombres(w).sort()).toEqual(['Carbón vegetal', 'Lejía Tradicional 1 L'])
    await elegirEstado(w, 'Todos')
    expect(nombres(w)).toHaveLength(3)
    expect(chips(w)).toEqual([])
  })

  it('RN-CAT-16: un estado desconocido en la dirección se ignora', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos?estado=otra-cosa')
    expect(chips(vista.wrapper)).toEqual([])
    expect(vista.wrapper.get('.boton-filtros').attributes('aria-label')).toBeUndefined()
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
    expect(chips(w)).toEqual([])
  })

  it('filtro por categoría: lista tocable en la hoja; la elegida queda como chip quitable', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    expect(w.find('.hoja-inferior').exists()).toBe(false)
    await abrirFiltros(w)
    const grupos = w.findAll('.hoja-inferior [role="radiogroup"]')
    const categorias = grupos[1]!.findAll('[role="radio"]').map((o) => o.text())
    expect(categorias[0]).toBe('Todas las categorías')
    expect(categorias.at(-1)).toBe('Otros')

    await elegirOpcion(w, 'Carbón y combustibles')
    expect(nombres(w)).toEqual(['Carbón vegetal'])
    expect(chips(w)).toEqual(['Carbón y combustibles'])
    expect(w.get('.boton-filtros').attributes('aria-label')).toBe('Filtros · 1 activo')
    // El botón de abajo dice cuántos productos se ven.
    expect(w.get('.hoja-inferior .pie').text()).toBe('Ver 1 producto')

    // Cerrar la hoja y quitar el chip: vuelve a todos.
    await w.get('.hoja-inferior .pie button').trigger('click')
    await esperar()
    expect(w.find('.hoja-inferior').exists()).toBe(false)
    await w.get('.chips .chip').trigger('click')
    await esperar()
    expect(nombres(w)).toHaveLength(3)
    expect(chips(w)).toEqual([])
  })

  it('con los dos filtros puestos el botón dice "Filtros · 2" y hay dos chips', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos')
    const w = vista.wrapper
    await elegirOpcion(w, 'Se acaban')
    await elegirOpcion(w, 'Carbón y combustibles')
    expect(w.get('.boton-filtros').attributes('aria-label')).toBe('Filtros · 2 activos')
    expect(chips(w)).toEqual(['Se acaban', 'Carbón y combustibles'])
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
    await esperar()
    // "Agregar producto" abre la hoja (no cambia de pantalla), sin encabezado propio del formulario.
    expect(vista.router.currentRoute.value.name).toBe('productos')
    expect(vista.wrapper.get('.hoja-inferior h2').text()).toBe('Producto nuevo')
    expect(vista.wrapper.findAll('.hoja-inferior h1')).toHaveLength(0)
    expect(vista.wrapper.find('.hoja-inferior form').exists()).toBe(true)
  })

  async function filtrarYSalir(w: VueWrapper) {
    await elegirEstado(w, 'Queda poco')
    await buscar(w, 'lejia')
  }

  function filtrosPuestos(w: VueWrapper) {
    return {
      texto: (w.get('input[type="search"]').element as HTMLInputElement).value,
      chips: chips(w),
      productos: nombres(w).length,
    }
  }

  it('al volver ATRÁS desde el detalle conserva la búsqueda y el filtro', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos', { historial: 'web' })
    await filtrarYSalir(vista.wrapper)
    await vista.wrapper.get('.tarjeta-de-producto').trigger('click')
    await esperarRuta(vista.router, 'producto')
    vista.router.back()
    await esperarRuta(vista.router, 'productos')
    expect((vista.wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe(
      'lejia',
    )
    expect(chips(vista.wrapper)).toEqual(['Queda poco'])
    expect(nombres(vista.wrapper)).toEqual(['Lejía Tradicional 1 L'])
  })

  it('entrando desde la navegación (no atrás) la lista empieza sin filtros', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos', { historial: 'web' })
    await filtrarYSalir(vista.wrapper)
    await vista.wrapper.get('.tarjeta-de-producto').trigger('click')
    await esperarRuta(vista.router, 'producto')
    await vista.router.push('/productos')
    await esperar()
    expect(filtrosPuestos(vista.wrapper)).toEqual({ texto: '', chips: [], productos: 3 })
  })

  it('después de guardar un producto nuevo en la hoja la lista deja los filtros (que no lo escondan)', async () => {
    await conProductos()
    vista = await montarVista(app, '/productos', { historial: 'web' })
    const w = vista.wrapper
    await elegirEstado(w, 'Queda poco')
    await w.get('.hoja-inferior .pie button').trigger('click')
    await esperar()
    await boton(w, 'Agregar producto').trigger('click')
    await esperar()
    await w.get('.hoja-inferior input[type="text"]').setValue('Cera para pisos')
    const categoria = w
      .findAll('.hoja-inferior [role="radio"]')
      .find((o) => o.text().trim() === 'Otros')!
    await categoria.trigger('click')
    const numeros = w.findAll(
      '.hoja-inferior input[inputmode="decimal"], .hoja-inferior input[type="number"]',
    )
    expect(numeros.length).toBeGreaterThan(1)
    await numeros[0]!.setValue('5')
    await numeros[1]!.setValue('8')
    await w.get('.hoja-inferior form').trigger('submit')
    await esperar()
    await esperar()
    expect(w.get('.hoja-inferior').text()).toContain('Producto guardado')
    expect(chips(w)).toEqual([])
    expect(w.findAll('.hoja-inferior button').some((b) => b.text().includes('Agregar otro'))).toBe(
      true,
    )
  })

  it('"Categorías" abre la pantalla de categorías', async () => {
    vista = await montarVista(app, '/productos')
    await boton(vista.wrapper, 'Categorías').trigger('click')
    await esperarRuta(vista.router, 'categorias')
    expect(vista.router.currentRoute.value.path).toBe('/productos/categorias')
  })

  it('RN-UX-07: si no se pueden leer los productos lo dice en lenguaje simple', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(app.catalogo, 'buscarProductos').mockRejectedValue(new Error('IndexedDB cerrada'))
    vista = await montarVista(app, '/productos')
    const alerta = vista.wrapper.get('[role="alert"]')
    expect(alerta.text()).toContain('No pudimos abrir tus productos.')
    expect(alerta.text()).not.toContain('IndexedDB')
    vi.restoreAllMocks()
  })
})

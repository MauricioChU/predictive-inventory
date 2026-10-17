import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorDeDominio } from '@/shared/domain/errores'
import { instanteLocal } from '@/shared/domain/fecha'
import type { AplicacionDePrueba } from '../../../../../tests/soporte/aplicacion-de-prueba'
import {
  crearAplicacion,
  crearProducto,
  esperar,
  esperarRuta,
  HOY,
  montarVista,
  type VistaMontada,
} from '../../../../../tests/soporte/pantallas-de-productos'

function boton(w: VueWrapper, texto: string) {
  const encontrado = w.findAll('button').find((b) => b.text().trim() === texto)
  if (!encontrado) throw new Error(`No hay un botón "${texto}"`)
  return encontrado
}

function hayBoton(w: VueWrapper, texto: string): boolean {
  return w.findAll('button').some((b) => b.text().trim() === texto)
}

/** El texto como se lee: las cifras van con espacios que no cortan ("12 unid."). */
function leer(texto: string): string {
  return texto.replace(/ /g, ' ')
}

function texto(w: VueWrapper): string {
  return leer(w.text())
}

/** El aviso de archivado (arriba, a todo el ancho: "Archivado" y por qué no aparece). */
function estaArchivado(w: VueWrapper): boolean {
  return w
    .findAll('.aviso-en-pagina')
    .some(
      (a) =>
        leer(a.text()).startsWith('Archivado') && leer(a.text()).includes('no aparece en Vender'),
    )
}

/** Etiqueta → valor de cada FilaDeDato de la pantalla. */
function datos(w: VueWrapper): Record<string, string> {
  return Object.fromEntries(
    w.findAll('.fila-de-dato').map((f) => [leer(f.get('dt').text()), leer(f.get('dd').text())]),
  )
}

const ESCOBA = {
  nombre: 'Escoba',
  categoria: 'Escobas, trapeadores y accesorios',
  compra: '6.00',
  venta: '9.00',
  minimo: '2',
}

describe('Detalle del producto', () => {
  let app: AplicacionDePrueba
  let vista: VistaMontada | undefined

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(HOY))
    app = await crearAplicacion()
  })

  afterEach(async () => {
    vista?.wrapper.unmount()
    vista = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
    await app.cerrar()
  })

  /** Un producto con historia: llegó el 1 de octubre y se vendió en días pasados. */
  async function conHistoria(producto: typeof ESCOBA & { stockInicial: string }, ventas: string[]) {
    app.reloj.fijar(instanteLocal('2026-10-01 09:00'))
    const id = await crearProducto(app, producto)
    for (const [indice, cantidad] of ventas.entries()) {
      app.reloj.fijar(instanteLocal(`2026-10-0${indice + 2} 11:00`))
      await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad }] })
    }
    app.reloj.fijar(HOY)
    await app.esperarTareasPendientes()
    return id
  }

  it('M5: abierto directo por su dirección (como una notificación) muestra el producto', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '12' })
    vista = await montarVista(app, `/productos/${id}`)
    const w = vista.wrapper
    expect(w.get('h1').text()).toBe('Escoba')
    expect(texto(w)).toContain('12 unid.')
    expect(w.get('.insignia').text()).toBe('Bien')
    expect(datos(w)).toMatchObject({
      Categoría: 'Escobas, trapeadores y accesorios',
      'Stock mínimo': '2 unid.',
      'Precio de venta': 'S/ 9.00',
      'Precio de compra': 'S/ 6.00',
      'Ganas por unidad': 'S/ 3.00',
    })
  })

  it('RN-AN-05 / RN-AN-14: "Se acaba en ~N días" y "Vendes ~X al día"', async () => {
    // 100 el 1/10 y 30 vendidas el 2/10: VPD = 30 ÷ 15 días válidos = 2; 70 ÷ 2 = 35 días.
    const id = await conHistoria({ ...ESCOBA, stockInicial: '100' }, ['30'])
    vista = await montarVista(app, `/productos/${id}`)
    expect(texto(vista.wrapper)).toContain('Se acaba en ~35 días')
    expect(texto(vista.wrapper)).toContain('Vendes ~2 unid. al día')
  })

  it('RN-AN-05: con stock para menos de un día dice "Se acaba hoy"', async () => {
    // 31 el 1/10 y 30 vendidas: queda 1 y la VPD es 2 → 0 días.
    const id = await conHistoria({ ...ESCOBA, stockInicial: '31' }, ['30'])
    vista = await montarVista(app, `/productos/${id}`)
    expect(texto(vista.wrapper)).toContain('Se acaba hoy')
  })

  it('RN-AN-05 / RN-AN-14: sin ventas en 4 semanas lo dice y no muestra la venta diaria', async () => {
    const id = await conHistoria({ ...ESCOBA, stockInicial: '10' }, [])
    vista = await montarVista(app, `/productos/${id}`)
    expect(texto(vista.wrapper)).toContain('Sin ventas en las últimas 4 semanas')
    expect(texto(vista.wrapper)).not.toContain('Vendes')
  })

  it('RN-AN-14: una venta diaria muy chica dice "menos de 0.1"', async () => {
    app.reloj.fijar(instanteLocal('2026-09-01 09:00'))
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '50' })
    app.reloj.fijar(instanteLocal('2026-09-25 11:00'))
    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '1' }] })
    app.reloj.fijar(HOY)
    await app.esperarTareasPendientes()
    vista = await montarVista(app, `/productos/${id}`)
    expect(texto(vista.wrapper)).toContain('Vendes menos de 0.1 unid. al día')
  })

  it('RN-AN-05: sin predicción (producto nuevo) no inventa la cobertura', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '12' })
    vista = await montarVista(app, `/productos/${id}`)
    expect(texto(vista.wrapper)).not.toContain('Se acaba')
    expect(texto(vista.wrapper)).not.toContain('Sin ventas')
    expect(texto(vista.wrapper)).not.toContain('Vendes')
  })

  it('RN-AN-14: la tendencia de 8 semanas con GraficoBarras', async () => {
    const id = await conHistoria({ ...ESCOBA, stockInicial: '100' }, ['30'])
    vista = await montarVista(app, `/productos/${id}`)
    const grafico = vista.wrapper.get('figure.grafico-barras')
    expect(grafico.get('figcaption').text()).toBe('Lo que vendiste por semana')
    const filas = grafico.findAll('tbody tr').map((f) => f.text())
    expect(filas).toHaveLength(8)
    expect(filas.at(-1)).toBe('9 al 15 oct0 unid.')
    expect(filas.at(-2)).toBe('2 al 8 oct30 unid.')
  })

  it('sin ninguna venta en esas 8 semanas lo dice en vez de un gráfico vacío', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '12' })
    vista = await montarVista(app, `/productos/${id}`)
    expect(vista.wrapper.find('figure.grafico-barras').exists()).toBe(false)
    expect(texto(vista.wrapper)).toContain(
      'Todavía no hay ventas de este producto en estas 8 semanas',
    )
  })

  it('los últimos movimientos: qué pasó, cuándo y cuánto', async () => {
    const id = await conHistoria({ ...ESCOBA, stockInicial: '100' }, ['30'])
    vista = await montarVista(app, `/productos/${id}`)
    expect(datos(vista.wrapper)).toMatchObject({
      'Venta · 02/10/2026, 11:00 a. m.': '-30 unid.',
      'Stock inicial · 01/10/2026, 9:00 a. m.': '+100 unid.',
    })
  })

  it('una ganancia negativa se muestra como pérdida y ofrece cambiar el precio', async () => {
    const id = await crearProducto(app, { ...ESCOBA, compra: '9.50', venta: '9.00' })
    vista = await montarVista(app, `/productos/${id}`)
    expect(datos(vista.wrapper)).toMatchObject({ 'Pierdes por unidad': 'S/ 0.50' })
    expect(texto(vista.wrapper)).toContain('Con este precio pierdes dinero')
    await boton(vista.wrapper, 'Cambiar el precio').trigger('click')
    await esperarRuta(vista.router, 'producto-editar')
  })

  it('Editar · Contar stock · Registrar pérdida abren sus pantallas por nombre', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '3' })
    vista = await montarVista(app, `/productos/${id}`)
    const ruta = () => vista!.router.currentRoute.value

    await boton(vista.wrapper, 'Contar stock').trigger('click')
    await esperarRuta(vista.router, 'contar-stock')
    expect(ruta().params.id).toBe(id)

    await vista.router.push(`/productos/${id}`)
    await esperar()
    await boton(vista.wrapper, 'Registrar pérdida').trigger('click')
    await esperarRuta(vista.router, 'merma')
    expect(ruta().params.id).toBe(id)

    await vista.router.push(`/productos/${id}`)
    await esperar()
    await boton(vista.wrapper, 'Editar producto').trigger('click')
    await esperarRuta(vista.router, 'producto-editar')
    expect(ruta().params.id).toBe(id)
  })

  it('mientras las pantallas del plan 12 no existan, sus botones llevan a Inicio', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '3' })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vista = await montarVista(app, `/productos/${id}`, { conOtrasRamas: false })
    await boton(vista.wrapper, 'Contar stock').trigger('click')
    await esperarRuta(vista.router, 'inicio')
    expect(vista.router.currentRoute.value.path).toBe('/')
  })

  it('RN-CAT-11: archivar con stock pide confirmar el retiro con su mensaje', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '4' })
    vista = await montarVista(app, `/productos/${id}`)
    const w = vista.wrapper

    await boton(w, 'Archivar producto').trigger('click')
    await esperar()
    const dialogo = w.get('dialog')
    expect(dialogo.attributes('open')).toBeDefined()
    // DialogoConfirmacion no deja partir "4 unid." (pegarCifras, plan 12): espacios duros.
    expect(dialogo.text().replace(/\u00a0/g, ' ')).toContain(
      'Aún quedan 4 unid. ¿Las retiramos del stock?',
    )

    await boton(w, 'No, dejarlo').trigger('click')
    await esperar()
    expect(w.get('dialog').attributes('open')).toBeUndefined()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(true)

    await boton(w, 'Archivar producto').trigger('click')
    await esperar()
    await boton(w, 'Sí, retirar y archivar').trigger('click')
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(false)
    const [retiro] = await app.inventario.historial({ productoId: id, tipo: 'AJUSTE' })
    expect(retiro?.motivo).toBe('Producto retirado')
    expect(estaArchivado(w)).toBe(true)
    expect(hayBoton(w, 'Reactivar producto')).toBe(true)
    expect(hayBoton(w, 'Archivar producto')).toBe(false)
    // RN-UX-11: la única confirmación (no hay Deshacer: se confirmó a propósito) queda junto a
    // las acciones, recibe el foco y se anuncia; así se ve y se oye donde estaba la persona.
    const hecho = w.get('.resultado')
    expect(leer(hecho.text())).toContain('Producto archivado')
    expect(leer(hecho.text())).toContain('Retiramos 4 unid. del stock.')
    expect(document.activeElement).toBe(hecho.element)
    expect(hecho.element.nextElementSibling?.classList.contains('acciones-finales')).toBe(true)
    expect(vista.aviso.activo.value).toBeUndefined()
    await vi.waitFor(() =>
      expect(vista!.anunciador.texto.value).toContain('Retiramos 4 unid. del stock.'),
    )
  })

  it('RN-CAT-11: decide con lo que dice el caso de uso, no con el stock de cuando se abrió', async () => {
    // Se abre sin stock y, mientras tanto, llega mercadería (otra pantalla): pide confirmar.
    const id = await crearProducto(app, ESCOBA)
    vista = await montarVista(app, `/productos/${id}`)
    await app.inventario.registrarIngreso({
      lineas: [{ productoId: id, cantidad: '2', costo: '6.00' }],
      confirmarSobrecompra: true,
    })
    await app.esperarTareasPendientes()

    await boton(vista.wrapper, 'Archivar producto').trigger('click')
    await esperar()
    expect(leer(vista.wrapper.get('dialog').text())).toContain('Aún quedan 2 unid.')
    await boton(vista.wrapper, 'Sí, retirar y archivar').trigger('click')
    await esperar()
    expect(leer(vista.wrapper.get('.resultado').text())).toContain('Retiramos 2 unid. del stock.')
    expect(vista.aviso.activo.value).toBeUndefined()
  })

  it('si reactivar falla después de archivar con stock, se ve el error (no el aviso viejo)', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '4' })
    vista = await montarVista(app, `/productos/${id}`)
    const w = vista.wrapper
    await boton(w, 'Archivar producto').trigger('click')
    await esperar()
    await boton(w, 'Sí, retirar y archivar').trigger('click')
    await esperar()
    expect(leer(w.get('.resultado').text())).toContain('Producto archivado')

    vi.spyOn(app.catalogo, 'reactivarProducto').mockRejectedValue(
      new ErrorDeDominio('PRODUCTO_NO_ENCONTRADO', 'No encontramos ese producto'),
    )
    await boton(w, 'Reactivar producto').trigger('click')
    await esperar()
    const resultado = w.get('.resultado')
    expect(resultado.get('[role="alert"]').text()).toContain('No encontramos ese producto')
    expect(leer(resultado.text())).not.toContain('Producto archivado')
    // role="alert" lo anuncia al aparecer; además recibe el foco, junto a las acciones.
    expect(document.activeElement).toBe(resultado.element)
  })

  it('RN-CAT-11: si al confirmar ya no quedaba stock, no informa un retiro viejo', async () => {
    // Un archivado anterior ya retiró 3; se reactiva y vuelve a tener 2.
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '3' })
    await app.catalogo.archivarProducto({ productoId: id, confirmado: true })
    await app.catalogo.reactivarProducto(id)
    await app.inventario.registrarIngreso({
      lineas: [{ productoId: id, cantidad: '2', costo: '6.00' }],
      confirmarSobrecompra: true,
    })
    await app.esperarTareasPendientes()
    vista = await montarVista(app, `/productos/${id}`)
    const w = vista.wrapper

    await boton(w, 'Archivar producto').trigger('click')
    await esperar()
    expect(leer(w.get('dialog').text())).toContain('Aún quedan 2 unid.')
    // Mientras el diálogo está abierto, se venden las 2 (otra pantalla): al confirmar no queda nada.
    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '2' }] })
    await app.esperarTareasPendientes()
    await boton(w, 'Sí, retirar y archivar').trigger('click')
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(false)
    const resultado = leer(w.get('.resultado').text())
    expect(resultado).toContain('Producto archivado')
    expect(resultado).not.toContain('Retiramos')
  })

  it('RN-UX-08: archivar sin stock no pregunta y ofrece Deshacer', async () => {
    const id = await crearProducto(app, ESCOBA)
    vista = await montarVista(app, `/productos/${id}`)
    await boton(vista.wrapper, 'Archivar producto').trigger('click')
    await esperar()
    expect(vista.wrapper.get('dialog').attributes('open')).toBeUndefined()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(false)
    expect(vista.aviso.activo.value?.mensaje).toBe('Archivaste Escoba')

    vista.aviso.activo.value?.alDeshacer()
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(true)
    expect(hayBoton(vista.wrapper, 'Archivar producto')).toBe(true)
  })

  it('un archivado se ve como archivado y se puede reactivar (con Deshacer)', async () => {
    const id = await crearProducto(app, ESCOBA)
    await app.catalogo.archivarProducto({ productoId: id })
    vista = await montarVista(app, `/productos/${id}`)
    const w = vista.wrapper
    expect(w.get('h1').text()).toBe('Escoba')
    expect(estaArchivado(w)).toBe(true)
    expect(hayBoton(w, 'Contar stock')).toBe(false)
    expect(hayBoton(w, 'Registrar pérdida')).toBe(false)

    await boton(w, 'Reactivar producto').trigger('click')
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(true)
    expect(vista.aviso.activo.value?.mensaje).toBe('Reactivaste Escoba')
    expect(estaArchivado(w)).toBe(false)
    expect(document.activeElement).toBe(boton(w, 'Editar producto').element)

    vista.aviso.activo.value?.alDeshacer()
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(false)
  })

  it('si "Deshacer" ya no puede archivarlo (llegó stock), lo dice en vez de callar', async () => {
    const id = await crearProducto(app, ESCOBA)
    await app.catalogo.archivarProducto({ productoId: id })
    vista = await montarVista(app, `/productos/${id}`)
    await boton(vista.wrapper, 'Reactivar producto').trigger('click')
    await esperar()
    await app.inventario.registrarIngreso({
      lineas: [{ productoId: id, cantidad: '3', costo: '6.00' }],
      confirmarSobrecompra: true,
    })
    await app.esperarTareasPendientes()

    vista.aviso.activo.value?.alDeshacer()
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(true)
    const alerta = vista.wrapper.get('[role="alert"]')
    expect(leer(alerta.text())).toContain('No pudimos deshacer: el producto ya tiene stock.')
    expect(leer(alerta.text())).toContain('Si quieres archivarlo, toca «Archivar producto».')
  })

  it('un producto que no existe: "No encontramos ese producto" y un camino de vuelta', async () => {
    vista = await montarVista(app, '/productos/no-existe')
    expect(vista.wrapper.get('h1').text()).toBe('No encontramos ese producto')
    await boton(vista.wrapper, 'Ver mis productos').trigger('click')
    await esperarRuta(vista.router, 'productos')
  })

  it('RN-UX-07: si no se puede leer el producto lo dice en lenguaje simple', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(app.catalogo, 'obtenerProducto').mockRejectedValue(new Error('IndexedDB cerrada'))
    vista = await montarVista(app, '/productos/p-1')
    expect(vista.wrapper.get('[role="alert"]').text()).toContain('No pudimos abrir este producto.')
    vi.restoreAllMocks()
  })
})

import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import type { AplicacionDePrueba } from '../../soporte/aplicacion-de-prueba'
import {
  crearAplicacion,
  crearProducto,
  esperar,
  esperarRuta,
  HOY,
  montarVista,
  type VistaMontada,
} from '../../soporte/pantallas-de-productos'

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

  it('Editar · Contar stock · Registrar merma abren sus pantallas por nombre', async () => {
    const id = await crearProducto(app, { ...ESCOBA, stockInicial: '3' })
    vista = await montarVista(app, `/productos/${id}`)
    const ruta = () => vista!.router.currentRoute.value

    await boton(vista.wrapper, 'Contar stock').trigger('click')
    await esperarRuta(vista.router, 'contar-stock')
    expect(ruta().params.id).toBe(id)

    await vista.router.push(`/productos/${id}`)
    await esperar()
    await boton(vista.wrapper, 'Registrar merma').trigger('click')
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
    expect(dialogo.text()).toContain('Aún quedan 4 unid. ¿Las retiramos del stock?')

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
    expect(texto(w)).toContain('Producto archivado')
    expect(texto(w)).toContain('Retiramos 4 unid. del stock.')
    expect(texto(w)).toContain('Este producto está archivado')
    expect(hayBoton(w, 'Reactivar producto')).toBe(true)
    expect(hayBoton(w, 'Archivar producto')).toBe(false)
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
    expect(texto(w)).toContain('Este producto está archivado')
    expect(hayBoton(w, 'Contar stock')).toBe(false)
    expect(hayBoton(w, 'Registrar merma')).toBe(false)

    await boton(w, 'Reactivar producto').trigger('click')
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(true)
    expect(vista.aviso.activo.value?.mensaje).toBe('Reactivaste Escoba')
    expect(texto(w)).not.toContain('Este producto está archivado')

    vista.aviso.activo.value?.alDeshacer()
    await esperar()
    expect((await app.catalogo.obtenerProducto(id))?.activo).toBe(false)
  })

  it('un producto que no existe: "No encontramos ese producto" y un camino de vuelta', async () => {
    vista = await montarVista(app, '/productos/no-existe')
    expect(vista.wrapper.get('h1').text()).toBe('No encontramos ese producto')
    await boton(vista.wrapper, 'Ver mis productos').trigger('click')
    await esperarRuta(vista.router, 'productos')
  })
})

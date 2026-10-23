import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

const HOY = instanteLocal('2026-10-15 10:00')
const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }
const CARBON = {
  nombre: 'Carbón',
  unidad: 'KILO' as const,
  compra: '2.75',
  venta: '4.00',
  minimo: '3',
}

describe('Inicio', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined

  async function tiendaLista(nombre = 'Bodega Rosita'): Promise<void> {
    await app.tienda.completarPrimeraVez({ nombreTienda: nombre, tamanoDeLetra: 'GRANDE' })
  }

  async function abrirInicio(): Promise<PantallaMontada> {
    pantalla = await montarPantalla(app, '/')
    return pantalla
  }

  function botonCon(texto: string) {
    const boton = pantalla!.wrapper
      .findAll('button, a')
      .find((b) => b.text().includes(texto) || b.attributes('aria-label') === texto)
    if (!boton) throw new Error(`No hay un botón o enlace "${texto}"`)
    return boton
  }

  beforeEach(() => {
    app = crearAplicacionDePrueba({ ahora: HOY })
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    await app.cerrar()
  })

  it('primera vez: Inicio lleva a la bienvenida', async () => {
    const { router } = await abrirInicio()

    expect(router.currentRoute.value.name).toBe('primera-vez')
  })

  it('plan 20: el encabezado es el nombre de la tienda en mayúsculas, sin saludo ni emoji', async () => {
    await tiendaLista('Bodega Rosita')
    const { wrapper } = await abrirInicio()

    expect(wrapper.get('h1').text()).toBe('BODEGA ROSITA')
    expect(wrapper.text()).not.toContain('Hola')
    expect(wrapper.text()).not.toContain('👋')
  })

  it('plan 20: el nombre guardado no cambia (solo se muestra en mayúsculas)', async () => {
    await tiendaLista('Bodega Rosita')
    await abrirInicio()

    expect((await app.tienda.obtenerConfiguracion()).nombreTienda).toBe('Bodega Rosita')
  })

  it('plan 20: Ajustes es solo la tuerca, con su nombre accesible y sin texto', async () => {
    await tiendaLista()
    const { wrapper } = await abrirInicio()

    const ajustes = wrapper.get('a.enlace-ajustes')
    expect(ajustes.attributes('aria-label')).toBe('Ajustes')
    expect(ajustes.text()).toBe('')
    expect(ajustes.find('svg').exists()).toBe(true)
  })

  it('plan 20: la fecha va en mayúsculas y sin hora', async () => {
    await tiendaLista()
    const { wrapper } = await abrirInicio()

    expect(wrapper.get('.fecha-de-hoy').text()).toMatch(/^[A-ZÁÉÍÓÚÑ]+ \d{1,2} DE [A-ZÁÉÍÓÚÑ]+$/)
    expect(wrapper.find('.hora').exists()).toBe(false)
  })

  it('RN-AN-03: muestra la ganancia neta y las ventas de hoy', async () => {
    await tiendaLista()
    const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '2' }] })

    const { wrapper } = await abrirInicio()

    const [vendido, ganancia] = wrapper.findAll('.tarjeta-de-cifra')
    expect(vendido?.text()).toContain('Total vendido')
    expect(vendido?.text()).toContain('S/ 7.00')
    expect(ganancia?.text()).toContain('Ganancia real')
    expect(ganancia?.text()).toContain('S/ 2.20')
  })

  it('RN-AN-03: sin ventas hoy lo dice con palabras', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })

    const { wrapper } = await abrirInicio()

    expect(
      wrapper
        .get('.cifras-de-hoy')
        .text()
        .match(/Todavía no hay ventas hoy/g),
    ).toHaveLength(1)
  })

  it('RN-AL-06: avisa cuántos productos se acaban y lleva a Productos ya filtrado', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    await crearProductoDePrueba(app, { ...CARBON, stockInicial: '2' })
    const { wrapper, router } = await abrirInicio()

    const aviso = wrapper.get('.fila-de-aviso--atencion')
    expect(aviso.text()).toContain('2 productos se acaban')
    // Fila compacta: sin el subtítulo "1 agotado y 1 por acabarse".
    expect(aviso.text()).not.toContain('agotado')

    await botonCon('Ver productos').trigger('click')
    await esperarPantalla()
    expect(router.currentRoute.value.name).toBe('productos')
    expect(router.currentRoute.value.query).toEqual({ estado: 'se-acaban' })
  })

  it('RN-AL-06: si nada se acaba, lo dice', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })

    const { wrapper } = await abrirInicio()

    expect(wrapper.text()).toContain('Todo bien: no falta nada')
    expect(wrapper.find('.fila-de-aviso--atencion').exists()).toBe(false)
  })

  it('RN-UX-10: sin productos ofrece agregar el primero', async () => {
    await tiendaLista()
    const { wrapper, router } = await abrirInicio()

    expect(wrapper.text()).toContain('Aún no tienes productos')
    await botonCon('Agregar el primero').trigger('click')
    await esperarPantalla()
    expect(router.currentRoute.value.name).toBe('producto-nuevo')
  })

  it.each([
    ['Vender', 'vender'],
    ['Llegó mercadería', 'recibir'],
    ['¿Necesito comprar?', 'necesito-comprar'],
    ['Ajustes', 'ajustes'],
  ])('RN-UX-12: "%s" abre su pantalla', async (texto, nombre) => {
    await tiendaLista()
    const { router } = await abrirInicio()

    await botonCon(texto).trigger('click')
    await esperarPantalla()

    expect(router.currentRoute.value.name).toBe(nombre)
  })

  it('RN-UX-12: "Movimientos" abre la hoja del historial sin salir de Inicio', async () => {
    await tiendaLista()
    const { wrapper, router } = await abrirInicio()

    await botonCon('Movimientos').trigger('click')
    await esperarPantalla()

    expect(router.currentRoute.value.name).toBe('inicio')
    // La hoja se carga recién al abrirla.
    await vi.waitFor(() => expect(wrapper.find('.hoja-inferior').exists()).toBe(true))
    expect(wrapper.get('.hoja-inferior h2').text()).toBe('Movimientos')
  })

  it('plan 19: Inicio es solo para vender: sin resumen del día, recordatorios ni instalación', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    await app.tienda.actualizarConfiguracion({
      alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 120000, dias: [16] },
    })
    const { wrapper } = await abrirInicio()

    expect(wrapper.find('[data-resumen-del-dia]').exists()).toBe(false)
    for (const texto of [
      'Resumen del día',
      'guardas una copia',
      'pagas el local',
      'Instala la app',
    ]) {
      expect(wrapper.text()).not.toContain(texto)
    }
  })

  it('orden: encabezado, fecha, cifras, aviso y al final las acciones', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    const { wrapper } = await abrirInicio()

    const html = wrapper.html()
    const posicion = (marca: string) => {
      const i = html.indexOf(marca)
      if (i < 0) throw new Error(`No está "${marca}"`)
      return i
    }
    const orden = [
      posicion('class="saludo"'),
      posicion('class="fecha-de-hoy"'),
      posicion('tarjeta-de-cifra'),
      posicion('fila-de-aviso--atencion'),
      posicion('class="acciones"'),
      posicion('class="enlace-movimientos"'),
    ]
    expect(orden).toEqual([...orden].sort((a, b) => a - b))
  })
})

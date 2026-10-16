import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { capturarDescargas, type Descarga } from '../soporte/archivos-en-pantalla'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

const HOY = instanteLocal('2026-10-15 20:30')
const VERSION = (
  JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    version: string
  }
).version

describe('Ajustes', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined
  let descargas: Descarga[]

  function control(texto: string) {
    const encontrado = pantalla!.wrapper
      .findAll('button, a')
      .find(
        (b) =>
          b.text().trim() === texto ||
          (b.find('.titulo').exists() && b.get('.titulo').text() === texto),
      )
    if (!encontrado) throw new Error(`No hay "${texto}" en: ${pantalla!.wrapper.text()}`)
    return encontrado
  }

  async function tocar(texto: string): Promise<void> {
    await control(texto).trigger('click')
    await esperarPantalla()
  }

  beforeEach(async () => {
    app = crearAplicacionDePrueba({ ahora: HOY })
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
    descargas = capturarDescargas()
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    document.documentElement.removeAttribute('data-letra')
    vi.restoreAllMocks()
    await app.cerrar()
  })

  it.each([
    ['Datos de la tienda', 'datos-de-la-tienda'],
    ['Categorías', 'categorias'],
    ['Guardar copia', 'guardar-copia'],
    ['Restaurar copia', 'restaurar-copia'],
    ['Importar productos', 'importar-productos'],
  ])('"%s" abre su pantalla', async (texto, nombre) => {
    pantalla = await montarPantalla(app, '/ajustes')
    expect(pantalla.wrapper.get('h1').text()).toBe('Ajustes')

    await tocar(texto)

    expect(pantalla.router.currentRoute.value.name).toBe(nombre)
  })

  it('resume los datos de la tienda y la última copia', async () => {
    pantalla = await montarPantalla(app, '/ajustes')

    const texto = pantalla.wrapper.text().replaceAll(' ', ' ')
    expect(texto).toContain('Bodega Rosita · compras cada 7 días')
    expect(texto).toContain('Todavía no guardas una copia de tus datos')
  })

  it('RN-UX-01: el tamaño de letra cambia toda la app al elegirlo y queda guardado', async () => {
    pantalla = await montarPantalla(app, '/ajustes')

    await tocar('Muy grande')

    expect(document.documentElement.dataset.letra).toBe('MUY_GRANDE')
    expect((await app.tienda.obtenerConfiguracion()).tamanoDeLetra).toBe('MUY_GRANDE')
    await vi.waitFor(() => expect(pantalla!.estadoGlobal.tamanoDeLetra).toBe('MUY_GRANDE'))
  })

  it('M1: desactivar los avisos lo guarda en la configuración de la tienda', async () => {
    app.notificador.permiso = true
    await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
    pantalla = await montarPantalla(app, '/ajustes')
    expect(pantalla.wrapper.text()).toContain('Los avisos en tu celular están activados')

    await tocar('Desactivar avisos')

    expect((await app.tienda.obtenerConfiguracion()).notificacionesActivas).toBe(false)
    expect(await app.alertas.notificacionesPermitidas()).toBe(false)
    expect(pantalla.wrapper.text()).toContain('Los avisos en tu celular están desactivados')
  })

  it('RN-AL-08: sin avisos, explica cómo activarlos y lleva a "Avisos en tu celular"', async () => {
    pantalla = await montarPantalla(app, '/ajustes')

    expect(pantalla.wrapper.text()).toContain('ajustes del navegador')
    await tocar('Activar avisos')

    expect(pantalla.router.currentRoute.value.name).toBe('avisos')
    expect(app.notificador.solicitudes).toBe(0)
  })

  it('RN-RE-01: exporta el inventario a Excel y lo entrega', async () => {
    await crearProductoDePrueba(app, {
      nombre: 'Lejía 1 L',
      compra: '2.40',
      venta: '3.50',
      stockInicial: '10',
    })
    pantalla = await montarPantalla(app, '/ajustes')

    await tocar('Exportar a Excel')

    expect(descargas.map((d) => d.nombre)).toEqual(['inventario-bodega-rosita-2026-10-15.xlsx'])
    expect(app.generadorDeExcel.hojasGeneradas.map((h) => h.nombre)).toEqual([
      'Productos',
      'Movimientos',
      'Resumen diario',
    ])
    expect(pantalla.wrapper.text()).toContain('inventario-bodega-rosita-2026-10-15.xlsx')
  })

  it('RN-OP-19: "Revisar datos" corrige el stock que no cuadra e informa qué cambió', async () => {
    const lejia = await crearProductoDePrueba(app, {
      nombre: 'Lejía 1 L',
      compra: '2.40',
      venta: '3.50',
      stockInicial: '10',
    })
    await app.infraestructura.repositorios.existencias.fijar(lejia, Cantidad.deTexto('7', 'UNIDAD'))
    pantalla = await montarPantalla(app, '/ajustes')

    await tocar('Revisar datos')

    expect(pantalla.wrapper.text().replaceAll(' ', ' ')).toContain(
      'Corregimos el stock de 1 producto: Lejía 1 L (7 unid. → 10 unid.)',
    )
    expect((await app.inventario.consultable.stockDe(lejia)).milesimas).toBe(10_000)
  })

  it('RN-OP-19: si todo cuadra, lo dice', async () => {
    pantalla = await montarPantalla(app, '/ajustes')

    await tocar('Revisar datos')

    expect(pantalla.wrapper.text()).toContain('Todo está en orden')
  })

  it('Acerca de: muestra la versión de la app', async () => {
    pantalla = await montarPantalla(app, '/ajustes')

    expect(pantalla.wrapper.text()).toContain(`Versión ${VERSION}`)
  })
})

describe('Datos de la tienda', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined

  function campo(etiqueta: string) {
    const label = pantalla!.wrapper.findAll('label').find((l) => l.text() === etiqueta)
    if (!label) throw new Error(`No hay un campo "${etiqueta}"`)
    return pantalla!.wrapper.get(`#${label.attributes('for')}`)
  }

  async function guardar(): Promise<void> {
    const boton = pantalla!.wrapper.findAll('button').find((b) => b.text() === 'Guardar cambios')
    await boton!.trigger('click')
    await esperarPantalla()
  }

  beforeEach(async () => {
    app = crearAplicacionDePrueba({ ahora: HOY })
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    await app.cerrar()
  })

  it('muestra los valores guardados y guarda los cambios', async () => {
    pantalla = await montarPantalla(app, '/ajustes/tienda')
    expect(pantalla.wrapper.get('h1').text()).toBe('Datos de la tienda')
    expect((campo('Nombre de la tienda').element as HTMLInputElement).value).toBe('Bodega Rosita')
    expect(
      (campo('¿Cada cuántos días compras mercadería?').element as HTMLInputElement).value,
    ).toBe('7')

    await campo('Nombre de la tienda').setValue('Bodega Rosita 2')
    await campo('¿Cada cuántos días compras mercadería?').setValue('10')
    await campo('¿Con cuántos días de anticipación te aviso?').setValue('5')
    await campo('Avísame si una compra alcanza para más de').setValue('45')
    await guardar()

    expect(await app.tienda.obtenerConfiguracion()).toMatchObject({
      nombreTienda: 'Bodega Rosita 2',
      diasEntreCompras: 10,
      diasAnticipacion: 5,
      diasMaximosDeCompra: 45,
    })
    expect(pantalla.wrapper.get('h1').text()).toBe('Cambios guardados')
  })

  it('los rangos de la configuración se explican junto a cada campo y no se guarda nada', async () => {
    pantalla = await montarPantalla(app, '/ajustes/tienda')

    await campo('Nombre de la tienda').setValue('  ')
    await campo('¿Cada cuántos días compras mercadería?').setValue('0')
    await campo('Avísame si una compra alcanza para más de').setValue('6')
    await guardar()

    const texto = pantalla.wrapper.text()
    expect(texto).toContain('Escribe el nombre de tu tienda')
    expect(texto).toContain('Elige un número entre 1 y 60')
    expect(texto).toContain('Elige un número entre 7 y 180')
    expect((await app.tienda.obtenerConfiguracion()).diasEntreCompras).toBe(7)
    expect(pantalla.wrapper.get('h1').text()).toBe('Datos de la tienda')
  })
})

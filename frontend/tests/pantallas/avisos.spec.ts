import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'

const HOY = instanteLocal('2026-10-15 10:00')

describe('Avisos en tu celular', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined

  async function tocar(texto: string): Promise<void> {
    const boton = pantalla!.wrapper.findAll('button').find((b) => b.text().trim() === texto)
    if (!boton) throw new Error(`No hay un botón "${texto}" en: ${pantalla!.wrapper.text()}`)
    await boton.trigger('click')
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

  it('RN-AL-08: explica para qué sirven y pide el permiso solo al tocar "Sí, avísame"', async () => {
    pantalla = await montarPantalla(app, '/ajustes/avisos')

    expect(pantalla.wrapper.get('h1').text()).toBe('Avisos en tu celular')
    expect(pantalla.wrapper.text()).toContain('se acaba o está por acabarse')
    expect(app.notificador.solicitudes).toBe(0)

    await tocar('Sí, avísame')

    expect(app.notificador.solicitudes).toBe(1)
  })

  it('M1 (RN-AL-06c): al conceder el permiso queda activado en la configuración de la tienda', async () => {
    app.notificador.permiso = true
    pantalla = await montarPantalla(app, '/ajustes/avisos')

    await tocar('Sí, avísame')

    expect((await app.tienda.obtenerConfiguracion()).notificacionesActivas).toBe(true)
    expect(await app.alertas.notificacionesPermitidas()).toBe(true)
    expect(pantalla.wrapper.get('h1').text()).toBe('Listo, te avisaremos')
  })

  it('M1: con el permiso activado, un producto que se acaba llega como notificación del sistema', async () => {
    app.notificador.permiso = true
    pantalla = await montarPantalla(app, '/ajustes/avisos')
    await tocar('Sí, avísame')
    await app.esperarTareasPendientes()
    app.notificador.mostradas = []

    const [categoria] = await app.catalogo.listarCategorias()
    await app.catalogo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId: categoria!.id,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
      stockInicial: '0',
    })
    await app.esperarTareasPendientes()

    expect(app.notificador.mostradas.map((n) => n.texto)).toEqual(['Se acabó: Lejía 1 L'])
  })

  it('RN-AL-08: si se rechaza, sigue con los avisos dentro de la app y explica cómo activarlos', async () => {
    app.notificador.permiso = false
    pantalla = await montarPantalla(app, '/ajustes/avisos')

    await tocar('Sí, avísame')

    expect((await app.tienda.obtenerConfiguracion()).notificacionesActivas).toBe(false)
    const texto = pantalla.wrapper.text()
    expect(texto).toContain('No se activaron los avisos')
    expect(texto).toContain('ajustes del navegador')
    expect(texto).toContain('Inicio')
  })

  it('si ya están activados, lo dice y no vuelve a pedir el permiso', async () => {
    await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
    pantalla = await montarPantalla(app, '/ajustes/avisos')

    expect(pantalla.wrapper.text()).toContain('Ya tienes los avisos activados')
    expect(pantalla.wrapper.findAll('button').some((b) => b.text() === 'Sí, avísame')).toBe(false)
  })

  it('"Ahora no" vuelve sin pedir nada', async () => {
    pantalla = await montarPantalla(app, '/ajustes/avisos')

    await tocar('Ahora no')

    expect(app.notificador.solicitudes).toBe(0)
    expect(pantalla.router.currentRoute.value.name).toBe('ajustes')
  })
})

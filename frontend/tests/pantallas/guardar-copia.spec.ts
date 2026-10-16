import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import {
  capturarDescargas,
  leerTexto,
  quitarMenuDeCompartir,
  simularMenuDeCompartir,
  type Descarga,
} from '../soporte/archivos-en-pantalla'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

const HOY = instanteLocal('2026-10-15 20:30')

describe('Guardar copia', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined
  let descargas: Descarga[]

  async function tocar(texto: string): Promise<void> {
    const boton = pantalla!.wrapper.findAll('button').find((b) => b.text().trim() === texto)
    if (!boton) throw new Error(`No hay un botón "${texto}" en: ${pantalla!.wrapper.text()}`)
    await boton.trigger('click')
    await esperarPantalla()
  }

  beforeEach(async () => {
    app = crearAplicacionDePrueba({ ahora: HOY })
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
    await crearProductoDePrueba(app, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', stockInicial: '10' })
    descargas = capturarDescargas()
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    quitarMenuDeCompartir()
    vi.restoreAllMocks()
    await app.cerrar()
  })

  it('RN-RE-02/06: entrega la copia completa y recién entonces la marca como guardada', async () => {
    pantalla = await montarPantalla(app, '/ajustes/copia')
    expect(pantalla.wrapper.get('h1').text()).toBe('Guardar copia')
    expect(pantalla.wrapper.text()).toContain('Todavía no guardas una copia de tus datos')

    await tocar('Guardar copia ahora')

    expect(descargas.map((d) => d.nombre)).toEqual(['respaldo-bodega-rosita-2026-10-15-2030.json'])
    const { resumen } = await app.respaldo.prepararRestauracion(await leerTexto(descargas[0]!.contenido))
    expect(resumen.texto).toBe('1 producto, 1 movimiento, del 15/10/2026 al 15/10/2026')
    expect((await app.tienda.consultable.estadoDelSistema()).ultimoRespaldoEn).not.toBeNull()
    expect(await app.respaldo.recordatorioDeCopia()).toBeNull()
    expect(pantalla.estadoGlobal.recordatorioDeCopia).toBeNull()
    expect(pantalla.wrapper.get('h1').text()).toBe('Copia guardada')
    expect(pantalla.wrapper.text()).toContain('respaldo-bodega-rosita-2026-10-15-2030.json')
  })

  it('RN-RE-06: si cierra el menú de compartir sin elegir, la copia no cuenta como guardada', async () => {
    simularMenuDeCompartir(async () => {
      throw new DOMException('Cancelado', 'AbortError')
    })
    pantalla = await montarPantalla(app, '/ajustes/copia')

    await tocar('Guardar copia ahora')

    expect((await app.tienda.consultable.estadoDelSistema()).ultimoRespaldoEn).toBeNull()
    expect(pantalla.wrapper.text()).toContain('No se guardó la copia')
    expect(pantalla.wrapper.get('h1').text()).toBe('Guardar copia')
  })

  it('con menú de compartir, la manda (WhatsApp, Drive) y también ofrece descargarla', async () => {
    simularMenuDeCompartir(async () => undefined)
    pantalla = await montarPantalla(app, '/ajustes/copia')

    await tocar('Descargar en este celular')

    expect(descargas).toHaveLength(1)
    expect(pantalla.wrapper.get('h1').text()).toBe('Copia guardada')
  })

  it('dice cuándo fue la última copia', async () => {
    await app.respaldo.marcarCopiaGuardada()
    pantalla = await montarPantalla(app, '/ajustes/copia')

    expect(pantalla.wrapper.text()).toContain('15/10/2026')
  })
})

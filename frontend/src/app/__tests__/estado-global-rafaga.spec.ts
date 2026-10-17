import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import {
  ALMACENES,
  crearAplicacionDePrueba,
  type Almacen,
  type AplicacionDePrueba,
} from '../../../tests/soporte/aplicacion-de-prueba'
import { crearProductoDePrueba } from '../../../tests/soporte/productos-de-prueba'
import { abrirApp } from '../abrir-app'
import { useEstadoGlobal } from '../estado-global'

const HOY = instanteLocal('2026-10-15 08:00')
const VENTANA = 300
const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }
const JABON = { nombre: 'Jabón', compra: '1.20', venta: '2.00', minimo: '2' }

/** La app de prueba con el estado global conectado y dos productos con stock. */
async function preparar(almacen: Almacen) {
  setActivePinia(createPinia())
  const app = crearAplicacionDePrueba({ ahora: HOY, almacen, ventanaDeReevaluacionMs: VENTANA })
  await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
  const inicio = await abrirApp(app, { aplicarTamanoDeLetra: () => undefined })
  const estado = useEstadoGlobal()
  estado.conectar(app, inicio)
  const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '12' })
  const jabon = await crearProductoDePrueba(app, { ...JABON, stockInicial: '30' })
  await app.esperarTareasPendientes()
  await estado.refrescarAtencion()
  app.notificador.mostradas = []
  return { app, estado, lejia, jabon }
}

/** Diez ventas seguidas: la lejía pasa a "queda poco" a mitad de la ráfaga. */
async function diezVentas(
  app: AplicacionDePrueba,
  lejia: string,
  jabon: string,
  entreCadaUna: () => Promise<void>,
) {
  for (let i = 0; i < 10; i += 1) {
    await app.inventario.registrarVenta({
      lineas: [
        { productoId: lejia, cantidad: '1' },
        { productoId: jabon, cantidad: '1' },
      ],
    })
    await entreCadaUna()
  }
}

describe.each(ALMACENES)('RN-SIS-09: avisos y contador con un solo cálculo (%s)', (almacen) => {
  let app: AplicacionDePrueba

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })

  afterEach(async () => {
    vi.useRealTimers()
    useEstadoGlobal().desconectar()
    vi.restoreAllMocks()
    await app.cerrar()
  })

  it('RN-SIS-09: tras una venta, avisos y contador salen de UNA lectura de situaciones', async () => {
    const preparado = await preparar(almacen)
    app = preparado.app
    const situaciones = vi.spyOn(app.analisis.consultable, 'situaciones')

    await app.inventario.registrarVenta({
      lineas: [{ productoId: preparado.lejia, cantidad: '10' }],
    })
    await app.esperarTareasPendientes()

    expect(situaciones).toHaveBeenCalledTimes(1)
    expect(preparado.estado.contadorDeAtencion).toBe(1)
    expect(app.notificador.mostradas).toEqual([
      { texto: 'Queda poco: Lejía 1 L (2 unid.)', url: `/productos/${preparado.lejia}` },
    ])
  })

  it('RN-SIS-09: diez ventas seguidas producen 1 cálculo (no 20) y terminan con el mismo contador y avisos que sin juntar', async () => {
    // Sin juntar: cada venta espera su re-evaluación antes de la siguiente.
    const sinJuntar = await preparar(almacen)
    await diezVentas(sinJuntar.app, sinJuntar.lejia, sinJuntar.jabon, () =>
      sinJuntar.app.esperarTareasPendientes(),
    )
    const esperado = {
      contador: sinJuntar.estado.contadorDeAtencion,
      avisos: await sinJuntar.app.infraestructura.repositorios.avisos.todos(),
    }
    const mostradasSinJuntar = sinJuntar.app.notificador.mostradas
    sinJuntar.estado.desconectar()
    await sinJuntar.app.cerrar()

    const enRafaga = await preparar(almacen)
    app = enRafaga.app
    const situaciones = vi.spyOn(app.analisis.consultable, 'situaciones')
    await diezVentas(app, enRafaga.lejia, enRafaga.jabon, async () => undefined)
    expect(situaciones).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(VENTANA)
    await app.esperarTareasPendientes()

    expect(situaciones.mock.calls.length).toBeLessThanOrEqual(2)
    expect({
      contador: enRafaga.estado.contadorDeAtencion,
      avisos: await app.infraestructura.repositorios.avisos.todos(),
    }).toStrictEqual(esperado)
    expect(esperado).toMatchObject({
      contador: 1,
      avisos: [{ productoId: enRafaga.lejia, ultimoEstadoAvisado: 'POR_ACABARSE' }],
    })
    // El mismo aviso, una sola vez (RN-AL-03). Su texto lleva el stock de cuando se evaluó:
    // sin juntar, el de la venta que lo cruzó; en ráfaga, el de después de la última venta.
    expect(mostradasSinJuntar).toEqual([
      { texto: 'Queda poco: Lejía 1 L (3 unid.)', url: `/productos/${enRafaga.lejia}` },
    ])
    expect(app.notificador.mostradas).toEqual([
      { texto: 'Queda poco: Lejía 1 L (2 unid.)', url: `/productos/${enRafaga.lejia}` },
    ])
  })
})

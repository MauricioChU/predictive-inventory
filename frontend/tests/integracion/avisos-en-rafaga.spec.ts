// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import {
  ALMACENES,
  crearAplicacionDePrueba,
  type AplicacionDePrueba,
} from '../soporte/aplicacion-de-prueba'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

const HOY = instanteLocal('2026-10-15 10:00')
const VENTANA = 300
const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }

/**
 * RN-AL-02 (nota de RN-SIS-09): las operaciones seguidas se re-evalúan juntas al final de la
 * ventana, comparando el estado final con el último avisado. Lo que pasa DENTRO de la ventana
 * no avisa por sí solo; con más tiempo entre una operación y otra, todo es como siempre.
 */
describe.each(ALMACENES)('RN-AL-02: operaciones seguidas se re-evalúan juntas (%s)', (almacen) => {
  let app: AplicacionDePrueba
  let lejia = ''

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    app = crearAplicacionDePrueba({ ahora: HOY, almacen, ventanaDeReevaluacionMs: VENTANA })
    await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
    lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '5' })
    await app.esperarTareasPendientes()
    app.notificador.mostradas = []
  })

  afterEach(async () => {
    vi.useRealTimers()
    await app.cerrar()
  })

  const vender = (cantidad: string) =>
    app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad }] })
  const recibir = (cantidad: string) =>
    app.inventario.registrarIngreso({ lineas: [{ productoId: lejia, cantidad, costo: '2.40' }] })
  const registro = () => app.infraestructura.repositorios.avisos.todos()
  const QUEDA_POCO = () => ({
    texto: 'Queda poco: Lejía 1 L (3 unid.)',
    url: `/productos/${lejia}`,
  })

  /** Deja pasar la ventana: corre la re-evaluación programada. */
  async function pasaLaVentana(): Promise<void> {
    await vi.advanceTimersByTimeAsync(VENTANA + 1)
    await app.esperarTareasPendientes()
  }

  /** Ya se avisó "Queda poco" (stock 3, mínimo 3). */
  async function yaAvisado(): Promise<void> {
    await vender('2')
    await pasaLaVentana()
    expect(app.notificador.mostradas).toEqual([QUEDA_POCO()])
    app.notificador.mostradas = []
  }

  it('RN-AL-04: un rearme dentro de una misma ventana (queda poco → bien → queda poco) no vuelve a avisar', async () => {
    await yaAvisado()

    await recibir('5') // 8: bien
    await vender('5') // 3: queda poco otra vez
    await pasaLaVentana()

    expect(app.notificador.mostradas).toEqual([])
    expect(await registro()).toEqual([{ productoId: lejia, ultimoEstadoAvisado: 'POR_ACABARSE' }])
  })

  it('RN-AL-04: con más tiempo que la ventana entre una y otra, el rearme vuelve a avisar (como siempre)', async () => {
    await yaAvisado()

    await recibir('5')
    await pasaLaVentana()
    expect(await registro()).toEqual([{ productoId: lejia, ultimoEstadoAvisado: 'NORMAL' }])
    await vender('5')
    await pasaLaVentana()

    expect(app.notificador.mostradas).toEqual([QUEDA_POCO()])
    expect(await registro()).toEqual([{ productoId: lejia, ultimoEstadoAvisado: 'POR_ACABARSE' }])
  })

  it('RN-AL-03: un empeoramiento que se deshace dentro de la misma ventana no avisa', async () => {
    await vender('2') // 3: queda poco
    await app.inventario.deshacer.deshacer() // 5: bien otra vez
    await pasaLaVentana()

    expect(app.notificador.mostradas).toEqual([])
    expect(await registro()).toEqual([])
    expect((await app.alertas.resumenDeAtencion()).contador).toBe(0)
  })

  it('RN-AL-03: con más tiempo que la ventana, el empeoramiento avisa y deshacerlo rearma (como siempre)', async () => {
    await vender('2')
    await pasaLaVentana()
    expect(app.notificador.mostradas).toEqual([QUEDA_POCO()])

    await app.inventario.deshacer.deshacer()
    await pasaLaVentana()

    expect(app.notificador.mostradas).toEqual([QUEDA_POCO()])
    expect(await registro()).toEqual([{ productoId: lejia, ultimoEstadoAvisado: 'NORMAL' }])
  })
})

// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { instanteLocal } from '@/shared/domain/fecha'
import {
  ALMACENES,
  crearAplicacionDePrueba,
  type AplicacionDePrueba,
} from '../soporte/aplicacion-de-prueba'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

const HOY = instanteLocal('2026-10-15 10:00')

const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

describe.each(ALMACENES)('Composición de la aplicación (%s)', (almacen) => {
  let app: AplicacionDePrueba

  async function nuevaApp(): Promise<AplicacionDePrueba> {
    app = crearAplicacionDePrueba({ ahora: HOY, almacen })
    await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
    return app
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    await app.cerrar()
  })

  it('ADR-0002: una venta actualiza las existencias y la proyección de Análisis a la vez', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })

    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '4' }] })

    expect((await app.inventario.consultable.stockDe(id)).milesimas).toBe(6000)
    const resumen = await app.analisis.consultarResumen('HOY')
    expect(resumen.ventas.centimos).toBe(1400)
    expect(resumen.gananciaBruta.centimos).toBe(440)
  })

  it('RN-AL-02: Alertas escucha el bus: una venta que deja poco stock avisa, después de confirmar', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '5' })
    await app.esperarTareasPendientes()
    expect(app.notificador.mostradas).toEqual([])

    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '3' }] })
    await app.esperarTareasPendientes()

    expect(app.notificador.mostradas).toEqual([
      { texto: 'Queda poco: Lejía 1 L (2 unid.)', url: `/productos/${id}` },
    ])
    expect((await app.alertas.resumenDeAtencion()).contador).toBe(1)
  })

  it('RN-CAT-08: el stock inicial lo registra Inventario dentro de la creación del producto, sin ofrecer Deshacer', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '7' })

    expect((await app.inventario.consultable.stockDe(id)).milesimas).toBe(7000)
    const historial = await app.inventario.historial()
    expect(historial.map((o) => o.tipo)).toEqual(['STOCK_INICIAL'])
    expect(app.inventario.deshacer.disponible()).toBeNull()
  })

  it('RN-OP-19: tras revisar datos la composición vuelve a evaluar los avisos y avisa el cambio en bloque', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '2' })
    // Alguien alteró la existencia guardada "por fuera" (sin operación ni evento): con 10, el
    // producto se ve NORMAL y ese estado queda registrado como el último avisado.
    await app.infraestructura.repositorios.existencias.fijar(id, Cantidad.deEntero(10))
    await app.alertas.evaluarAvisos()
    app.notificador.mostradas = []
    const cambios = vi.fn()
    app.alCambiarEnBloque(cambios)

    const revision = await app.inventario.revisarDatos()
    await app.esperarTareasPendientes()

    expect(revision.mensaje).toBe(
      'Corregimos el stock de 1 producto: Lejía 1 L (10 unid. → 2 unid.)',
    )
    expect(cambios).toHaveBeenCalledTimes(1)
    expect(app.notificador.mostradas).toEqual([
      { texto: 'Queda poco: Lejía 1 L (2 unid.)', url: `/productos/${id}` },
    ])
  })

  it('RN-OP-19: reconstruirExistencias también re-evalúa y avisa el cambio en bloque', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '2' })
    await app.infraestructura.repositorios.existencias.fijar(id, Cantidad.deEntero(10))
    await app.alertas.evaluarAvisos()
    app.notificador.mostradas = []
    const cambios = vi.fn()
    app.alCambiarEnBloque(cambios)

    await app.inventario.reconstruirExistencias()
    await app.esperarTareasPendientes()

    expect((await app.inventario.consultable.stockDe(id)).milesimas).toBe(2000)
    expect(cambios).toHaveBeenCalledTimes(1)
    expect(app.notificador.mostradas).toHaveLength(1)
  })

  it('RN-RE-04: restaurar reconstruye con Inventario y, al confirmar, re-evalúa y avisa el cambio en bloque', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '2' })
    await app.esperarTareasPendientes() // la copia ya lleva el aviso "Queda poco" registrado
    const copia = await (await app.respaldo.guardarCopia()).contenido.text()
    await app.inventario.registrarIngreso({
      lineas: [{ productoId: id, cantidad: '8', costo: '2.40' }],
    })
    await app.esperarTareasPendientes()
    app.notificador.mostradas = []
    const cambios = vi.fn()
    app.alCambiarEnBloque(cambios)

    await app.respaldo.restaurarCopia(copia, { confirmaciones: 2 })
    await app.esperarTareasPendientes()

    expect((await app.inventario.consultable.stockDe(id)).milesimas).toBe(2000)
    expect(cambios).toHaveBeenCalledTimes(1)
    // La copia trae el aviso "Queda poco" ya dado: restaurar no lo repite (RN-AL-03).
    expect(app.notificador.mostradas).toEqual([])
    expect((await app.alertas.resumenDeAtencion()).contador).toBe(1)
  })

  it('RN-RE-03: una restauración que falla no avisa ningún cambio en bloque', async () => {
    await nuevaApp()
    const cambios = vi.fn()
    app.alCambiarEnBloque(cambios)

    await expect(
      app.respaldo.restaurarCopia('{"no": "es una copia"}', { confirmaciones: 2 }),
    ).rejects.toThrow()
    await app.esperarTareasPendientes()

    expect(cambios).not.toHaveBeenCalled()
  })

  it('un manejador de cambios en bloque que falla se registra y no afecta a la operación ni a los demás', async () => {
    await nuevaApp()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const despues = vi.fn()
    app.alCambiarEnBloque(() => {
      throw new Error('falla el manejador')
    })
    app.alCambiarEnBloque(despues)

    await expect(app.inventario.reconstruirExistencias()).resolves.toBeUndefined()

    expect(despues).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(
      'Falló un manejador de cambios en bloque:',
      expect.any(Error),
    )
  })

  it('alCambiarEnBloque devuelve la función para dejar de escuchar', async () => {
    await nuevaApp()
    const cambios = vi.fn()
    const cancelar = app.alCambiarEnBloque(cambios)
    cancelar()

    await app.inventario.reconstruirExistencias()

    expect(cambios).not.toHaveBeenCalled()
  })

  it('esperarTareasPendientes espera también lo que publica una acción suelta (eventos encadenados)', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '5' })
    await app.esperarTareasPendientes()
    // Una acción alConfirmar fuera de una transacción (nadie la espera) que, más tarde,
    // registra una venta: su evento encola otra evaluación de avisos.
    app.infraestructura.uow.alConfirmar(async () => {
      await esperar(10)
      await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '5' }] })
    })

    await app.esperarTareasPendientes()

    expect(app.notificador.mostradas).toEqual([
      { texto: 'Se acabó: Lejía 1 L', url: `/productos/${id}` },
    ])
  })

  it('ids secuenciales y reloj sin empates: cada operación tiene su propio registradaEn', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '9' })
    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '1' }] })
    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '1' }] })

    const operaciones = await app.inventario.consultable.operaciones()
    const instantes = operaciones.map((o) => o.registradaEn)
    expect(new Set(instantes).size).toBe(instantes.length)
    expect(instantes).toEqual([...instantes].sort())
    expect(id).toMatch(/^id-\d+$/)
  })
})

describe('RelojDePrueba', () => {
  it('avanza 1 ms en cada ahora(); fijar y avanzarSegundos cambian el próximo instante', () => {
    const { reloj } = crearAplicacionDePrueba({ ahora: '2026-10-15T15:00:00.000Z' })
    expect(reloj.ahora()).toBe('2026-10-15T15:00:00.000Z')
    expect(reloj.ahora()).toBe('2026-10-15T15:00:00.001Z')
    reloj.avanzarSegundos(10)
    expect(reloj.ahora()).toBe('2026-10-15T15:00:10.002Z')
    reloj.fijar('2026-10-16T13:00:00.000Z')
    expect(reloj.ahora()).toBe('2026-10-16T13:00:00.000Z')
  })
})

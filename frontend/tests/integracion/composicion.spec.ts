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

  it('RN-RE-04: si la copia no cuadra al reconstruir, la unidad de trabajo revierte todo y no avisa ningún cambio en bloque', async () => {
    await nuevaApp()
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '2' })
    await app.esperarTareasPendientes()
    const copia = JSON.parse(await (await app.respaldo.guardarCopia()).contenido.text()) as {
      control: { stockPorProducto: Record<string, number> }
    }
    // Pasa la validación del formato, pero el stock de control no cuadra con el libro.
    copia.control.stockPorProducto[id] = 9000
    await app.inventario.registrarIngreso({
      lineas: [{ productoId: id, cantidad: '8', costo: '2.40' }],
    })
    await app.tienda.actualizarConfiguracion({ tamanoDeLetra: 'MUY_GRANDE' })
    await app.esperarTareasPendientes()
    const antes = {
      stock: (await app.inventario.consultable.stockDe(id)).milesimas,
      historial: await app.inventario.historial(),
      configuracion: await app.tienda.obtenerConfiguracion(),
      resumen: await app.analisis.consultarResumen('HOY'),
    }
    const cambios = vi.fn()
    app.alCambiarEnBloque(cambios)

    await expect(
      app.respaldo.restaurarCopia(JSON.stringify(copia), { confirmaciones: 2 }),
    ).rejects.toThrow('La copia tiene datos que no cuadran. No se cambió nada')
    await app.esperarTareasPendientes()

    expect(cambios).not.toHaveBeenCalled()
    expect({
      stock: (await app.inventario.consultable.stockDe(id)).milesimas,
      historial: await app.inventario.historial(),
      configuracion: await app.tienda.obtenerConfiguracion(),
      resumen: await app.analisis.consultarResumen('HOY'),
    }).toStrictEqual(antes)
    expect(antes.stock).toBe(10_000)
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

  it('RN-AL-06c/08: conceder el permiso ("Sí, avísame") activa las notificaciones del sistema', async () => {
    app = crearAplicacionDePrueba({ ahora: HOY, almacen })
    expect(await app.alertas.notificacionesPermitidas()).toBe(false)

    expect(await app.alertas.solicitarPermiso()).toBe(true)

    expect(app.notificador.solicitudes).toBe(1)
    expect((await app.tienda.obtenerConfiguracion()).notificacionesActivas).toBe(true)
    expect(await app.alertas.notificacionesPermitidas()).toBe(true)
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '5' })
    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '3' }] })
    await app.esperarTareasPendientes()
    expect(app.notificador.mostradas).toEqual([
      { texto: 'Queda poco: Lejía 1 L (2 unid.)', url: `/productos/${id}` },
    ])
  })

  it('RN-AL-08: si se rechaza el permiso, las notificaciones del sistema quedan apagadas', async () => {
    await nuevaApp()
    app.notificador.permiso = false

    expect(await app.alertas.solicitarPermiso()).toBe(false)

    expect((await app.tienda.obtenerConfiguracion()).notificacionesActivas).toBe(false)
    expect(await app.alertas.notificacionesPermitidas()).toBe(false)
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

// M2 (revisión de perf/rafagas): al cerrar la base por versionchange, ninguna re-evaluación
// pendiente debe correr contra la base cerrada.
describe.each(ALMACENES)('Aplicacion.detener (%s)', (almacen) => {
  const VENTANA = 300

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('M2: deja de escuchar los eventos y descarta la re-evaluación programada', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const app = crearAplicacionDePrueba({ ahora: HOY, almacen, ventanaDeReevaluacionMs: VENTANA })
    await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '5' })
    await app.esperarTareasPendientes()
    const situaciones = vi.spyOn(app.analisis.consultable, 'situaciones')

    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '3' }] })
    app.detener()
    await vi.advanceTimersByTimeAsync(10 * VENTANA)
    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '1' }] })
    await vi.advanceTimersByTimeAsync(10 * VENTANA)
    await app.esperarTareasPendientes()

    expect(situaciones).not.toHaveBeenCalled()
    expect(app.notificador.mostradas).toEqual([])
    await app.cerrar()
  })

  it('cerrar() de la aplicación de prueba también la detiene: nada corre después de cerrar', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const app = crearAplicacionDePrueba({ ahora: HOY, almacen, ventanaDeReevaluacionMs: VENTANA })
    await app.cerrar()
    const situaciones = vi.spyOn(app.analisis.consultable, 'situaciones')

    await app.bus.publicar({ tipo: 'ConfiguracionActualizada' })
    await vi.advanceTimersByTimeAsync(10 * VENTANA)

    expect(situaciones).not.toHaveBeenCalled()
  })
})

describe.each(ALMACENES)('AplicacionDePrueba.sinEventos (%s)', (almacen) => {
  it('lo registrado en silencio queda guardado, pero no evalúa avisos ni notifica', async () => {
    const app = crearAplicacionDePrueba({ ahora: HOY, almacen })
    await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })

    const id = await app.sinEventos(async () => {
      const nuevo = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '5' })
      await app.inventario.registrarVenta({ lineas: [{ productoId: nuevo, cantidad: '3' }] })
      return nuevo
    })

    expect((await app.inventario.consultable.stockDe(id)).milesimas).toBe(2000)
    expect(app.notificador.mostradas).toEqual([])
    expect(await app.infraestructura.repositorios.avisos.todos()).toEqual([])
    // Después del silencio, los eventos vuelven a llegar.
    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '2' }] })
    await app.esperarTareasPendientes()
    expect(app.notificador.mostradas.map((n) => n.texto)).toEqual(['Se acabó: Lejía 1 L'])
    await app.cerrar()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import type { EventoDeDominio } from '@/shared/domain/eventos'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearContextoDePrueba, crearSituacion } from '../__pruebas__/dobles'
import { RUTA_SE_ACABAN } from '../domain/avisos'
import { crearModuloAlertas, type ResumenDeAtencion } from './modulo'

const VENTANA = 300

const VENTA: EventoDeDominio = {
  tipo: 'OperacionRegistrada',
  operacionId: 'o1',
  tipoOperacion: 'VENTA',
  productoIds: ['p1'],
}

const AGOTADA = crearSituacion({ productoId: 'p1', nombre: 'Lejía 1 L', estado: 'AGOTADO' })

function preparar() {
  const almacen = new AlmacenEnMemoria()
  const contexto = crearContextoDePrueba(new UnidadDeTrabajoEnMemoria(almacen), almacen)
  const situaciones = vi.spyOn(contexto.analisisFalso, 'situaciones')
  const modulo = crearModuloAlertas({ ...contexto.dependencias, ventanaDeReevaluacionMs: VENTANA })
  modulo.escucharEventos()
  return { ...contexto, situaciones, modulo }
}

// Solo setTimeout y Date: el resto (microtareas, setImmediate) sigue real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('RN-SIS-09: las re-evaluaciones que piden los eventos en ráfaga se juntan', () => {
  it('RN-SIS-09: diez eventos seguidos producen UNA evaluación (una lectura de situaciones), no diez', async () => {
    const { situaciones, modulo, bus, analisisFalso, notificador } = preparar()
    analisisFalso.situacionesActuales = [AGOTADA]

    for (let i = 0; i < 10; i += 1) await bus.publicar(VENTA)
    await vi.advanceTimersByTimeAsync(VENTANA - 1)
    expect(situaciones).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await modulo.esperarEvaluacionesPendientes()
    expect(situaciones).toHaveBeenCalledTimes(1)
    expect(notificador.mostradas).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
  })

  it('RN-SIS-09: cada evento vuelve a empezar la ventana, pero no más allá de cuatro ventanas desde el primero', async () => {
    const { situaciones, bus } = preparar()

    await bus.publicar(VENTA)
    await vi.advanceTimersByTimeAsync(VENTANA - 50)
    await bus.publicar(VENTA)
    await vi.advanceTimersByTimeAsync(VENTANA - 50)
    expect(situaciones).not.toHaveBeenCalled()

    // Eventos cada 200 ms sin parar: la espera nunca pasa de 4 ventanas desde el primero.
    for (let t = 2 * (VENTANA - 50); t < 4 * VENTANA; t += 200) {
      await bus.publicar(VENTA)
      await vi.advanceTimersByTimeAsync(200)
    }
    expect(situaciones).toHaveBeenCalledTimes(1)
  })

  it('RN-SIS-09: esperarEvaluacionesPendientes adelanta la evaluación programada (no espera la ventana)', async () => {
    const { situaciones, modulo, bus, analisisFalso, notificador } = preparar()
    analisisFalso.situacionesActuales = [AGOTADA]

    await bus.publicar(VENTA)
    await modulo.esperarEvaluacionesPendientes()

    expect(situaciones).toHaveBeenCalledTimes(1)
    expect(notificador.mostradas).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(10 * VENTANA)
    expect(situaciones).toHaveBeenCalledTimes(1)
  })

  it('RN-AL-02: evaluarAvisos (abrir la app, cambios en bloque) corre enseguida y cubre la programada', async () => {
    const { situaciones, modulo, bus, analisisFalso } = preparar()
    analisisFalso.situacionesActuales = [AGOTADA]

    await bus.publicar(VENTA)
    expect(await modulo.evaluarAvisos()).toEqual([
      { texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' },
    ])
    await vi.advanceTimersByTimeAsync(10 * VENTANA)
    expect(situaciones).toHaveBeenCalledTimes(1)
  })

  it('RN-AL-02 (M5): un evento que llega mientras corre una evaluación se evalúa después, también si la que corría falla', async () => {
    const { situaciones, modulo, bus, analisisFalso, notificador } = preparar()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fallar: (error: Error) => void = () => undefined
    situaciones.mockImplementationOnce(
      () => new Promise((_resolver, rechazar) => (fallar = rechazar)),
    )

    await bus.publicar(VENTA)
    await vi.advanceTimersByTimeAsync(VENTANA)
    expect(situaciones).toHaveBeenCalledTimes(1)
    // Llega otra venta mientras la primera evaluación sigue en curso; después, esa falla.
    analisisFalso.situacionesActuales = [AGOTADA]
    await bus.publicar(VENTA)
    fallar(new Error('falla la primera'))
    await vi.advanceTimersByTimeAsync(VENTANA)
    await modulo.esperarEvaluacionesPendientes()

    expect(situaciones).toHaveBeenCalledTimes(2)
    expect(notificador.mostradas).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
  })

  it('RN-AL-07: los avisos que nacen en la misma ráfaga salen en una sola notificación', async () => {
    const { modulo, bus, analisisFalso, notificador } = preparar()

    analisisFalso.situacionesActuales = [AGOTADA]
    await bus.publicar(VENTA)
    analisisFalso.situacionesActuales = [
      AGOTADA,
      crearSituacion({ productoId: 'p2', nombre: 'Jabón', estado: 'AGOTADO' }),
    ]
    await bus.publicar({ ...VENTA, productoIds: ['p2'] })
    await modulo.esperarEvaluacionesPendientes()

    expect(notificador.mostradas).toEqual([
      { texto: '2 productos se están acabando', url: RUTA_SE_ACABAN },
    ])
  })

  it('cancelar la escucha descarta la evaluación programada', async () => {
    const almacen = new AlmacenEnMemoria()
    const contexto = crearContextoDePrueba(new UnidadDeTrabajoEnMemoria(almacen), almacen)
    const situaciones = vi.spyOn(contexto.analisisFalso, 'situaciones')
    const modulo = crearModuloAlertas({
      ...contexto.dependencias,
      ventanaDeReevaluacionMs: VENTANA,
    })
    const cancelar = modulo.escucharEventos()

    await contexto.bus.publicar(VENTA)
    cancelar()
    await vi.advanceTimersByTimeAsync(10 * VENTANA)
    await modulo.esperarEvaluacionesPendientes()

    expect(situaciones).not.toHaveBeenCalled()
  })
})

describe('RN-AL-06: cada evaluación comparte su resumen de atención (un solo cálculo de situaciones)', () => {
  it('RN-AL-06: quien escucha recibe el resumen de la misma lectura con que se evaluaron los avisos', async () => {
    const { situaciones, modulo, bus, analisisFalso } = preparar()
    const resumenes: ResumenDeAtencion[] = []
    modulo.alCalcularLaAtencion((resumen) => resumenes.push(resumen))
    analisisFalso.situacionesActuales = [
      AGOTADA,
      crearSituacion({
        productoId: 'p2',
        nombre: 'Jabón',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(1),
      }),
    ]

    for (let i = 0; i < 10; i += 1) await bus.publicar(VENTA)
    await modulo.esperarEvaluacionesPendientes()

    expect(situaciones).toHaveBeenCalledTimes(1)
    expect(resumenes).toEqual([
      { agotados: 1, porAcabarse: 1, contador: 2, texto: '1 agotado y 1 por acabarse' },
    ])
  })

  it('RN-AL-06: también tras evaluarAvisos explícito; cancelar deja de recibir', async () => {
    const { modulo, analisisFalso } = preparar()
    const contadores: number[] = []
    const cancelar = modulo.alCalcularLaAtencion((resumen) => contadores.push(resumen.contador))

    await modulo.evaluarAvisos()
    analisisFalso.situacionesActuales = [AGOTADA]
    await modulo.evaluarAvisos()
    cancelar()
    await modulo.evaluarAvisos()

    expect(contadores).toEqual([0, 1])
  })

  it('un manejador que lanza se registra y no impide a los demás ni a los avisos', async () => {
    const { modulo, analisisFalso, notificador } = preparar()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const contadores: number[] = []
    modulo.alCalcularLaAtencion(() => {
      throw new Error('falla el manejador')
    })
    modulo.alCalcularLaAtencion((resumen) => contadores.push(resumen.contador))
    analisisFalso.situacionesActuales = [AGOTADA]

    await modulo.evaluarAvisos()

    expect(contadores).toEqual([1])
    expect(notificador.mostradas).toHaveLength(1)
    expect(error).toHaveBeenCalledWith(
      'Falló un manejador del resumen de atención:',
      expect.any(Error),
    )
  })

  it('si la evaluación falla, nadie recibe un resumen', async () => {
    const { situaciones, modulo } = preparar()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const resumenes: ResumenDeAtencion[] = []
    modulo.alCalcularLaAtencion((resumen) => resumenes.push(resumen))
    situaciones.mockRejectedValueOnce(new Error('sin base'))

    await expect(modulo.evaluarAvisos()).rejects.toThrow('sin base')
    expect(resumenes).toEqual([])
  })
})

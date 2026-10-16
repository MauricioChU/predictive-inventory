import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearContextoDePrueba, crearSituacion } from '../__pruebas__/dobles'
import { evaluarAvisos } from './evaluar-avisos'

function prepararContexto(ahora?: string) {
  const almacen = new AlmacenEnMemoria()
  return crearContextoDePrueba(new UnidadDeTrabajoEnMemoria(almacen), almacen, ahora)
}

describe('evaluarAvisos', () => {
  it('RN-AL-03: NORMAL a POR_ACABARSE genera una notificación con el texto exacto', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(3),
      }),
    ]

    const notificaciones = await evaluarAvisos(dependencias)

    expect(notificaciones).toEqual([
      { texto: 'Queda poco: Lejía 1 L (3 unid.)', url: '/productos/p1' },
    ])
    expect(notificador.mostradas).toEqual(notificaciones)
  })

  it('RN-AL-03: no se repite el aviso si el estado no mejora (5, vendo 2, vendo 1)', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(3),
      }),
    ]
    await evaluarAvisos(dependencias)

    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(2),
      }),
    ]
    const segunda = await evaluarAvisos(dependencias)

    expect(segunda).toEqual([])
    expect(notificador.mostradas).toHaveLength(1)
  })

  it('RN-AL-03: pasar de POR_ACABARSE a AGOTADO avisa de nuevo', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(2),
      }),
    ]
    await evaluarAvisos(dependencias)

    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    const notificaciones = await evaluarAvisos(dependencias)

    expect(notificaciones).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
    expect(notificador.mostradas).toHaveLength(2)
  })

  it('RN-AL-04: AGOTADO vuelve a NORMAL y luego a POR_ACABARSE: avisa otra vez', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    await evaluarAvisos(dependencias)

    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'NORMAL',
        stock: Cantidad.deEntero(10),
      }),
    ]
    const sinCambio = await evaluarAvisos(dependencias)
    expect(sinCambio).toEqual([])

    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(3),
      }),
    ]
    const rearmado = await evaluarAvisos(dependencias)

    expect(rearmado).toEqual([{ texto: 'Queda poco: Lejía 1 L (3 unid.)', url: '/productos/p1' }])
    expect(notificador.mostradas).toHaveLength(2)
  })

  it('RN-AL-01: un producto archivado (ya no aparece en situaciones) pierde su registro y no genera aviso', async () => {
    const { dependencias, analisisFalso, avisosAlmacen } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Escoba',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    await evaluarAvisos(dependencias)
    expect(avisosAlmacen.todos('avisos')).toHaveLength(1)

    analisisFalso.situacionesActuales = []
    const notificaciones = await evaluarAvisos(dependencias)

    expect(notificaciones).toEqual([])
    expect(avisosAlmacen.todos('avisos')).toEqual([])
  })

  it('RN-AL-06: sin permiso del navegador, no se muestra nada pero el registro se actualiza igual', async () => {
    const { dependencias, analisisFalso, notificador, avisosAlmacen } = prepararContexto()
    notificador.permiso = false
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(3),
      }),
    ]

    const notificaciones = await evaluarAvisos(dependencias)

    expect(notificaciones).toEqual([])
    expect(notificador.mostradas).toEqual([])
    expect(avisosAlmacen.todos('avisos')).toEqual([
      { productoId: 'p1', ultimoEstadoAvisado: 'POR_ACABARSE' },
    ])
  })

  it('RN-AL-06: sin notificaciones activas en la configuración, tampoco se muestra nada', async () => {
    const { dependencias, analisisFalso, notificador, tiendaFalsa, avisosAlmacen } =
      prepararContexto()
    tiendaFalsa.configuracionActual = {
      ...tiendaFalsa.configuracionActual,
      notificacionesActivas: false,
    }
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]

    const notificaciones = await evaluarAvisos(dependencias)

    expect(notificaciones).toEqual([])
    expect(notificador.mostradas).toEqual([])
    expect(avisosAlmacen.todos('avisos')).toEqual([
      { productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' },
    ])
  })

  it('RN-AL-07: tres productos empeoran a la vez: una sola notificación agrupada', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(1),
      }),
      crearSituacion({
        productoId: 'p2',
        nombre: 'Carbón',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
      crearSituacion({
        productoId: 'p3',
        nombre: 'Jabón',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(2),
      }),
    ]

    const notificaciones = await evaluarAvisos(dependencias)

    expect(notificaciones).toEqual([
      { texto: '3 productos se están acabando', url: '/control/para-comprar' },
    ])
    expect(notificador.mostradas).toHaveLength(1)
  })

  it('RN-AL-08: evaluarAvisos nunca pide permiso de notificaciones', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    notificador.permiso = false
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]

    await evaluarAvisos(dependencias)

    expect(notificador.solicitudes).toBe(0)
  })
})

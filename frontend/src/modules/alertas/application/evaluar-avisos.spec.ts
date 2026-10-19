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

  // Ola 3, ruling 1: la notificación sale tras el commit de la unidad de trabajo MÁS EXTERNA.
  it('RN-AL-06: dentro de una unidad de trabajo externa que falla después, no se notifica ni queda el registro', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const { dependencias, analisisFalso, notificador } = crearContextoDePrueba(uow, almacen)
    analisisFalso.situacionesActuales = [
      crearSituacion({ productoId: 'p1', nombre: 'Lejía 1 L', estado: 'AGOTADO' }),
    ]

    await expect(
      uow.ejecutar(async () => {
        await evaluarAvisos(dependencias)
        throw new Error('falla externa')
      }),
    ).rejects.toThrow('falla externa')

    expect(notificador.mostradas).toEqual([])
    expect(almacen.todos('avisos')).toEqual([])
    // Como el registro no quedó guardado, la próxima evaluación avisa.
    expect(await evaluarAvisos(dependencias)).toEqual([
      { texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' },
    ])
  })

  it('ADR-0002: dentro de una unidad de trabajo externa que confirma, la notificación sale después del commit', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const { dependencias, analisisFalso, notificador } = crearContextoDePrueba(uow, almacen)
    analisisFalso.situacionesActuales = [
      crearSituacion({ productoId: 'p1', nombre: 'Lejía 1 L', estado: 'AGOTADO' }),
    ]

    await uow.ejecutar(async () => {
      await evaluarAvisos(dependencias)
      expect(notificador.mostradas).toEqual([])
    })

    expect(notificador.mostradas).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
  })

  describe('pago del local (RN-AL-11)', () => {
    const DIA_18 = '2026-10-18T15:00:00.000Z'

    function conAlquiler(dias: [number]) {
      const contexto = prepararContexto(DIA_18)
      contexto.tiendaFalsa.configuracionActual = {
        ...contexto.tiendaFalsa.configuracionActual,
        alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 120000, dias },
      }
      return contexto
    }

    it('RN-AL-11: dentro de la ventana avisa del pago con su propia ruta (Control)', async () => {
      const { dependencias, notificador, tiendaFalsa } = conAlquiler([20])

      const notificaciones = await evaluarAvisos(dependencias)

      expect(notificaciones).toEqual([
        { texto: 'Pasado mañana pagas el local: S/ 1 200.00', url: '/control' },
      ])
      expect(notificador.mostradas).toEqual(notificaciones)
      expect(tiendaFalsa.estadoActual.ultimoPagoDelLocalAvisado).toBe('2026-10-20')
    })

    it('RN-AL-11: una sola notificación por fecha de pago', async () => {
      const { dependencias, notificador, reloj } = conAlquiler([20])
      await evaluarAvisos(dependencias)

      await evaluarAvisos(dependencias)
      reloj.fijar('2026-10-19T15:00:00.000Z')
      const alDiaSiguiente = await evaluarAvisos(dependencias)

      expect(alDiaSiguiente).toEqual([])
      expect(notificador.mostradas).toHaveLength(1)
    })

    it('RN-AL-11: si cambia la fecha de pago dentro de la ventana, la fecha nueva sí se avisa', async () => {
      const { dependencias, notificador, tiendaFalsa } = conAlquiler([20])
      await evaluarAvisos(dependencias)

      tiendaFalsa.configuracionActual = {
        ...tiendaFalsa.configuracionActual,
        alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 120000, dias: [19] },
      }
      await evaluarAvisos(dependencias)

      expect(notificador.mostradas.map((n) => n.texto)).toEqual([
        'Pasado mañana pagas el local: S/ 1 200.00',
        'Mañana pagas el local: S/ 1 200.00',
      ])
    })

    it('RN-AL-11: sin permiso no notifica ni lo marca como avisado; con permiso después, avisa', async () => {
      const { dependencias, notificador, tiendaFalsa } = conAlquiler([20])
      notificador.permiso = false

      const sinPermiso = await evaluarAvisos(dependencias)

      expect(sinPermiso).toEqual([])
      expect(notificador.mostradas).toEqual([])
      expect(tiendaFalsa.estadoActual.ultimoPagoDelLocalAvisado).toBeNull()

      notificador.permiso = true
      const conPermiso = await evaluarAvisos(dependencias)

      expect(conPermiso.map((n) => n.texto)).toEqual(['Pasado mañana pagas el local: S/ 1 200.00'])
    })

    it('RN-AL-11: fuera de la ventana o sin alquiler no notifica', async () => {
      const { dependencias, notificador, tiendaFalsa } = conAlquiler([25])
      expect(await evaluarAvisos(dependencias)).toEqual([])

      tiendaFalsa.configuracionActual = {
        ...tiendaFalsa.configuracionActual,
        alquilerDelLocal: { tipo: 'NO_PAGA' },
      }
      expect(await evaluarAvisos(dependencias)).toEqual([])
      expect(notificador.mostradas).toEqual([])
    })

    it('RN-AL-11: va en su propia notificación, nunca agrupada con las de stock', async () => {
      const { dependencias, analisisFalso, notificador } = conAlquiler([20])
      analisisFalso.situacionesActuales = [
        crearSituacion({
          productoId: 'p1',
          nombre: 'Lejía 1 L',
          estado: 'AGOTADO',
          stock: Cantidad.cero(),
        }),
        crearSituacion({
          productoId: 'p2',
          nombre: 'Carbón',
          estado: 'AGOTADO',
          stock: Cantidad.cero(),
        }),
      ]

      await evaluarAvisos(dependencias)

      expect(notificador.mostradas).toEqual([
        { texto: '2 productos se están acabando', url: '/control/para-comprar' },
        { texto: 'Pasado mañana pagas el local: S/ 1 200.00', url: '/control' },
      ])
    })

    it('RN-AL-11: si la unidad de trabajo externa falla, no se notifica ni se marca', async () => {
      const almacen = new AlmacenEnMemoria()
      const uow = new UnidadDeTrabajoEnMemoria(almacen)
      const { dependencias, notificador, tiendaFalsa } = crearContextoDePrueba(uow, almacen, DIA_18)
      tiendaFalsa.configuracionActual = {
        ...tiendaFalsa.configuracionActual,
        alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 120000, dias: [20] },
      }

      await expect(
        uow.ejecutar(async () => {
          await evaluarAvisos(dependencias)
          throw new Error('falla después')
        }),
      ).rejects.toThrow('falla después')

      expect(notificador.mostradas).toEqual([])
      expect(tiendaFalsa.estadoActual.ultimoPagoDelLocalAvisado).toBeNull()
    })
  })
})

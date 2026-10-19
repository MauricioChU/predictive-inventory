import { describe, expect, it, vi } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearContextoDePrueba, crearSituacion } from '../__pruebas__/dobles'
import { crearModuloAlertas } from './modulo'

function prepararContexto(ahora?: string) {
  const almacen = new AlmacenEnMemoria()
  return crearContextoDePrueba(new UnidadDeTrabajoEnMemoria(almacen), almacen, ahora)
}

describe('crearModuloAlertas', () => {
  it('RN-AL-06: evaluarAvisos delega en el caso de uso y notifica según corresponda', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    const modulo = crearModuloAlertas(dependencias)

    const notificaciones = await modulo.evaluarAvisos()

    expect(notificaciones).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
    expect(notificador.mostradas).toEqual(notificaciones)
  })

  it('RN-AL-06: resumenDeAtencion delega correctamente', async () => {
    const { dependencias, analisisFalso } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    const modulo = crearModuloAlertas(dependencias)

    const atencion = await modulo.resumenDeAtencion()
    expect(atencion.contador).toBe(1)
  })

  it('RN-AL-08: solicitarPermiso delega en el notificador y cuenta como una solicitud', async () => {
    const { dependencias, notificador } = prepararContexto()
    notificador.permiso = true
    const modulo = crearModuloAlertas(dependencias)

    const concedido = await modulo.solicitarPermiso()

    expect(concedido).toBe(true)
    expect(notificador.solicitudes).toBe(1)
  })

  it('RN-AL-06: notificacionesPermitidas: permiso del navegador Y configuración activa', async () => {
    const { dependencias, notificador, tiendaFalsa } = prepararContexto()
    const modulo = crearModuloAlertas(dependencias)

    notificador.permiso = true
    tiendaFalsa.configuracionActual = {
      ...tiendaFalsa.configuracionActual,
      notificacionesActivas: true,
    }
    expect(await modulo.notificacionesPermitidas()).toBe(true)

    notificador.permiso = false
    expect(await modulo.notificacionesPermitidas()).toBe(false)

    notificador.permiso = true
    tiendaFalsa.configuracionActual = {
      ...tiendaFalsa.configuracionActual,
      notificacionesActivas: false,
    }
    expect(await modulo.notificacionesPermitidas()).toBe(false)
  })

  it('RN-AL-02: escucharEventos suscribe evaluarAvisos a OperacionRegistrada', async () => {
    const { dependencias, bus, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    const modulo = crearModuloAlertas(dependencias)
    modulo.escucharEventos()

    await bus.publicar({
      tipo: 'OperacionRegistrada',
      operacionId: 'o1',
      tipoOperacion: 'VENTA',
      productoIds: ['p1'],
    })
    await modulo.esperarEvaluacionesPendientes()

    expect(notificador.mostradas).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
  })

  it('RN-AL-02: evaluaciones superpuestas se serializan y el registro final no queda con datos viejos', async () => {
    const { dependencias, analisisFalso, notificador, avisosAlmacen } = prepararContexto()
    const modulo = crearModuloAlertas(dependencias)
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(3),
      }),
    ]
    let liberar: () => void = () => {}
    analisisFalso.retrasarProximaLlamada(new Promise<void>((r) => (liberar = r)))

    const primera = modulo.evaluarAvisos()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    const segunda = modulo.evaluarAvisos()
    liberar()
    const [a, b] = await Promise.all([primera, segunda])

    expect(a).toEqual([{ texto: 'Queda poco: Lejía 1 L (3 unid.)', url: '/productos/p1' }])
    expect(b).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
    expect(notificador.mostradas).toEqual([...a, ...b])
    expect(avisosAlmacen.todos('avisos')).toEqual([
      { productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' },
    ])
  })

  it('RN-AL-02: publicar un evento no espera a la evaluación; esperarEvaluacionesPendientes sí', async () => {
    const { dependencias, bus, analisisFalso, notificador } = prepararContexto()
    const modulo = crearModuloAlertas(dependencias)
    modulo.escucharEventos()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    let liberar: () => void = () => {}
    analisisFalso.retrasarProximaLlamada(new Promise<void>((r) => (liberar = r)))

    await bus.publicar({
      tipo: 'OperacionRegistrada',
      operacionId: 'o1',
      tipoOperacion: 'VENTA',
      productoIds: ['p1'],
    })
    expect(notificador.mostradas).toEqual([])

    liberar()
    await modulo.esperarEvaluacionesPendientes()
    expect(notificador.mostradas).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
  })

  // Ola 3, ruling 4: los pasos Gherkin encadenan eventos; la espera sigue hasta que la cola
  // deja de cambiar.
  it('RN-AL-02: esperarEvaluacionesPendientes también espera las evaluaciones que se encolan mientras espera', async () => {
    const { dependencias, bus, analisisFalso, notificador } = prepararContexto()
    const modulo = crearModuloAlertas(dependencias)
    modulo.escucharEventos()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(3),
      }),
    ]
    let liberar: () => void = () => {}
    analisisFalso.retrasarProximaLlamada(new Promise<void>((r) => (liberar = r)))
    // Un evento encadenado: cuando sale la primera notificación, otro módulo publica un evento
    // (y el producto ya se agotó), lo que encola una segunda evaluación.
    const mostrar = notificador.mostrar.bind(notificador)
    let encadenado = false
    notificador.mostrar = async (notificacion) => {
      await mostrar(notificacion)
      if (encadenado) return
      encadenado = true
      analisisFalso.situacionesActuales = [
        crearSituacion({ productoId: 'p1', nombre: 'Lejía 1 L', estado: 'AGOTADO' }),
      ]
      void bus.publicar({ tipo: 'ConfiguracionActualizada' })
    }

    await bus.publicar({
      tipo: 'OperacionRegistrada',
      operacionId: 'o1',
      tipoOperacion: 'VENTA',
      productoIds: ['p1'],
    })
    const espera = modulo.esperarEvaluacionesPendientes()
    liberar()
    await espera

    expect(notificador.mostradas).toEqual([
      { texto: 'Queda poco: Lejía 1 L (3 unid.)', url: '/productos/p1' },
      { texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' },
    ])
  })

  it('RN-AL-02: una evaluación que falla se registra y no rompe la cola', async () => {
    const { dependencias, analisisFalso, notificador } = prepararContexto()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const modulo = crearModuloAlertas(dependencias)
    vi.spyOn(analisisFalso, 'situaciones').mockRejectedValueOnce(new Error('falla'))

    await expect(modulo.evaluarAvisos()).rejects.toThrow('falla')
    await modulo.esperarEvaluacionesPendientes()
    expect(error).toHaveBeenCalled()

    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    await modulo.evaluarAvisos()
    expect(notificador.mostradas).toHaveLength(1)
    error.mockRestore()
  })

  it('RN-AL-02: escucharEventos también reacciona a los demás eventos relevantes', async () => {
    const { dependencias, bus, analisisFalso, notificador, avisosAlmacen } = prepararContexto()
    const modulo = crearModuloAlertas(dependencias)
    modulo.escucharEventos()

    const eventos: Array<Parameters<typeof bus.publicar>[0]> = [
      { tipo: 'OperacionAnulada', operacionId: 'o1', anulacionId: 'o2', productoIds: ['p1'] },
      { tipo: 'ProductoCreado', productoId: 'p1' },
      { tipo: 'ProductoActualizado', productoId: 'p1' },
      { tipo: 'ProductoArchivado', productoId: 'p1' },
      { tipo: 'ProductoReactivado', productoId: 'p1' },
      { tipo: 'ConfiguracionActualizada' },
    ]
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    for (const evento of eventos) {
      // Cada evento se prueba como si fuera la primera vez que empeora: si no se reinicia el
      // registro, RN-AL-03 (no repetir mientras no mejore) correctamente no volvería a avisar.
      avisosAlmacen.vaciar('avisos')
      notificador.mostradas = []
      await bus.publicar(evento)
      await modulo.esperarEvaluacionesPendientes()
      expect(notificador.mostradas).toHaveLength(1)
    }
  })

  it('RN-AL-02: escucharEventos() devuelve una función que cancela la suscripción', async () => {
    const { dependencias, bus, analisisFalso, notificador } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
    ]
    const modulo = crearModuloAlertas(dependencias)
    const cancelar = modulo.escucharEventos()
    cancelar()

    await bus.publicar({
      tipo: 'OperacionRegistrada',
      operacionId: 'o1',
      tipoOperacion: 'VENTA',
      productoIds: ['p1'],
    })

    expect(notificador.mostradas).toEqual([])
  })

  describe('pago del local (RN-AL-10 y RN-AL-11)', () => {
    function conAlquiler() {
      const contexto = prepararContexto('2026-10-18T15:00:00.000Z')
      contexto.tiendaFalsa.configuracionActual = {
        ...contexto.tiendaFalsa.configuracionActual,
        alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 120000, dias: [20] },
      }
      return contexto
    }

    it('RN-AL-10: recordatorioDelLocal delega correctamente', async () => {
      const { dependencias } = conAlquiler()
      const modulo = crearModuloAlertas(dependencias)

      expect((await modulo.recordatorioDelLocal())?.texto).toBe(
        'Pasado mañana pagas el local: S/ 1 200.00',
      )
    })

    it('RN-AL-11: evaluarAvisos avisa del pago, pero la re-evaluación de los eventos no', async () => {
      const { dependencias, bus, notificador } = conAlquiler()
      const modulo = crearModuloAlertas({ ...dependencias, ventanaDeReevaluacionMs: 0 })
      modulo.escucharEventos()

      await bus.publicar({ tipo: 'ConfiguracionActualizada' })
      await modulo.esperarEvaluacionesPendientes()
      expect(notificador.mostradas).toEqual([])

      await modulo.evaluarAvisos()
      expect(notificador.mostradas.map((n) => n.texto)).toEqual([
        'Pasado mañana pagas el local: S/ 1 200.00',
      ])
    })
  })
})

import { describe, expect, it } from 'vitest'
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
  it('evaluarAvisos delega en el caso de uso y notifica según corresponda', async () => {
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

  it('resumenDeAtencion y resumenDelDia/cerrarResumenDelDia delegan correctamente', async () => {
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

    const resumen = await modulo.resumenDelDia()
    expect(resumen).not.toBeNull()

    await modulo.cerrarResumenDelDia()
    expect(await modulo.resumenDelDia()).toBeNull()
  })

  it('RN-AL-08: solicitarPermiso delega en el notificador y cuenta como una solicitud', async () => {
    const { dependencias, notificador } = prepararContexto()
    notificador.permiso = true
    const modulo = crearModuloAlertas(dependencias)

    const concedido = await modulo.solicitarPermiso()

    expect(concedido).toBe(true)
    expect(notificador.solicitudes).toBe(1)
  })

  it('notificacionesPermitidas: permiso del navegador Y configuración activa', async () => {
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

    expect(notificador.mostradas).toEqual([{ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }])
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
      expect(notificador.mostradas).toHaveLength(1)
    }
  })

  it('escucharEventos() devuelve una función que cancela la suscripción', async () => {
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
})

import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearContextoDePrueba } from '../__pruebas__/dobles'
import { notificacionesPermitidas } from './permiso'

function prepararContexto() {
  const almacen = new AlmacenEnMemoria()
  return crearContextoDePrueba(new UnidadDeTrabajoEnMemoria(almacen), almacen)
}

describe('notificacionesPermitidas (RN-AL-06)', () => {
  it('RN-AL-06: true solo si la configuración está activa Y el navegador dio permiso', async () => {
    const { dependencias, notificador, tiendaFalsa } = prepararContexto()
    notificador.permiso = true
    tiendaFalsa.configuracionActual = {
      ...tiendaFalsa.configuracionActual,
      notificacionesActivas: true,
    }

    expect(await notificacionesPermitidas(dependencias)).toBe(true)
  })

  it('RN-AL-06: false si la configuración está activa pero el navegador no dio permiso', async () => {
    const { dependencias, notificador, tiendaFalsa } = prepararContexto()
    notificador.permiso = false
    tiendaFalsa.configuracionActual = {
      ...tiendaFalsa.configuracionActual,
      notificacionesActivas: true,
    }

    expect(await notificacionesPermitidas(dependencias)).toBe(false)
  })

  it('RN-AL-06: false si el navegador dio permiso pero la configuración está apagada', async () => {
    const { dependencias, notificador, tiendaFalsa } = prepararContexto()
    notificador.permiso = true
    tiendaFalsa.configuracionActual = {
      ...tiendaFalsa.configuracionActual,
      notificacionesActivas: false,
    }

    expect(await notificacionesPermitidas(dependencias)).toBe(false)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '../../../shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '../../../shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { BusEnMemoria } from '../../../shared/domain/eventos'
import { IdsSecuenciales } from '../../../shared/domain/ids'
import { CONFIGURACION_INICIAL } from '../../../shared/contratos/configuracion'
import { RepositorioDeConfiguracionEnMemoria } from '../infrastructure/memoria/repositorio'
import { crearModuloTienda, type ModuloTienda } from './modulo'
import type { DependenciasDeTienda } from './puertos'

function crearModulo(): { modulo: ModuloTienda; deps: DependenciasDeTienda } {
  const almacen = new AlmacenEnMemoria()
  const deps: DependenciasDeTienda = {
    repositorio: new RepositorioDeConfiguracionEnMemoria(almacen),
    uow: new UnidadDeTrabajoEnMemoria(almacen),
    ids: new IdsSecuenciales('dispositivo'),
    bus: new BusEnMemoria(),
  }
  return { modulo: crearModuloTienda(deps), deps }
}

describe('ModuloTienda', () => {
  let modulo: ModuloTienda

  beforeEach(() => {
    ;({ modulo } = crearModulo())
  })

  it('obtenerConfiguracion devuelve CONFIGURACION_INICIAL si no hay registro', async () => {
    expect(await modulo.obtenerConfiguracion()).toEqual(CONFIGURACION_INICIAL)
  })

  it('RN-TI-05: estadoDelSistema crea el registro la primera vez, con dispositivoId una sola vez', async () => {
    const primero = await modulo.consultable.estadoDelSistema()
    expect(primero).toEqual({
      dispositivoId: 'dispositivo-1',
      primeraVezCompletada: false,
      ultimoRespaldoEn: null,
      almacenamientoPersistente: 'DESCONOCIDO',
      ultimoResumenDelDiaMostrado: null,
    })

    const segundo = await modulo.consultable.estadoDelSistema()
    expect(segundo.dispositivoId).toBe('dispositivo-1')
  })

  it('actualizarConfiguracion guarda los cambios y publica ConfiguracionActualizada', async () => {
    let publicado = false
    const { modulo: moduloConBus, deps } = crearModulo()
    deps.bus.suscribir('ConfiguracionActualizada', () => {
      publicado = true
    })

    await moduloConBus.actualizarConfiguracion({ nombreTienda: 'Bodega Rosita' })

    expect(publicado).toBe(true)
    const configuracion = await moduloConBus.obtenerConfiguracion()
    expect(configuracion.nombreTienda).toBe('Bodega Rosita')
    expect(configuracion.diasEntreCompras).toBe(CONFIGURACION_INICIAL.diasEntreCompras)
  })

  it('RN-TI-01: actualizarConfiguracion rechaza un nombre vacío y no publica el evento', async () => {
    let publicado = false
    const { modulo: moduloConBus, deps } = crearModulo()
    deps.bus.suscribir('ConfiguracionActualizada', () => {
      publicado = true
    })

    await expect(moduloConBus.actualizarConfiguracion({ nombreTienda: '  ' })).rejects.toThrow(
      'Escribe el nombre de tu tienda',
    )
    expect(publicado).toBe(false)
  })

  it('RN-TI-02: actualizarConfiguracion rechaza días fuera de rango', async () => {
    await expect(modulo.actualizarConfiguracion({ diasAnticipacion: 20 })).rejects.toThrow(
      'Elige un número entre 1 y 14',
    )
  })

  it('completarPrimeraVez guarda nombre y letra y marca primeraVezCompletada', async () => {
    await modulo.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'MUY_GRANDE' })

    const configuracion = await modulo.obtenerConfiguracion()
    expect(configuracion.nombreTienda).toBe('Bodega Rosita')
    expect(configuracion.tamanoDeLetra).toBe('MUY_GRANDE')

    const estado = await modulo.consultable.estadoDelSistema()
    expect(estado.primeraVezCompletada).toBe(true)
  })

  it('completarPrimeraVez rechaza un nombre inválido', async () => {
    await expect(
      modulo.completarPrimeraVez({ nombreTienda: '', tamanoDeLetra: 'NORMAL' }),
    ).rejects.toThrow('Escribe el nombre de tu tienda')
  })

  it('consultable.actualizarEstadoDelSistema guarda cambios parciales conservando el resto', async () => {
    await modulo.consultable.actualizarEstadoDelSistema({ almacenamientoPersistente: 'CONCEDIDO' })
    const estado = await modulo.consultable.estadoDelSistema()
    expect(estado.almacenamientoPersistente).toBe('CONCEDIDO')
    expect(estado.dispositivoId).toBe('dispositivo-1')

    await modulo.consultable.actualizarEstadoDelSistema({
      ultimoRespaldoEn: '2026-10-15T20:30:00.000Z',
    })
    const actualizado = await modulo.consultable.estadoDelSistema()
    expect(actualizado.ultimoRespaldoEn).toBe('2026-10-15T20:30:00.000Z')
    expect(actualizado.almacenamientoPersistente).toBe('CONCEDIDO')
  })

  it('consultable.configuracion es equivalente a obtenerConfiguracion', async () => {
    await modulo.actualizarConfiguracion({ nombreTienda: 'Bodega Rosita' })
    expect(await modulo.consultable.configuracion()).toEqual(await modulo.obtenerConfiguracion())
  })
})

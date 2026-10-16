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

  it('estadoDelSistema crea el registro la primera vez, con dispositivoId una sola vez', async () => {
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

  it('actualizarConfiguracion rechaza un nombre vacío y no publica el evento', async () => {
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

  it('actualizarConfiguracion rechaza días fuera de rango', async () => {
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

  it('dos primeras consultas concurrentes devuelven el mismo dispositivoId', async () => {
    const [a, b] = await Promise.all([
      modulo.consultable.estadoDelSistema(),
      modulo.consultable.estadoDelSistema(),
    ])
    expect(a.dispositivoId).toBe(b.dispositivoId)
    expect((await modulo.consultable.estadoDelSistema()).dispositivoId).toBe(a.dispositivoId)
  })

  it('estadoDelSistema concurrente con una actualización termina en CONCEDIDO', async () => {
    await Promise.all([
      modulo.consultable.estadoDelSistema(),
      modulo.consultable.actualizarEstadoDelSistema({ almacenamientoPersistente: 'CONCEDIDO' }),
    ])
    const estado = await modulo.consultable.estadoDelSistema()
    expect(estado.almacenamientoPersistente).toBe('CONCEDIDO')
    expect(estado.dispositivoId).toBe('dispositivo-1')
  })

  it('guarda el nombre de la tienda sin espacios sobrantes', async () => {
    await modulo.actualizarConfiguracion({ nombreTienda: '  Bodega Rosita  ' })
    expect((await modulo.obtenerConfiguracion()).nombreTienda).toBe('Bodega Rosita')
    await modulo.completarPrimeraVez({ nombreTienda: '  Casa Lola ', tamanoDeLetra: 'GRANDE' })
    expect((await modulo.obtenerConfiguracion()).nombreTienda).toBe('Casa Lola')
  })

  it('completarPrimeraVez publica ConfiguracionActualizada después de guardar', async () => {
    const { modulo: m, deps } = crearModulo()
    let publicado = false
    deps.bus.suscribir('ConfiguracionActualizada', () => {
      publicado = true
    })
    await m.completarPrimeraVez({ nombreTienda: 'Casa Lola', tamanoDeLetra: 'GRANDE' })
    expect(publicado).toBe(true)
  })

  it('si falla el guardado no se publica el evento', async () => {
    const { deps } = crearModulo()
    const repositorio = deps.repositorio
    const fallido = crearModuloTienda({
      ...deps,
      repositorio: {
        negocio: () => repositorio.negocio(),
        sistema: () => repositorio.sistema(),
        guardarSistema: (r) => repositorio.guardarSistema(r),
        guardarNegocio: async () => {
          throw new Error('disco lleno')
        },
      },
    })
    let publicado = false
    deps.bus.suscribir('ConfiguracionActualizada', () => {
      publicado = true
    })
    await expect(fallido.actualizarConfiguracion({ nombreTienda: 'X' })).rejects.toThrow(
      'disco lleno',
    )
    await expect(
      fallido.completarPrimeraVez({ nombreTienda: 'X', tamanoDeLetra: 'GRANDE' }),
    ).rejects.toThrow('disco lleno')
    expect(publicado).toBe(false)
  })
})

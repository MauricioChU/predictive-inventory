import { expect, it } from 'vitest'
import type {
  ConfiguracionRegistro,
  EstadoDelSistemaRegistro,
} from '../../../../shared/contratos/registros'
import type { RepositorioDeConfiguracion } from '../../application/puertos'

export const NEGOCIO: ConfiguracionRegistro = {
  clave: 'negocio',
  nombreTienda: 'Bodega Rosita',
  diasEntreCompras: 7,
  diasAnticipacion: 3,
  diasMaximosDeCompra: 30,
  tamanoDeLetra: 'GRANDE',
  notificacionesActivas: false,
  alquilerDelLocal: null,
}

export const SISTEMA: EstadoDelSistemaRegistro = {
  clave: 'sistema',
  dispositivoId: 'id-1',
  primeraVezCompletada: false,
  ultimoRespaldoEn: null,
  almacenamientoPersistente: 'DESCONOCIDO',
  ultimoPagoDelLocalAvisado: null,
}

/**
 * Casos de prueba de `RepositorioDeConfiguracion`: los mismos para la implementación en
 * memoria y la de Dexie (los resultados deben ser idénticos). `crear` devuelve uno vacío.
 */
export function probarRepositorioDeConfiguracion(crear: () => RepositorioDeConfiguracion): void {
  it('no tiene negocio ni sistema al principio', async () => {
    const repo = crear()
    expect(await repo.negocio()).toBeNull()
    expect(await repo.sistema()).toBeNull()
  })

  it('guarda y recupera la configuración del negocio', async () => {
    const repo = crear()
    await repo.guardarNegocio(NEGOCIO)
    expect(await repo.negocio()).toEqual(NEGOCIO)
  })

  it('guarda y recupera el alquiler del local con sus días en orden', async () => {
    const repo = crear()
    const alquilerDelLocal = {
      tipo: 'QUINCENAL' as const,
      montoCentimos: 60_000,
      dias: [5, 20] as [number, number],
    }
    await repo.guardarNegocio({ ...NEGOCIO, alquilerDelLocal })
    expect((await repo.negocio())?.alquilerDelLocal).toEqual(alquilerDelLocal)
  })

  it('guarda y recupera la fecha del aviso del local', async () => {
    const repo = crear()
    await repo.guardarSistema({
      ...SISTEMA,
      ultimoPagoDelLocalAvisado: '2026-10-05',
    })
    const guardado = await repo.sistema()
    expect(guardado?.ultimoPagoDelLocalAvisado).toBe('2026-10-05')
  })

  it('guarda y recupera el estado del sistema, sin mezclarse con el negocio', async () => {
    const repo = crear()
    await repo.guardarSistema(SISTEMA)
    expect((await repo.sistema())?.dispositivoId).toBe('id-1')
    expect(await repo.negocio()).toBeNull()
  })

  it('guardar de nuevo reemplaza cada registro sin tocar el otro', async () => {
    const repo = crear()
    await repo.guardarNegocio(NEGOCIO)
    await repo.guardarSistema(SISTEMA)
    await repo.guardarNegocio({ ...NEGOCIO, nombreTienda: 'Bodega Rosa' })
    await repo.guardarSistema({ ...SISTEMA, primeraVezCompletada: true })
    expect(await repo.negocio()).toEqual({ ...NEGOCIO, nombreTienda: 'Bodega Rosa' })
    expect(await repo.sistema()).toEqual({ ...SISTEMA, primeraVezCompletada: true })
  })
}

import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import { RepositorioDeConfiguracionEnMemoria } from './repositorio'

describe('RepositorioDeConfiguracionEnMemoria', () => {
  it('no tiene negocio ni sistema al principio', async () => {
    const repo = new RepositorioDeConfiguracionEnMemoria(new AlmacenEnMemoria())
    expect(await repo.negocio()).toBeNull()
    expect(await repo.sistema()).toBeNull()
  })

  it('guarda y recupera la configuración del negocio', async () => {
    const repo = new RepositorioDeConfiguracionEnMemoria(new AlmacenEnMemoria())
    await repo.guardarNegocio({
      clave: 'negocio',
      nombreTienda: 'Bodega Rosita',
      diasEntreCompras: 7,
      diasAnticipacion: 3,
      diasMaximosDeCompra: 30,
      tamanoDeLetra: 'GRANDE',
      notificacionesActivas: false,
    })
    expect((await repo.negocio())?.nombreTienda).toBe('Bodega Rosita')
  })

  it('guarda y recupera el estado del sistema, sin mezclarse con el negocio', async () => {
    const repo = new RepositorioDeConfiguracionEnMemoria(new AlmacenEnMemoria())
    await repo.guardarSistema({
      clave: 'sistema',
      dispositivoId: 'id-1',
      primeraVezCompletada: false,
      ultimoRespaldoEn: null,
      almacenamientoPersistente: 'DESCONOCIDO',
      ultimoResumenDelDiaMostrado: null,
    })
    expect((await repo.sistema())?.dispositivoId).toBe('id-1')
    expect(await repo.negocio()).toBeNull()
  })
})

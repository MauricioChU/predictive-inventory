import { describe, expect, it } from 'vitest'
import { BusEnMemoria } from './eventos'

describe('BusEnMemoria', () => {
  it('entrega cada evento solo a los suscriptores de su tipo, en orden', async () => {
    const bus = new BusEnMemoria()
    const recibidos: string[] = []
    bus.suscribir('ProductoCreado', (e) => {
      recibidos.push(`creado:${e.productoId}`)
    })
    bus.suscribir('OperacionRegistrada', async (e) => {
      recibidos.push(`op:${e.operacionId}`)
    })
    await bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })
    await bus.publicar({
      tipo: 'OperacionRegistrada',
      operacionId: 'o1',
      tipoOperacion: 'VENTA',
      productoIds: ['p1'],
    })
    expect(recibidos).toEqual(['creado:p1', 'op:o1'])
  })
  it('permite cancelar la suscripción', async () => {
    const bus = new BusEnMemoria()
    let veces = 0
    const cancelar = bus.suscribir('ConfiguracionActualizada', () => {
      veces++
    })
    cancelar()
    await bus.publicar({ tipo: 'ConfiguracionActualizada' })
    expect(veces).toBe(0)
  })
  // No está en el enunciado de la Tarea 7: completa la cobertura de publicar() cuando
  // nadie se suscribió nunca a ese tipo de evento (RN-SIS-02 exige 95% en el dominio).
  it('no falla al publicar un evento sin ningún suscriptor', async () => {
    const bus = new BusEnMemoria()
    await expect(
      bus.publicar({ tipo: 'ProductoArchivado', productoId: 'p1' }),
    ).resolves.toBeUndefined()
  })
})

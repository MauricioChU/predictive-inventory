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

  // Fix round 1, I2: aísla fallas de manejadores y congela la lista de suscriptores
  // al empezar a publicar (ADR-0002: publicar() nunca rechaza por culpa de un manejador,
  // porque se publica DESPUÉS de confirmar la unidad de trabajo).
  it('un manejador que lanza de forma síncrona no detiene a los siguientes ni hace rechazar a publicar()', async () => {
    const bus = new BusEnMemoria()
    const recibidos: string[] = []
    bus.suscribir('ProductoCreado', () => {
      throw new Error('falla síncrona')
    })
    bus.suscribir('ProductoCreado', (e) => {
      recibidos.push(e.productoId)
    })
    await expect(bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })).resolves.toBeUndefined()
    expect(recibidos).toEqual(['p1'])
  })

  it('un manejador async que rechaza no detiene a los siguientes ni hace rechazar a publicar()', async () => {
    const bus = new BusEnMemoria()
    const recibidos: string[] = []
    bus.suscribir('ProductoCreado', async () => {
      throw new Error('falla async')
    })
    bus.suscribir('ProductoCreado', (e) => {
      recibidos.push(e.productoId)
    })
    await expect(bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })).resolves.toBeUndefined()
    expect(recibidos).toEqual(['p1'])
  })

  it('alFallar recibe cada error junto con el evento que lo causó', async () => {
    const fallos: Array<{ error: unknown; tipo: string }> = []
    const bus = new BusEnMemoria((error, evento) => fallos.push({ error, tipo: evento.tipo }))
    bus.suscribir('ProductoCreado', () => {
      throw new Error('falla 1')
    })
    bus.suscribir('ProductoCreado', async () => {
      throw new Error('falla 2')
    })
    await bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })
    expect(fallos).toHaveLength(2)
    expect((fallos[0]?.error as Error).message).toBe('falla 1')
    expect((fallos[1]?.error as Error).message).toBe('falla 2')
    expect(fallos[0]?.tipo).toBe('ProductoCreado')
  })

  it('suscribirse durante una publicación no recibe el evento en curso', async () => {
    const bus = new BusEnMemoria()
    const recibidos: string[] = []
    bus.suscribir('ProductoCreado', (e) => {
      recibidos.push(`primero:${e.productoId}`)
      bus.suscribir('ProductoCreado', (e2) => {
        recibidos.push(`nuevo:${e2.productoId}`)
      })
    })
    await bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })
    expect(recibidos).toEqual(['primero:p1'])
    await bus.publicar({ tipo: 'ProductoCreado', productoId: 'p2' })
    expect(recibidos).toEqual(['primero:p1', 'primero:p2', 'nuevo:p2'])
  })

  it('cancelar y volver a suscribirse dentro de un manejador no causa llamadas repetidas', async () => {
    const bus = new BusEnMemoria()
    const recibidos: string[] = []
    bus.suscribir('ProductoCreado', (e) => {
      recibidos.push(`a:${e.productoId}`)
      cancelarB()
      cancelarB = bus.suscribir('ProductoCreado', (e2) => {
        recibidos.push(`b:${e2.productoId}`)
      })
    })
    let cancelarB = bus.suscribir('ProductoCreado', (e) => {
      recibidos.push(`b:${e.productoId}`)
    })
    await bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })
    expect(recibidos).toEqual(['a:p1', 'b:p1'])
  })
})

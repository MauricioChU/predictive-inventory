import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { instanteLocal } from '@/shared/domain/fecha'
import { RelojFijo } from '@/shared/domain/reloj'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEscenario } from '../__pruebas__/escenario'
import { SEGUNDOS_PARA_DESHACER, ServicioDeDeshacer } from './deshacer'

const AHORA = instanteLocal('2026-10-15 10:00')
const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))

function servicio() {
  const reloj = new RelojFijo(AHORA)
  const anuladas: string[] = []
  const deshacer = new ServicioDeDeshacer(reloj, async (operacionId) => {
    anuladas.push(operacionId)
  })
  return { reloj, anuladas, deshacer }
}

describe('ServicioDeDeshacer', () => {
  it('RN-OP-18: se ofrece durante 10 segundos', () => {
    expect(SEGUNDOS_PARA_DESHACER).toBe(10)
    const { reloj, deshacer } = servicio()
    expect(deshacer.disponible()).toBeNull()
    deshacer.ofrecer('op-1', AHORA)
    expect(deshacer.disponible()).toEqual({ operacionId: 'op-1', segundosRestantes: 10 })
    reloj.avanzarSegundos(5)
    expect(deshacer.disponible()).toEqual({ operacionId: 'op-1', segundosRestantes: 5 })
    reloj.avanzarSegundos(4.5)
    expect(deshacer.disponible()).toEqual({ operacionId: 'op-1', segundosRestantes: 1 })
    reloj.avanzarSegundos(0.5)
    expect(deshacer.disponible()).toBeNull()
  })

  it('RN-OP-18: a los 11 segundos ya no se ofrece', () => {
    const { reloj, deshacer } = servicio()
    deshacer.ofrecer('op-1', AHORA)
    reloj.avanzarSegundos(11)
    expect(deshacer.disponible()).toBeNull()
  })

  it('RN-OP-18: deshacer anula la operación ofrecida y luego ya no se ofrece', async () => {
    const { reloj, deshacer, anuladas } = servicio()
    deshacer.ofrecer('op-1', AHORA)
    reloj.avanzarSegundos(5)
    await deshacer.deshacer()
    expect(anuladas).toEqual(['op-1'])
    expect(deshacer.disponible()).toBeNull()
    await expect(deshacer.deshacer()).rejects.toThrow('No hay nada que deshacer')
    expect(anuladas).toEqual(['op-1'])
  })

  it('RN-OP-18: solo se deshace la última operación registrada', async () => {
    const { deshacer, anuladas } = servicio()
    deshacer.ofrecer('op-1', AHORA)
    deshacer.ofrecer('op-2', AHORA)
    expect(deshacer.disponible()?.operacionId).toBe('op-2')
    await deshacer.deshacer()
    expect(anuladas).toEqual(['op-2'])
  })

  it('RN-OP-18: un toque hecho mientras se ofrecía se respeta aunque llegue tarde (2 s de margen)', async () => {
    const { reloj, deshacer, anuladas } = servicio()
    deshacer.ofrecer('op-1', AHORA)
    reloj.avanzarSegundos(11.9)
    await deshacer.deshacer()
    expect(anuladas).toEqual(['op-1'])
  })

  it('RN-OP-18: pasado el margen, deshacer se rechaza y no anula nada', async () => {
    const { reloj, deshacer, anuladas } = servicio()
    deshacer.ofrecer('op-1', AHORA)
    reloj.avanzarSegundos(12)
    await expect(deshacer.deshacer()).rejects.toThrow(
      'Ya pasó el tiempo para deshacer. Puedes anularla desde el Historial.',
    )
    expect(anuladas).toEqual([])
    expect(deshacer.disponible()).toBeNull()
  })

  it('RN-OP-18: con el reloj atrasado, no ofrece más de 10 segundos', () => {
    const { reloj, deshacer } = servicio()
    deshacer.ofrecer('op-1', AHORA)
    reloj.avanzarSegundos(-3)
    expect(deshacer.disponible()?.segundosRestantes).toBe(10)
  })
})

describe('deshacer en el módulo', () => {
  it('RN-OP-18: deshacer justo después de registrar deja el stock como estaba', async () => {
    const { modulo, reloj, stock } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '2' }],
    })
    reloj.avanzarSegundos(5)
    expect(modulo.deshacer.disponible()).toEqual({ operacionId, segundosRestantes: 5 })
    await modulo.deshacer.deshacer()
    expect(await stock('lejia')).toEqual(Cantidad.deEntero(10))
    const venta = (await modulo.historial()).find((o) => o.id === operacionId)
    expect(venta?.anulada).toBe(true)
    expect(modulo.deshacer.disponible()).toBeNull()
  })

  it('RN-OP-18: el botón Deshacer desaparece a los 10 segundos', async () => {
    const { modulo, reloj } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '2' }] })
    reloj.avanzarSegundos(11)
    expect(modulo.deshacer.disponible()).toBeNull()
  })

  it('RN-OP-18: a los 11 s un toque tardío todavía deshace (dentro del margen)', async () => {
    const { modulo, reloj, stock } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '2' }] })
    reloj.avanzarSegundos(11)
    await modulo.deshacer.deshacer()
    expect(await stock('lejia')).toEqual(Cantidad.deEntero(10))
  })

  it('RN-OP-18: a los 15 s deshacer se rechaza y el stock no cambia', async () => {
    const { modulo, reloj, stock, tipos } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '2' }] })
    reloj.avanzarSegundos(15)
    await expect(modulo.deshacer.deshacer()).rejects.toThrow(
      'Ya pasó el tiempo para deshacer. Puedes anularla desde el Historial.',
    )
    expect(await stock('lejia')).toEqual(Cantidad.deEntero(8))
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL', 'VENTA'])
  })

  it('RN-OP-18: una hora después, deshacer ya no anula (se anula desde el Historial)', async () => {
    const { modulo, reloj, stock } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '2' }] })
    reloj.avanzarSegundos(3600)
    await expect(modulo.deshacer.deshacer()).rejects.toThrow('Ya pasó el tiempo para deshacer')
    expect(await stock('lejia')).toEqual(Cantidad.deEntero(8))
  })

  it('RN-OP-18: se ofrece tras cualquier registro, pero no tras una anulación', async () => {
    const { modulo } = await escenario()
    const merma = await modulo.registrarMerma({
      productoId: 'carbon',
      cantidad: '1',
      motivo: 'Se venció',
    })
    expect(modulo.deshacer.disponible()?.operacionId).toBe(merma.operacionId)
    const conteo = await modulo.contarStock({ productoId: 'lejia', contado: '9' })
    const conteoId = conteo.tipo === 'ajustado' ? conteo.operacionId : ''
    expect(modulo.deshacer.disponible()?.operacionId).toBe(conteoId)
    await modulo.anularOperacion({ operacionId: merma.operacionId })
    expect(modulo.deshacer.disponible()?.operacionId).toBe(conteoId)
  })

  it('RN-OP-18: si el registro falla, no se ofrece deshacer', async () => {
    const { modulo } = await escenario()
    const antes = modulo.deshacer.disponible()
    await expect(
      modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '11' }] }),
    ).rejects.toThrow()
    expect(modulo.deshacer.disponible()).toEqual(antes)
  })
})

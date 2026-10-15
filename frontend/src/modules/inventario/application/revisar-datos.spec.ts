import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEscenario } from '../__pruebas__/escenario'

const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')
const unidades = (n: number) => Cantidad.deEntero(n)

describe('revisarDatos', () => {
  it('RN-OP-19: corrige una existencia que no cuadra e informa qué cambió', async () => {
    const { modulo, existencias, stock } = await escenario()
    await existencias.fijar('carbon', kilos('7'))
    const resultado = await modulo.revisarDatos()
    expect(resultado).toEqual({
      mensaje: 'Corregimos el stock de 1 producto: Carbón (7 kg → 10 kg)',
      corregidos: [{ productoId: 'carbon', antes: kilos('7'), despues: kilos('10') }],
    })
    expect(await stock('carbon')).toEqual(kilos('10'))
    expect(await stock('lejia')).toEqual(unidades(10))
  })

  it('RN-OP-19: sin diferencias, "Todo está en orden"', async () => {
    const { modulo } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '3' }] })
    expect(await modulo.revisarDatos()).toEqual({ mensaje: 'Todo está en orden', corregidos: [] })
  })

  it('RN-OP-19: varias correcciones, ordenadas por nombre', async () => {
    const { modulo, existencias, almacen } = await escenario()
    await existencias.fijar('lejia', unidades(3))
    almacen.eliminar('existencias', 'carbon')
    const resultado = await modulo.revisarDatos()
    expect(resultado.mensaje).toBe(
      'Corregimos el stock de 2 productos: Carbón (0 kg → 10 kg), Lejía 1 L (3 unid. → 10 unid.)',
    )
    expect(resultado.corregidos.map((c) => c.productoId)).toEqual(['carbon', 'lejia'])
  })

  it('RN-OP-19: una existencia sin movimientos vuelve a 0 (producto desconocido: se muestra su id)', async () => {
    const { modulo, existencias } = await escenario()
    await existencias.fijar('fantasma', unidades(5))
    expect((await modulo.revisarDatos()).mensaje).toBe(
      'Corregimos el stock de 1 producto: fantasma (5 unid. → 0 unid.)',
    )
    expect((await existencias.todas()).has('fantasma')).toBe(false)
  })

  it('RN-OP-19: también reconstruye cada proyección con todo el libro', async () => {
    const { modulo, proyeccion, operaciones } = await escenario()
    await modulo.revisarDatos()
    expect(proyeccion.reconstrucciones).toEqual([await operaciones.todas()])
  })

  it('RN-OP-06: si una proyección falla al reconstruir, las existencias no cambian', async () => {
    const { modulo, existencias, proyeccion, stock } = await escenario()
    await existencias.fijar('carbon', kilos('7'))
    proyeccion.reconstruir = async () => {
      throw new Error('La proyección falló')
    }
    await expect(modulo.revisarDatos()).rejects.toThrow('La proyección falló')
    expect(await stock('carbon')).toEqual(kilos('7'))
  })
})

describe('reconstruirExistencias', () => {
  it('ADR-0002: recalcula las existencias y las proyecciones desde el libro, sin informar', async () => {
    const { modulo, existencias, proyeccion, stock } = await escenario()
    await existencias.reemplazarTodas(new Map())
    await modulo.reconstruirExistencias()
    expect(await stock('lejia')).toEqual(unidades(10))
    expect(await stock('detergente')).toEqual(kilos('5'))
    expect(proyeccion.reconstrucciones).toHaveLength(1)
  })
})

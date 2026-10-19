import { describe, expect, it, vi } from 'vitest'
import type { Aplicacion } from '../composicion'
import type { InicioDeLaApp } from '../abrir-app'
import { crearMontaje, type PantallasDeLaApp } from '../montaje'

/** Solo lo que el montaje usa de la aplicación. */
function aplicacionFalsa(): Aplicacion & { detener: ReturnType<typeof vi.fn> } {
  return { detener: vi.fn() } as unknown as Aplicacion & { detener: ReturnType<typeof vi.fn> }
}
const APLICACION = aplicacionFalsa()
const INICIO: InicioDeLaApp = {
  primeraVez: false,
  tamanoDeLetra: 'GRANDE',
  resumenDelDia: null,
  recordatorioDeCopia: null,
  recordatorioDelLocal: null,
}

/** Pantallas falsas que anotan qué se montó y qué se desmontó, en orden. */
function pantallas() {
  const bitacora: string[] = []
  const falsas: PantallasDeLaApp = {
    montarApp: vi.fn(() => {
      bitacora.push('monta la app')
      return () => bitacora.push('desmonta la app y desconecta su estado global')
    }),
    montarSinDatos: vi.fn((motivo) => {
      bitacora.push(`monta sin datos: ${motivo}`)
      return () => bitacora.push(`desmonta sin datos: ${motivo}`)
    }),
  }
  return { falsas, bitacora }
}

describe('crearMontaje: qué queda en #app', () => {
  it('monta la app cuando el arranque termina', () => {
    const { falsas, bitacora } = pantallas()
    crearMontaje(falsas).montarApp(APLICACION, INICIO)
    expect(bitacora).toEqual(['monta la app'])
    expect(falsas.montarApp).toHaveBeenCalledWith(APLICACION, INICIO)
  })

  it('RN-UX-07: un error al arrancar muestra la pantalla sin datos con su motivo', () => {
    const { falsas, bitacora } = pantallas()
    crearMontaje(falsas).mostrarError('sin-espacio')
    expect(bitacora).toEqual(['monta sin datos: sin-espacio'])
  })

  it('M2: si otra pestaña actualiza la base con la app montada, la desmonta (con su estado global) y avisa', () => {
    const { falsas, bitacora } = pantallas()
    const montaje = crearMontaje(falsas)
    montaje.montarApp(APLICACION, INICIO)
    montaje.seActualizoLaBase()
    expect(bitacora).toEqual([
      'monta la app',
      'desmonta la app y desconecta su estado global',
      'monta sin datos: actualizada',
    ])
  })

  it('M2: si la base se actualiza ANTES de montar, montar no pisa "La app se actualizó"', () => {
    const { falsas, bitacora } = pantallas()
    const montaje = crearMontaje(falsas)
    montaje.seActualizoLaBase()
    montaje.montarApp(APLICACION, INICIO)
    expect(bitacora).toEqual(['monta sin datos: actualizada'])
    expect(falsas.montarApp).not.toHaveBeenCalled()
  })

  it('M2: la aplicación que termina de abrir después de actualizarse la base se detiene sin montarse', () => {
    const { falsas } = pantallas()
    const montaje = crearMontaje(falsas)
    const aplicacion = aplicacionFalsa()
    montaje.seActualizoLaBase()
    montaje.montarApp(aplicacion, INICIO)
    expect(aplicacion.detener).toHaveBeenCalledOnce()
    expect(falsas.montarApp).not.toHaveBeenCalled()
  })

  it('si montar una pantalla lanza, la anterior no se vuelve a desmontar después', () => {
    const { falsas, bitacora } = pantallas()
    const montaje = crearMontaje(falsas)
    montaje.mostrarError('otro')
    vi.mocked(falsas.montarApp).mockImplementationOnce(() => {
      throw new Error('falla al montar')
    })
    expect(() => montaje.montarApp(APLICACION, INICIO)).toThrow('falla al montar')
    montaje.seActualizoLaBase()
    expect(bitacora).toEqual([
      'monta sin datos: otro',
      'desmonta sin datos: otro',
      'monta sin datos: actualizada',
    ])
  })

  it('M2: tampoco la pisa un error del arranque que llega después (la base ya se cerró)', () => {
    const { falsas, bitacora } = pantallas()
    const montaje = crearMontaje(falsas)
    montaje.seActualizoLaBase()
    montaje.mostrarError('otro')
    montaje.seActualizoLaBase()
    expect(bitacora).toEqual(['monta sin datos: actualizada'])
  })
})

// @vitest-environment node
import type { PickleStep } from '@cucumber/messages'
import { afterEach, describe, expect, it } from 'vitest'
import { ejecutarPaso } from '../gherkin/ejecutar-feature'
import { cerrarMundo, crearMundo, crearPasos } from './pasos'
import type { Mundo } from './pasos/mundo'

const pasos = crearPasos()
const paso = (texto: string): PickleStep =>
  ({ id: 'id', text: texto, astNodeIds: [] }) as PickleStep

async function correr(m: Mundo, ...textos: string[]): Promise<void> {
  for (const texto of textos) await ejecutarPaso(m, paso(texto), pasos)
}

const LEJIA_CON_10 =
  'creo el producto "Lejía 1 L" con unidad "UNIDAD", precio de compra "2.40", precio de venta "3.50", stock mínimo "3" y stock inicial "10"'
const SIN_STOCK = 'error: Solo quedan 10 unid. de Lejía 1 L'

/**
 * Una acción ("Dado que vendo …", "Cuando vendo …") guarda su error de dominio en el resultado
 * para que lo verifique "el resultado es …". Si ningún paso lo revisa, el escenario falla: un
 * "Dado" que no pudo hacer lo que dice no puede pasar en silencio.
 */
describe('Una acción que termina en error no se traga en silencio', () => {
  afterEach(cerrarMundo)

  async function escenarioConVentaFallida(): Promise<Mundo> {
    const m = crearMundo()
    await correr(m, 'que hoy es "2026-10-15 10:00"', 'existen las categorías "Otros"', LEJIA_CON_10)
    await correr(m, 'que vendo "11" de "Lejía 1 L"')
    return m
  }

  it('un "Dado" con error de dominio hace fallar el paso siguiente si no revisa el resultado', async () => {
    const m = await escenarioConVentaFallida()

    await expect(correr(m, 'vendo "1" de "Lejía 1 L"')).rejects.toThrow(
      `Falló el paso "vendo "1" de "Lejía 1 L"": El paso anterior terminó en "${SIN_STOCK}" y este paso no lo revisa`,
    )
  })

  it('un paso que revisa el resultado lo da por visto y el escenario sigue', async () => {
    const m = await escenarioConVentaFallida()

    await correr(m, `el resultado es "${SIN_STOCK}"`, 'vendo "1" de "Lejía 1 L"')

    expect(m.resultado).toBe('registrada')
  })

  it('si el escenario termina sin revisar el error, falla al cerrarse', async () => {
    await escenarioConVentaFallida()

    await expect(cerrarMundo()).rejects.toThrow(`El escenario terminó sin revisar "${SIN_STOCK}"`)
  })

  it('también una pregunta sin contestar (confirmar, sobrecompra, reactivar) debe revisarse', async () => {
    const m = crearMundo()
    await correr(
      m,
      'que hoy es "2026-10-15 10:00"',
      'existen las categorías "Otros"',
      'creo un producto con precio de compra "5.00" y precio de venta "4.50"',
    )

    await expect(correr(m, 'busco "producto"')).rejects.toThrow(
      'El paso anterior terminó en "confirmar: Vas a perder S/ 0.50 por cada unidad"',
    )
  })
})

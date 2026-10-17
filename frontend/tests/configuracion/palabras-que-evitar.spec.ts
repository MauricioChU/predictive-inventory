// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PALABRAS_QUE_EVITAR } from '../../e2e/utilidades/palabras-que-evitar'

/** La auditoría de textos de las E2E (plan 16) marcaría este texto. */
const seMarca = (texto: string) => PALABRAS_QUE_EVITAR.some(({ palabra }) => palabra.test(texto))

describe('plan 16: la lista de palabras que la guía manda evitar (06, «Guía de palabras»)', () => {
  it.each([
    'Merma',
    'Registrar merma',
    'Registrar ingreso',
    'Registrar entrada',
    'Ajuste de inventario',
    'Stock crítico',
    'Bajo umbral',
    'Cobertura de 4 días',
    'Consulta de cobertura',
    'Backup',
    'Exportar JSON',
    'Revertir',
    'Rollback',
    'Total: undefined',
    'S/ NaN',
  ])('marca "%s"', (texto) => {
    expect(seMarca(texto)).toBe(true)
  })

  it.each([
    'Llegó mercadería',
    'Se derramó',
    'Contar stock',
    'Queda poco · Agotado · Bien',
    'Se acaba en ~4 días',
    'Guardar copia',
    'Restaurar copia',
    'Deshacer',
    'Anular',
    'Ajustes',
    'Pérdidas (se dañó, se derramó o se venció)',
    'respaldo-bodega-rosita-2026-10-16-1030.json',
  ])('deja pasar "%s"', (texto) => {
    expect(seMarca(texto)).toBe(false)
  })
})

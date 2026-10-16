import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import ListaAgrupadaPorDia from '../componentes/ListaAgrupadaPorDia.vue'

interface Operacion {
  id: string
  texto: string
}

const HOY = '2026-10-16' // viernes

const GRUPOS = [
  {
    dia: '2026-10-16',
    items: [
      { id: 'v2', texto: 'Venta S/ 14.63' },
      { id: 'v1', texto: 'Venta S/ 3.50' },
    ],
  },
  { dia: '2026-10-15', items: [{ id: 'r1', texto: 'Llegó mercadería' }] },
  { dia: '2026-10-14', items: [] as Operacion[] },
  { dia: '2026-10-12', items: [{ id: 'm1', texto: 'Se derramó' }] },
  { dia: '2026-10-01', items: [{ id: 'v0', texto: 'Venta S/ 1.00' }] },
]

function montar(props: Record<string, unknown> = {}) {
  return mount(ListaAgrupadaPorDia<Operacion>, {
    props: { grupos: GRUPOS, hoy: HOY, ...props },
    slots: {
      default: ({ item, dia }: { item: Operacion; dia: string }) =>
        h('span', { class: 'operacion', 'data-dia': dia }, item.texto),
    },
  })
}

describe('ListaAgrupadaPorDia (Historial)', () => {
  it('un encabezado h2 por día con su etiqueta ("Hoy", "Ayer", "Lunes 12", fecha), en el orden recibido', () => {
    const w = montar()
    expect(w.findAll('h2').map((h2) => h2.text())).toEqual([
      'Hoy',
      'Ayer',
      'Lunes 12',
      '01/10/2026',
    ])
  })

  it('un día sin ítems no deja un encabezado vacío', () => {
    const w = montar()
    expect(w.text()).not.toContain('Miércoles 14')
  })

  it('RN-UX-15: cada día es una lista semántica nombrada por su encabezado, con un li por ítem', () => {
    const w = montar()
    const listas = w.findAll('ul')
    expect(listas).toHaveLength(4)
    const hoy = listas[0]!
    expect(hoy.attributes('role')).toBe('list')
    expect(w.get(`#${hoy.attributes('aria-labelledby')!}`).text()).toBe('Hoy')
    expect(hoy.findAll('li').map((li) => li.text())).toEqual(['Venta S/ 14.63', 'Venta S/ 3.50'])
  })

  it('el slot recibe el ítem y su día', () => {
    const w = montar()
    const derrame = w.findAll('.operacion').find((o) => o.text() === 'Se derramó')!
    expect(derrame.attributes('data-dia')).toBe('2026-10-12')
  })

  it('nivelEncabezado 3: los días van en h3 (p. ej. dentro de "Últimos movimientos")', () => {
    const w = montar({ nivelEncabezado: 3 })
    expect(w.findAll('h2')).toHaveLength(0)
    expect(w.findAll('h3').map((h3) => h3.text())).toEqual([
      'Hoy',
      'Ayer',
      'Lunes 12',
      '01/10/2026',
    ])
  })

  it('RN-UX-10: sin ítems, muestra el estado vacío útil y su acción emite accion', async () => {
    const w = montar({
      grupos: [{ dia: HOY, items: [] }],
      vacio: {
        titulo: 'Aún no hay operaciones',
        descripcion: 'Aquí verás lo que vendas.',
        accion: 'Vender',
      },
    })
    expect(w.find('ul').exists()).toBe(false)
    expect(w.text()).toContain('Aún no hay operaciones')
    expect(w.text()).toContain('Aquí verás lo que vendas.')
    await w.get('button').trigger('click')
    expect(w.emitted('accion')).toHaveLength(1)
  })

  it('sin ítems y sin estado vacío, no muestra nada', () => {
    const w = montar({ grupos: [] })
    expect(w.find('ul').exists()).toBe(false)
    expect(w.find('h2').exists()).toBe(false)
    expect(w.text()).toBe('')
  })
})

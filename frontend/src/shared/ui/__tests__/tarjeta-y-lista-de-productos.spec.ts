import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AccesosRapidos from '../componentes/AccesosRapidos.vue'
import EstadoVacio from '../componentes/EstadoVacio.vue'
import InsigniaEstado from '../componentes/InsigniaEstado.vue'
import ListaDeProductos from '../componentes/ListaDeProductos.vue'
import TarjetaDeProducto from '../componentes/TarjetaDeProducto.vue'
import { textoReferido } from './utilidades-kit-productos'

const LEJIA = {
  nombre: 'Lejía Clorox 1 L',
  categoria: 'Lejías y desinfectantes',
  textoStock: '12 unid.',
  textoPrecio: 'S/ 4.50',
}

describe('TarjetaDeProducto', () => {
  it('es UN solo botón cuyo nombre accesible es el nombre del producto + el stock', () => {
    const w = mount(TarjetaDeProducto, { props: LEJIA })
    const botones = w.findAll('button')
    expect(botones).toHaveLength(1)
    expect(textoReferido(botones[0]!.element, 'aria-labelledby')).toBe('Lejía Clorox 1 L 12 unid.')
    expect(w.findAll('a, input, select, textarea')).toHaveLength(0)
  })

  it('el precio, el estado y el texto secundario quedan como descripción del botón', () => {
    const w = mount(TarjetaDeProducto, {
      props: { ...LEJIA, estado: 'POR_ACABARSE', textoSecundario: 'Se acaba en ~4 días' },
    })
    const boton = w.get('button').element
    expect(textoReferido(boton, 'aria-describedby')).toBe('S/ 4.50 Queda poco Se acaba en ~4 días')
    expect(w.text()).toContain('Se acaba en ~4 días')
  })

  it('al tocarla emite elegir', async () => {
    const w = mount(TarjetaDeProducto, { props: LEJIA })
    await w.get('button').trigger('click')
    expect(w.emitted('elegir')).toEqual([[]])
  })

  it('RN-UX-04: muestra InsigniaEstado (ícono + texto) solo si hay estado', () => {
    const sinEstado = mount(TarjetaDeProducto, { props: LEJIA })
    expect(sinEstado.findComponent(InsigniaEstado).exists()).toBe(false)
    expect(sinEstado.get('button').attributes('aria-describedby')).toBeDefined()

    const agotado = mount(TarjetaDeProducto, { props: { ...LEJIA, estado: 'AGOTADO' } })
    expect(agotado.getComponent(InsigniaEstado).text()).toBe('Agotado')
  })

  it('sin precio ni extras no deja una descripción vacía', () => {
    const w = mount(TarjetaDeProducto, { props: { nombre: 'Bolsa', textoStock: '3 unid.' } })
    expect(w.get('button').attributes('aria-describedby')).toBeUndefined()
  })

  it('la foto va dentro como decorativa (el botón ya dice el nombre)', () => {
    const w = mount(TarjetaDeProducto, { props: { ...LEJIA, imagen: 'https://ejemplo.pe/l.jpg' } })
    expect(w.get('img').attributes('alt')).toBe('')
  })
})

describe('ListaDeProductos', () => {
  const PRODUCTOS = [
    { id: 'p-1', ...LEJIA },
    { id: 'p-2', nombre: 'Bolsa negra 20 L', textoStock: 'Agotado', estado: 'AGOTADO' as const },
  ]
  const VACIO = {
    titulo: 'Aún no tienes productos',
    descripcion: 'Agrega el primero para empezar a vender.',
    accion: 'Agregar el primero',
  }

  it('es una lista accesible con una tarjeta por producto', () => {
    const w = mount(ListaDeProductos, { props: { productos: PRODUCTOS, vacio: VACIO } })
    const lista = w.get('ul')
    expect(lista.attributes('role')).toBe('list')
    expect(lista.findAll('li')).toHaveLength(2)
    expect(w.findAllComponents(TarjetaDeProducto)).toHaveLength(2)
    expect(w.findComponent(EstadoVacio).exists()).toBe(false)
  })

  it('al tocar una tarjeta emite elegir con el id del producto', async () => {
    const w = mount(ListaDeProductos, { props: { productos: PRODUCTOS, vacio: VACIO } })
    await w.findAll('button')[1]!.trigger('click')
    expect(w.emitted('elegir')).toEqual([['p-2']])
  })

  it('puede llevar un nombre para la lista (p. ej. "Resultados")', () => {
    const w = mount(ListaDeProductos, {
      props: { productos: PRODUCTOS, vacio: VACIO, etiqueta: 'Resultados' },
    })
    expect(w.get('ul').attributes('aria-label')).toBe('Resultados')
  })

  it('RN-UX-10: vacía, muestra EstadoVacio con la acción siguiente y la emite', async () => {
    const w = mount(ListaDeProductos, { props: { productos: [], vacio: VACIO } })
    expect(w.find('ul').exists()).toBe(false)
    const vacio = w.getComponent(EstadoVacio)
    expect(vacio.text()).toContain('Aún no tienes productos')
    expect(vacio.text()).toContain('Agrega el primero para empezar a vender.')
    await vacio.get('button').trigger('click')
    expect(w.emitted('accion')).toEqual([[]])
  })
})

describe('AccesosRapidos', () => {
  const MAS_VENDIDOS = Array.from({ length: 10 }, (_, i) => ({
    id: `p-${i + 1}`,
    nombre: `Producto ${i + 1}`,
  }))

  it('muestra como máximo 8 botones, cada uno con la foto y el nombre', () => {
    const w = mount(AccesosRapidos, { props: { productos: MAS_VENDIDOS } })
    const botones = w.findAll('button')
    expect(botones).toHaveLength(8)
    expect(botones[0]!.text()).toBe('Producto 1')
    expect(botones[7]!.text()).toBe('Producto 8')
  })

  it('es una lista accesible con nombre ("Más vendidos" si no se dice otro)', () => {
    const w = mount(AccesosRapidos, { props: { productos: MAS_VENDIDOS.slice(0, 2) } })
    const lista = w.get('ul')
    expect(lista.attributes('role')).toBe('list')
    expect(lista.attributes('aria-label')).toBe('Más vendidos')
    const otra = mount(AccesosRapidos, {
      props: { productos: MAS_VENDIDOS.slice(0, 2), etiqueta: 'Lo de siempre' },
    })
    expect(otra.get('ul').attributes('aria-label')).toBe('Lo de siempre')
  })

  it('al tocar uno emite elegir con su id', async () => {
    const w = mount(AccesosRapidos, { props: { productos: MAS_VENDIDOS } })
    await w.findAll('button')[2]!.trigger('click')
    expect(w.emitted('elegir')).toEqual([['p-3']])
  })

  it('la foto es decorativa: el nombre del botón es el texto visible', () => {
    const w = mount(AccesosRapidos, {
      props: { productos: [{ id: 'p-1', nombre: 'Lejía', imagen: 'https://ejemplo.pe/l.jpg' }] },
    })
    expect(w.get('img').attributes('alt')).toBe('')
    expect(w.get('button').text()).toBe('Lejía')
  })

  it('sin productos no dibuja nada (ni una lista vacía)', () => {
    const w = mount(AccesosRapidos, { props: { productos: [] } })
    expect(w.find('ul').exists()).toBe(false)
    expect(w.findAll('button')).toHaveLength(0)
  })
})

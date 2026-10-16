import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FotoDeProducto from '../componentes/FotoDeProducto.vue'
import { simularUrlsDeObjeto } from './utilidades-kit-productos'

describe('FotoDeProducto', () => {
  let urls: ReturnType<typeof simularUrlsDeObjeto>
  beforeEach(() => {
    urls = simularUrlsDeObjeto()
  })
  afterEach(() => urls.restaurar())

  it('con un Blob crea una URL de objeto, la usa de src y el alt es el nombre', () => {
    const foto = new Blob(['x'], { type: 'image/jpeg' })
    const w = mount(FotoDeProducto, {
      props: { imagen: foto, nombre: 'Lejía Clorox 1 L', tamano: 'mediana' },
    })
    expect(urls.crear).toHaveBeenCalledWith(foto)
    const img = w.get('img')
    expect(img.attributes('src')).toBe('blob:prueba-1')
    expect(img.attributes('alt')).toBe('Lejía Clorox 1 L')
  })

  it('revoca la URL al desmontarse (no deja memoria tomada)', () => {
    const w = mount(FotoDeProducto, {
      props: { imagen: new Blob(['x']), nombre: 'Lejía', tamano: 'chica' },
    })
    w.unmount()
    expect(urls.revocar).toHaveBeenCalledWith('blob:prueba-1')
  })

  it('al cambiar de foto revoca la URL anterior y crea una nueva', async () => {
    const w = mount(FotoDeProducto, {
      props: { imagen: new Blob(['a']), nombre: 'Lejía', tamano: 'grande' },
    })
    await w.setProps({ imagen: new Blob(['b']) })
    expect(urls.revocar).toHaveBeenCalledWith('blob:prueba-1')
    expect(w.get('img').attributes('src')).toBe('blob:prueba-2')
    // Al pasar a una dirección (string) o a "sin foto" también se libera la última.
    await w.setProps({ imagen: 'https://ejemplo.pe/lejia.jpg' })
    expect(urls.revocar).toHaveBeenCalledWith('blob:prueba-2')
    expect(w.get('img').attributes('src')).toBe('https://ejemplo.pe/lejia.jpg')
    expect(urls.crear).toHaveBeenCalledTimes(2)
  })

  it('ronda 1: al pasar de un Blob a "sin foto" revoca la URL y muestra el ícono', async () => {
    const w = mount(FotoDeProducto, {
      props: { imagen: new Blob(['a']), nombre: 'Lejía', tamano: 'chica' },
    })
    await w.setProps({ imagen: undefined })
    expect(urls.revocar).toHaveBeenCalledWith('blob:prueba-1')
    expect(w.find('img').exists()).toBe(false)
    expect(w.get('.foto-de-producto').attributes('aria-label')).toBe('Lejía')
  })

  it('ronda 1: la foto se carga y decodifica sin trabar la lista (lazy + async)', () => {
    const w = mount(FotoDeProducto, {
      props: { imagen: 'https://ejemplo.pe/l.jpg', nombre: 'Lejía', tamano: 'chica' },
    })
    expect(w.get('img').attributes('loading')).toBe('lazy')
    expect(w.get('img').attributes('decoding')).toBe('async')
  })

  it('con un string lo usa directo, sin crear URLs de objeto', () => {
    const w = mount(FotoDeProducto, {
      props: { imagen: 'data:image/png;base64,AAAA', nombre: 'Bolsa', tamano: 'chica' },
    })
    expect(w.get('img').attributes('src')).toBe('data:image/png;base64,AAAA')
    expect(urls.crear).not.toHaveBeenCalled()
  })

  it('sin foto: el ícono de la categoría va oculto y el nombre accesible queda en el contenedor', () => {
    const w = mount(FotoDeProducto, {
      props: {
        nombre: 'Lejía Clorox 1 L',
        categoria: 'Lejías y desinfectantes',
        tamano: 'mediana',
      },
    })
    expect(w.find('img').exists()).toBe(false)
    const contenedor = w.get('.foto-de-producto')
    expect(contenedor.attributes('role')).toBe('img')
    expect(contenedor.attributes('aria-label')).toBe('Lejía Clorox 1 L')
    const icono = w.get('svg')
    expect(icono.attributes('aria-hidden')).toBe('true')
    expect(icono.classes()).toContain('lucide-droplets')
  })

  it('sin foto ni categoría conocida usa el ícono genérico', () => {
    const w = mount(FotoDeProducto, { props: { nombre: 'Cosa rara', tamano: 'chica' } })
    expect(w.get('svg').classes()).toContain('lucide-package')
  })

  it('si la foto no carga (archivo dañado), muestra el ícono en su lugar', async () => {
    const w = mount(FotoDeProducto, {
      props: { imagen: 'blob:ya-no-existe', nombre: 'Lejía', tamano: 'chica' },
    })
    await w.get('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.get('.foto-de-producto').attributes('aria-label')).toBe('Lejía')
    // Una foto nueva vuelve a intentarse.
    await w.setProps({ imagen: 'https://ejemplo.pe/otra.jpg' })
    expect(w.get('img').attributes('src')).toBe('https://ejemplo.pe/otra.jpg')
  })

  it('decorativa (dentro de un botón que ya dice el nombre): no repite el nombre', () => {
    const conFoto = mount(FotoDeProducto, {
      props: {
        imagen: 'https://ejemplo.pe/a.jpg',
        nombre: 'Lejía',
        tamano: 'chica',
        decorativa: true,
      },
    })
    expect(conFoto.get('img').attributes('alt')).toBe('')
    const sinFoto = mount(FotoDeProducto, {
      props: { nombre: 'Lejía', tamano: 'chica', decorativa: true },
    })
    const contenedor = sinFoto.get('.foto-de-producto')
    expect(contenedor.attributes('role')).toBeUndefined()
    expect(contenedor.attributes('aria-label')).toBeUndefined()
    expect(contenedor.attributes('aria-hidden')).toBe('true')
  })

  it('marca el tamaño pedido (la proporción cuadrada la da el CSS)', () => {
    const w = mount(FotoDeProducto, { props: { nombre: 'Lejía', tamano: 'grande' } })
    expect(w.get('.foto-de-producto').classes()).toContain('foto-de-producto--grande')
  })

  it('no falla si el navegador no puede crear la URL (la foto queda como ícono)', () => {
    vi.mocked(urls.crear).mockImplementationOnce(() => {
      throw new Error('sin memoria')
    })
    const w = mount(FotoDeProducto, {
      props: { imagen: new Blob(['x']), nombre: 'Lejía', tamano: 'chica' },
    })
    expect(w.find('img').exists()).toBe(false)
    expect(w.get('.foto-de-producto').attributes('aria-label')).toBe('Lejía')
  })
})

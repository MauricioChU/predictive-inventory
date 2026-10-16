import { beforeEach, describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { Carrito, type ProductoEnCarrito } from './carrito'

const soles = (texto: string) => Dinero.deTexto(texto)
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')
const unidades = (n: number) => Cantidad.deEntero(n)

const LEJIA: ProductoEnCarrito = {
  id: 'lejia',
  nombre: 'Lejía 1 L',
  unidad: 'UNIDAD',
  precioVenta: soles('3.50'),
}
const CARBON: ProductoEnCarrito = {
  id: 'carbon',
  nombre: 'Carbón',
  unidad: 'KILO',
  precioVenta: soles('4.00'),
}
const DETERGENTE: ProductoEnCarrito = {
  id: 'detergente',
  nombre: 'Detergente a granel',
  unidad: 'KILO',
  precioVenta: soles('7.90'),
}

describe('Carrito', () => {
  let carrito: Carrito

  beforeEach(() => {
    carrito = new Carrito()
  })

  it('RN-OP-07: agregar 1 y luego 2 del mismo producto deja una sola línea de 3', () => {
    carrito.agregar(LEJIA, unidades(1))
    carrito.agregar(LEJIA, unidades(2))
    expect(carrito.lineas).toHaveLength(1)
    expect(carrito.lineas[0]?.cantidad).toEqual(unidades(3))
    expect(carrito.lineas[0]?.importe).toEqual(soles('10.50'))
  })

  it('RN-OP-12: el total de la venta de tres líneas es S/ 14.63', () => {
    carrito.agregar(LEJIA, unidades(2))
    carrito.agregar(CARBON, kilos('1.25'))
    carrito.agregar(DETERGENTE, kilos('0.333'))
    expect(carrito.lineas.map((l) => l.importe.centimos)).toEqual([700, 500, 263])
    expect(carrito.total()).toEqual(soles('14.63'))
  })

  it('un carrito vacío suma S/ 0.00', () => {
    expect(carrito.lineas).toEqual([])
    expect(carrito.total()).toEqual(Dinero.cero())
  })

  it('RN-OP-11: cambiar el precio afecta solo a esa línea y no al producto', () => {
    carrito.agregar(LEJIA, unidades(2))
    carrito.agregar(CARBON, kilos('1'))
    carrito.cambiarPrecio('lejia', soles('3.00'))
    expect(carrito.lineas.map((l) => [l.precio.centimos, l.importe.centimos])).toEqual([
      [300, 600],
      [400, 400],
    ])
    expect(carrito.lineas[0]?.producto.precioVenta).toEqual(soles('3.50'))
    expect(LEJIA.precioVenta).toEqual(soles('3.50'))
  })

  it('RN-OP-11: el precio null vuelve al precio normal', () => {
    carrito.agregar(LEJIA, unidades(2))
    carrito.cambiarPrecio('lejia', soles('3.00'))
    carrito.cambiarPrecio('lejia', null)
    expect(carrito.lineas[0]?.precio).toEqual(soles('3.50'))
  })

  it('RN-OP-11: el precio especial debe ser mayor que S/ 0.00', () => {
    carrito.agregar(LEJIA, unidades(2))
    expect(() => carrito.cambiarPrecio('lejia', Dinero.cero())).toThrow(
      'El precio de venta debe ser mayor que S/ 0.00',
    )
    expect(carrito.lineas[0]?.precio).toEqual(soles('3.50'))
  })

  it('cambiar la cantidad reemplaza la de la línea', () => {
    carrito.agregar(CARBON, kilos('1'))
    carrito.cambiarCantidad('carbon', kilos('2.5'))
    expect(carrito.lineas[0]?.cantidad).toEqual(kilos('2.5'))
    expect(carrito.total()).toEqual(soles('10.00'))
  })

  it('RN-OP-03: la cantidad de una línea es mayor que 0 y no pasa de 99 999', () => {
    carrito.agregar(LEJIA, unidades(99_998))
    expect(() => carrito.agregar(LEJIA, unidades(2))).toThrow(
      'La cantidad no puede pasar de 99 999',
    )
    expect(() => carrito.cambiarCantidad('lejia', Cantidad.cero())).toThrow(
      'La cantidad debe ser mayor que 0',
    )
    expect(() => carrito.agregar(CARBON, Cantidad.cero())).toThrow(
      'La cantidad debe ser mayor que 0',
    )
    expect(carrito.lineas).toHaveLength(1)
    expect(carrito.lineas[0]?.cantidad).toEqual(unidades(99_998))
  })

  it('RN-OP-04: un producto por unidades no acepta fracciones', () => {
    expect(() => carrito.agregar(LEJIA, kilos('1.5'))).toThrow(
      'Este producto se cuenta por unidades enteras',
    )
  })

  it('cambiar o quitar un producto que no está en el carrito no hace nada', () => {
    carrito.agregar(LEJIA, unidades(1))
    carrito.cambiarCantidad('carbon', kilos('1'))
    carrito.cambiarPrecio('carbon', soles('1.00'))
    carrito.quitar('carbon')
    expect(carrito.lineas).toHaveLength(1)
  })

  it('quitar y vaciar', () => {
    carrito.agregar(LEJIA, unidades(1))
    carrito.agregar(CARBON, kilos('1'))
    carrito.quitar('lejia')
    expect(carrito.lineas.map((l) => l.producto.id)).toEqual(['carbon'])
    carrito.vaciar()
    expect(carrito.lineas).toEqual([])
  })

  it('las líneas devueltas no modifican el carrito', () => {
    carrito.agregar(LEJIA, unidades(1))
    const lineas = carrito.lineas as unknown as unknown[]
    expect(() => {
      lineas.pop()
    }).toThrow()
    expect(carrito.lineas).toHaveLength(1)
  })

  it('RN-OP-11: aDatosDeVenta incluye precioEspecial solo si cambió', () => {
    carrito.agregar(LEJIA, unidades(2))
    carrito.agregar(CARBON, kilos('1.25'))
    carrito.agregar(DETERGENTE, kilos('0.333'))
    carrito.cambiarPrecio('carbon', soles('3.75'))
    carrito.cambiarPrecio('detergente', soles('7.90'))
    expect(carrito.aDatosDeVenta()).toEqual({
      lineas: [
        { productoId: 'lejia', cantidad: '2' },
        { productoId: 'carbon', cantidad: '1.25', precioEspecial: '3.75' },
        { productoId: 'detergente', cantidad: '0.333' },
      ],
    })
  })

  it('aDatosDeVenta escribe precios de más de mil soles sin separador de miles', () => {
    carrito.agregar(LEJIA, unidades(1))
    carrito.cambiarPrecio('lejia', soles('1250.05'))
    expect(carrito.aDatosDeVenta().lineas[0]?.precioEspecial).toBe('1250.05')
  })
})

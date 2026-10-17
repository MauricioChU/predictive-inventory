import { describe, expect, it } from 'vitest'
import type { ProductoVista } from '@/modules/catalogo'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { usarCarrito } from './carrito-de-pantalla'

function producto(id: string, nombre: string, extra: Partial<ProductoVista> = {}): ProductoVista {
  return {
    id,
    nombre,
    categoriaId: 'otros',
    categoriaNombre: 'Otros',
    unidad: 'UNIDAD',
    precioCompra: Dinero.deTexto('2.40'),
    precioVenta: Dinero.deTexto('3.50'),
    gananciaPorUnidad: Dinero.deTexto('1.10'),
    stockMinimo: Cantidad.deEntero(3),
    stock: Cantidad.deEntero(10),
    activo: true,
    tieneFoto: false,
    ...extra,
  }
}

const LEJIA = producto('lejia', 'Lejía 1 L')
const CARBON = producto('carbon', 'Carbón')

describe('carrito de pantalla', () => {
  it('r2 #4: agregarFaltantes no repite un producto que ya estaba ni uno repetido en la lista', () => {
    const carrito = usarCarrito('ingreso')
    carrito.agregar(LEJIA)
    const agregados = carrito.agregarFaltantes([
      { producto: LEJIA, cantidad: Cantidad.deEntero(5), precio: LEJIA.precioCompra },
      { producto: CARBON, cantidad: Cantidad.deEntero(2), precio: CARBON.precioCompra },
      { producto: CARBON, cantidad: Cantidad.deEntero(7), precio: CARBON.precioCompra },
    ])
    expect(agregados).toBe(1)
    expect(carrito.lineas.value.map((l) => [l.producto.id, l.cantidad])).toEqual([
      ['lejia', '1'],
      ['carbon', '2'],
    ])
  })

  it('r2 #1: refrescar pone al día stock y precio base; deja el precio especial; quita lo que ya no está', () => {
    const carrito = usarCarrito('venta')
    carrito.agregar(LEJIA)
    carrito.agregar(CARBON)
    carrito.agregar(producto('escoba', 'Escoba'))
    carrito.cambiarPrecio('carbon', '3.00')
    const quitados = carrito.refrescar(
      new Map([
        [
          'lejia',
          producto('lejia', 'Lejía 1 L', {
            precioVenta: Dinero.deTexto('5.00'),
            stock: Cantidad.deEntero(1),
          }),
        ],
        ['carbon', producto('carbon', 'Carbón', { precioVenta: Dinero.deTexto('6.00') })],
        ['escoba', producto('escoba', 'Escoba', { activo: false })],
      ]),
    )
    expect(quitados).toEqual(['Escoba'])
    const [lejia, carbon] = carrito.lineas.value
    expect(lejia?.precio.centimos).toBe(500)
    expect(lejia?.producto.stock.milesimas).toBe(1000)
    expect(carbon?.precio.centimos).toBe(300)
    expect(carbon?.precioCambiado).toBe(true)
    expect(carrito.lineas.value).toHaveLength(2)
  })

  it('r2 #1: un producto que ya no existe también sale', () => {
    const carrito = usarCarrito('venta')
    carrito.agregar(LEJIA)
    expect(carrito.refrescar(new Map([['lejia', null]]))).toEqual(['Lejía 1 L'])
    expect(carrito.vacio.value).toBe(true)
  })

  it('r2 #1: aDatosDeVenta manda el precio que se vio si difiere del precio actual del producto', () => {
    const carrito = usarCarrito('venta')
    carrito.agregar(LEJIA)
    expect(carrito.aDatosDeVenta(new Map([['lejia', Dinero.deTexto('5.00')]])).lineas).toEqual([
      { productoId: 'lejia', cantidad: '1', precioEspecial: 'S/ 3.50' },
    ])
    expect(carrito.aDatosDeVenta(new Map([['lejia', Dinero.deTexto('3.50')]])).lineas).toEqual([
      { productoId: 'lejia', cantidad: '1' },
    ])
  })
})

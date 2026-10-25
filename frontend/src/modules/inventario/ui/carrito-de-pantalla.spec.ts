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
  it('RN-OP-22: al vender, cada línea dice cuánto queda tras la venta y se actualiza al cambiar la cantidad', () => {
    const carrito = usarCarrito('venta')
    const id = carrito.agregar(LEJIA)
    expect(carrito.lineas.value[0]!.quedan).toBe('Quedan 9 unid.')
    carrito.cambiarCantidad(id, '3')
    expect(carrito.lineas.value[0]!.quedan).toBe('Quedan 7 unid.')
    carrito.cambiarCantidad(id, '10')
    expect(carrito.lineas.value[0]!.quedan).toBe('Se acaba')
  })

  it('RN-OP-22 / RN-OP-05: sin cantidad válida o pasando el stock no hay "quedan" y sigue el error', () => {
    const carrito = usarCarrito('venta')
    const id = carrito.agregar(LEJIA)
    // RN-OP-05: lo escrito de más se corrige a lo que hay.
    carrito.cambiarCantidad(id, '11')
    expect(carrito.lineas.value[0]!.cantidad).toBe('10')
    // Si el stock bajó por otro lado (al volver a la pantalla), sigue el error.
    carrito.refrescar(
      new Map([['lejia', producto('lejia', 'Lejía 1 L', { stock: Cantidad.deEntero(4) })]]),
    )
    expect(carrito.lineas.value[0]!.quedan).toBeUndefined()
    expect(carrito.lineas.value[0]!.errorCantidad).toContain('Solo quedan 4 unid. de Lejía 1 L')
    carrito.cambiarCantidad(id, '')
    expect(carrito.lineas.value[0]!.quedan).toBeUndefined()
  })

  it('RN-OP-22: Llegó mercadería no muestra "quedan"', () => {
    const carrito = usarCarrito('ingreso')
    carrito.agregar(LEJIA)
    expect(carrito.lineas.value[0]!.quedan).toBeUndefined()
  })

  it('Llegó mercadería: tocar otra vez un producto con el costo cambiado suma a su línea', () => {
    const carrito = usarCarrito('ingreso')
    const id = carrito.agregar(LEJIA)
    carrito.cambiarPrecio(id, '2.10')
    expect(carrito.agregar(LEJIA)).toBe(id)
    expect(carrito.lineas.value.map((l) => [l.cantidad, l.precio.centimos])).toEqual([['2', 210]])
  })

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
    const idCarbon = carrito.agregar(CARBON)
    carrito.agregar(producto('escoba', 'Escoba'))
    carrito.cambiarPrecio(idCarbon, '3.00')
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

  describe('RN-OP-11: el lápiz cambia el precio del producto', () => {
    const NUEVO = producto('lejia', 'Lejía 1 L', { precioVenta: Dinero.deTexto('4.00') })

    it('la línea tocada y las del precio de siempre toman el precio nuevo; un especial se queda', () => {
      const carrito = usarCarrito('venta')
      const normal = carrito.agregar(LEJIA)
      carrito.cambiarCantidad(normal, '3')
      carrito.cambiarPrecio(normal, '3.00', '1') // 2 a 3.50 y 1 a 3.00 (especial)
      carrito.aplicarPrecioDelProducto(normal, NUEVO, LEJIA.precioVenta)
      const precios = carrito.lineas.value.map((l) => [l.precio.centimos, l.precioCambiado])
      expect(precios).toEqual([
        [400, false],
        [300, true],
      ])
    })

    it('si la línea tocada se quitó mientras se guardaba, las demás del producto igual se ponen al día', () => {
      const carrito = usarCarrito('venta')
      const normal = carrito.agregar(LEJIA)
      carrito.cambiarCantidad(normal, '3')
      carrito.cambiarPrecio(normal, '3.00', '1')
      const [, especial] = carrito.lineas.value
      carrito.quitar(especial!.id)
      carrito.aplicarPrecioDelProducto(especial!.id, NUEVO, LEJIA.precioVenta)
      const [unica] = carrito.lineas.value
      expect(carrito.lineas.value).toHaveLength(1)
      expect(unica!.precio.centimos).toBe(400)
      expect(unica!.producto.precioVenta.centimos).toBe(400)
      expect(unica!.precioCambiado).toBe(false)
    })
  })

  describe('RN-OP-11: precio distinto para parte de las unidades', () => {
    function conCinco() {
      const carrito = usarCarrito('venta')
      const id = carrito.agregar(LEJIA)
      carrito.cambiarCantidad(id, '5')
      return { carrito, id }
    }
    const resumen = (carrito: ReturnType<typeof usarCarrito>) =>
      carrito.lineas.value.map((l) => [l.cantidad, l.precio.centimos, l.precioCambiado])

    it('separa esas unidades en otra línea con el precio nuevo; el total suma ambas', () => {
      const { carrito, id } = conCinco()
      carrito.cambiarPrecio(id, '3.00', '1')
      expect(resumen(carrito)).toEqual([
        ['4', 350, false],
        ['1', 300, true],
      ])
      expect(carrito.total.value.centimos).toBe(4 * 350 + 300)
      expect(carrito.aDatosDeVenta().lineas).toEqual([
        { productoId: 'lejia', cantidad: '4' },
        { productoId: 'lejia', cantidad: '1', precioEspecial: 'S/ 3.00' },
      ])
    })

    it('con todas las unidades cambia el precio de la línea, sin separar', () => {
      const { carrito, id } = conCinco()
      carrito.cambiarPrecio(id, '3.00', '5')
      expect(resumen(carrito)).toEqual([['5', 300, true]])
    })

    it('"quedan" y el stock (RN-OP-05) cuentan las dos líneas del producto', () => {
      const { carrito, id } = conCinco()
      carrito.cambiarPrecio(id, '3.00', '2')
      expect(carrito.lineas.value.map((l) => l.quedan)).toEqual([
        'Quedan 5 unid.',
        'Quedan 5 unid.',
      ])
      // La otra línea lleva 2: esta llega como mucho a 8.
      carrito.cambiarCantidad(id, '9')
      expect(carrito.lineas.value[0]!.cantidad).toBe('8')
      expect(carrito.lineas.value.every((l) => l.errorCantidad === undefined)).toBe(true)
    })

    it('volver una parte al precio de siempre la junta otra vez con su línea', () => {
      const { carrito, id } = conCinco()
      carrito.cambiarPrecio(id, '3.00', '1')
      const especial = carrito.lineas.value[1]!.id
      carrito.cambiarPrecio(especial, '3.50')
      expect(resumen(carrito)).toEqual([['5', 350, false]])
    })

    it('tocar el producto otra vez suma a la línea con el precio de siempre', () => {
      const { carrito, id } = conCinco()
      carrito.cambiarPrecio(id, '3.00', '5')
      carrito.agregar(LEJIA)
      expect(resumen(carrito)).toEqual([
        ['5', 300, true],
        ['1', 350, false],
      ])
    })

    it('cuántas debe ser de 1 a las que hay en la línea', () => {
      const { carrito, id } = conCinco()
      carrito.cambiarPrecio(id, '3.00', '6')
      expect(carrito.lineas.value[0]!.errorUnidades).toBe('Son 5 en total: escribe de 1 a 5')
      carrito.cambiarPrecio(id, '3.00', '0')
      expect(carrito.lineas.value[0]!.errorUnidades).toBe('Son 5 en total: escribe de 1 a 5')
      expect(resumen(carrito)).toEqual([['5', 350, false]])
      carrito.cancelarPrecio(id)
      expect(carrito.lineas.value[0]!.errorUnidades).toBeUndefined()
    })
  })
})

import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { Producto } from './producto'

const AHORA = '2026-10-15T15:00:00.000Z'
const LUEGO = '2026-10-15T16:00:00.000Z'

function crear(datos: Partial<Parameters<typeof Producto.crear>[0]> = {}) {
  return Producto.crear({
    id: 'p1',
    nombre: 'Lejía 1 L',
    categoriaId: 'c1',
    unidad: 'UNIDAD',
    precioCompra: Dinero.deTexto('2.40'),
    precioVenta: Dinero.deTexto('3.50'),
    stockMinimo: Cantidad.deEntero(3),
    ahora: AHORA,
    ...datos,
  })
}

describe('Producto.crear', () => {
  it('nace activo, sin foto y con creadoEn = actualizadoEn = ahora', () => {
    const producto = crear()
    expect(producto.activo).toBe(true)
    expect(producto.tieneFoto).toBe(false)
    expect(producto.id).toBe('p1')
    expect(producto.nombre).toBe('Lejía 1 L')
    expect(producto.categoriaId).toBe('c1')
    expect(producto.unidad).toBe('UNIDAD')
  })
  it('nombreNormalizado usa normalizar() (sin tildes, minúsculas, un solo espacio)', () => {
    const producto = crear({ nombre: 'LEJÍA   1 L' })
    expect(producto.nombreNormalizado).toBe('lejia 1 l')
  })
})

describe('Producto: ida y vuelta aRegistro / desdeRegistro', () => {
  it('conserva todos los campos', () => {
    const producto = crear()
    const registro = producto.aRegistro()
    expect(registro).toEqual({
      id: 'p1',
      nombre: 'Lejía 1 L',
      nombreNormalizado: 'lejia 1 l',
      categoriaId: 'c1',
      unidad: 'UNIDAD',
      precioCompra: 240,
      precioVenta: 350,
      stockMinimo: 3000,
      tieneFoto: false,
      estado: 'ACTIVO',
      creadoEn: AHORA,
      actualizadoEn: AHORA,
    })
    const restaurado = Producto.desdeRegistro(registro)
    expect(restaurado.aRegistro()).toEqual(registro)
    expect(restaurado.precioCompra.igualA(producto.precioCompra)).toBe(true)
    expect(restaurado.precioVenta.igualA(producto.precioVenta)).toBe(true)
    expect(restaurado.stockMinimo.igualA(producto.stockMinimo)).toBe(true)
  })
})

describe('Producto: renombrar, cambiarCategoria, cambiarPrecios, cambiarStockMinimo', () => {
  it('actualizan el campo y actualizadoEn', () => {
    const producto = crear()
    producto.renombrar('Lejía Tradicional 1 L', LUEGO)
    expect(producto.nombre).toBe('Lejía Tradicional 1 L')
    expect(producto.aRegistro().actualizadoEn).toBe(LUEGO)
  })
  it('cambiarCategoria actualiza categoriaId', () => {
    const producto = crear()
    producto.cambiarCategoria('c2', LUEGO)
    expect(producto.categoriaId).toBe('c2')
  })
  it('cambiarPrecios actualiza compra y venta (RN-CAT-09: no reescribe operaciones pasadas, solo el estado actual)', () => {
    const producto = crear()
    producto.cambiarPrecios(Dinero.deTexto('2.80'), Dinero.deTexto('4.00'), LUEGO)
    expect(producto.precioCompra.igualA(Dinero.deTexto('2.80'))).toBe(true)
    expect(producto.precioVenta.igualA(Dinero.deTexto('4.00'))).toBe(true)
  })
  it('cambiarStockMinimo actualiza el mínimo', () => {
    const producto = crear()
    producto.cambiarStockMinimo(Cantidad.deEntero(5), LUEGO)
    expect(producto.stockMinimo.igualA(Cantidad.deEntero(5))).toBe(true)
  })
})

describe('Producto.cambiarUnidad (RN-CAT-03)', () => {
  it('cambia la unidad si el producto no tiene operaciones', () => {
    const producto = crear({ unidad: 'UNIDAD' })
    producto.cambiarUnidad('KILO', false, LUEGO)
    expect(producto.unidad).toBe('KILO')
  })
  it('rechaza el cambio si el producto ya tiene operaciones', () => {
    const producto = crear({ unidad: 'KILO' })
    expect(() => producto.cambiarUnidad('UNIDAD', true, LUEGO)).toThrowError(
      'No puedes cambiar la unidad de un producto que ya tiene movimientos',
    )
    expect(producto.unidad).toBe('KILO')
  })
  it('el error es un ErrorDeDominio', () => {
    const producto = crear()
    let error: unknown
    try {
      producto.cambiarUnidad('KILO', true, LUEGO)
    } catch (e) {
      error = e
    }
    expect(esErrorDeDominio(error)).toBe(true)
  })
})

describe('Producto.archivar / reactivar', () => {
  it('archivar desactiva el producto', () => {
    const producto = crear()
    producto.archivar(LUEGO)
    expect(producto.activo).toBe(false)
    expect(producto.aRegistro().estado).toBe('ARCHIVADO')
  })
  it('reactivar lo vuelve a activar', () => {
    const producto = crear()
    producto.archivar(LUEGO)
    producto.reactivar(LUEGO)
    expect(producto.activo).toBe(true)
  })
})

describe('Producto.marcarFoto', () => {
  it('cambia tieneFoto', () => {
    const producto = crear()
    producto.marcarFoto(true, LUEGO)
    expect(producto.tieneFoto).toBe(true)
    producto.marcarFoto(false, LUEGO)
    expect(producto.tieneFoto).toBe(false)
  })
})

describe('Producto.perdidaPorUnidad (RN-CAT-05)', () => {
  it('es null si el precio de venta es mayor que el de compra (hay ganancia)', () => {
    const producto = crear({
      precioCompra: Dinero.deTexto('2.40'),
      precioVenta: Dinero.deTexto('3.50'),
    })
    expect(producto.perdidaPorUnidad()).toBeNull()
  })
  it('es la diferencia si la venta es menor que la compra', () => {
    const producto = crear({
      precioCompra: Dinero.deTexto('5.00'),
      precioVenta: Dinero.deTexto('4.50'),
    })
    expect(producto.perdidaPorUnidad()?.igualA(Dinero.deTexto('0.50'))).toBe(true)
  })
  it('es S/ 0.00 si la venta es igual a la compra (no gana nada)', () => {
    const producto = crear({
      precioCompra: Dinero.deTexto('5.00'),
      precioVenta: Dinero.deTexto('5.00'),
    })
    expect(producto.perdidaPorUnidad()?.esCero()).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { Cantidad } from '../../../../shared/domain/cantidad'
import { Dinero } from '../../../../shared/domain/dinero'
import { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import { CatalogoDePrueba, InventarioDePrueba, TiendaDePrueba } from './dobles'

describe('dobles de prueba', () => {
  it('catálogo: producto, productos(soloActivos), precio y categorías', async () => {
    const c = new CatalogoDePrueba()
    const cat = c.agregarCategoria('Otros')
    const a = c.agregarProducto({ nombre: 'A', categoriaId: cat, categoriaNombre: 'Otros' })
    c.agregarProducto({ nombre: 'B', categoriaId: cat, categoriaNombre: 'Otros', activo: false })
    expect((await c.producto(a))?.nombre).toBe('A')
    expect(await c.producto('nada')).toBeNull()
    expect(await c.productos()).toHaveLength(2)
    expect(await c.productos({ soloActivos: true })).toHaveLength(1)
    await c.actualizarPrecioCompra(a, Dinero.deTexto('1.50'))
    await c.actualizarPrecioCompra('nada', Dinero.cero())
    expect((await c.producto(a))?.precioCompra.centimos).toBe(150)
    expect(await c.importacion.categoriaPorNombre('otros')).toBe(cat)
    expect(await c.importacion.categoriaPorNombre('zzz')).toBeNull()
    const err = await c.importacion.validarNuevo({
      nombre: 'X',
      categoriaId: cat,
      unidad: 'UNIDAD',
      precioCompra: '1',
      precioVenta: '2',
      stockMinimo: '1',
    })
    expect(err).toBeNull()
  })

  it('inventario: stock, existencias y operaciones', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.guardar('existencias', { productoId: 'p', cantidad: 2000 })
    almacen.guardar('operaciones', {
      id: 'o',
      tipo: 'INGRESO',
      movimientos: [],
      productoIds: ['p'],
      ocurridaEn: '2026-10-15T00:00:00.000Z',
      registradaEn: '2026-10-15T00:00:00.000Z',
      motivo: null,
      nota: null,
      anulaA: null,
      dispositivoId: 'd',
    })
    const i = new InventarioDePrueba(almacen)
    expect((await i.stockDe('p')).igualA(Cantidad.deEntero(2))).toBe(true)
    expect((await i.stockDe('q')).esCero()).toBe(true)
    expect((await i.existencias()).size).toBe(1)
    expect(await i.tieneOperaciones('p')).toBe(true)
    expect(await i.tieneOperaciones('q')).toBe(false)
    expect(await i.ultimoIngresoDe()).toBeNull()
    expect(await i.operaciones()).toHaveLength(1)
  })

  it('tienda: fija configuración', async () => {
    const t = new TiendaDePrueba()
    t.fijarConfiguracion({ nombreTienda: 'X' })
    expect((await t.configuracion()).nombreTienda).toBe('X')
  })
})

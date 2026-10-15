import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { Carrito } from '../domain/carrito'
import { Operacion } from '../domain/operacion'
import { crearEscenario, productoResumido } from '../__pruebas__/escenario'
import { resultadoDeAsync } from '../__pruebas__/resultado'

const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))
const unidades = (n: number) => Cantidad.deEntero(n)
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')
const soles = (texto: string) => Dinero.deTexto(texto)

describe('registrarVenta', () => {
  it('RN-OP-01: el stock es la suma de las operaciones registradas', async () => {
    const { modulo, stock, tipos, operaciones } = await escenario()
    await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '3' }] })
    await modulo.registrarIngreso({
      lineas: [{ productoId: 'lejia', cantidad: '6', costo: '2.40' }],
    })
    expect(await stock('lejia')).toEqual(unidades(13))
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL', 'VENTA', 'INGRESO'])
    const suma = (await operaciones.porProducto('lejia'))
      .flatMap((r) => r.movimientos)
      .filter((m) => m.productoId === 'lejia')
      .reduce((total, m) => total + m.cantidad, 0)
    expect((await stock('lejia')).milesimas).toBe(suma)
  })

  it.each([
    ['1', 'registrada'],
    ['0', 'error: La cantidad debe ser mayor que 0'],
    ['-2', 'error: La cantidad debe ser mayor que 0'],
    ['100000', 'error: La cantidad no puede pasar de 99 999'],
  ])('RN-OP-03: vender "%s" de Carbón → %s', async (cantidad, resultado) => {
    const { modulo } = await escenario()
    const venta = () => modulo.registrarVenta({ lineas: [{ productoId: 'carbon', cantidad }] })
    expect(await resultadoDeAsync(venta)).toBe(resultado)
  })

  it.each([
    ['lejia', '2', 'registrada'],
    ['lejia', '1.5', 'error: Este producto se cuenta por unidades enteras'],
    ['carbon', '1.25', 'registrada'],
    ['carbon', '0.125', 'registrada'],
    ['carbon', '0.0005', 'error: Usa como máximo tres decimales'],
  ])('RN-OP-04: vender %s "%s" → %s', async (productoId, cantidad, resultado) => {
    const { modulo } = await escenario()
    const venta = () => modulo.registrarVenta({ lineas: [{ productoId, cantidad }] })
    expect(await resultadoDeAsync(venta)).toBe(resultado)
  })

  it('RN-OP-05: no se puede vender más de lo que hay', async () => {
    const { modulo, stock, tipos } = await escenario()
    await expect(
      modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '11' }] }),
    ).rejects.toThrow('Solo quedan 10 unid. de Lejía 1 L')
    expect(await stock('lejia')).toEqual(unidades(10))
    expect(await tipos('lejia')).toEqual(['STOCK_INICIAL'])
  })

  it('RN-OP-05 / RN-OP-06: si una línea no alcanza, no se registra ninguna', async () => {
    const { modulo, stock, eventos, operaciones } = await escenario()
    await expect(
      modulo.registrarVenta({
        lineas: [
          { productoId: 'lejia', cantidad: '2' },
          { productoId: 'carbon', cantidad: '20' },
        ],
      }),
    ).rejects.toThrow('Solo quedan 10 kg de Carbón')
    expect(await stock('lejia')).toEqual(unidades(10))
    expect(await stock('carbon')).toEqual(unidades(10))
    expect(await operaciones.todas()).toHaveLength(3)
    expect(eventos).toEqual([])
  })

  it('RN-OP-07: el mismo producto en dos líneas se vende en una sola línea con la suma', async () => {
    const { modulo, operaciones, stock } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [
        { productoId: 'lejia', cantidad: '1' },
        { productoId: 'carbon', cantidad: '1' },
        { productoId: 'lejia', cantidad: '2' },
      ],
    })
    const registro = await operaciones.porId(operacionId)
    expect(registro?.movimientos.map((m) => [m.productoId, m.cantidad])).toEqual([
      ['lejia', -3000],
      ['carbon', -1000],
    ])
    expect(await stock('lejia')).toEqual(unidades(7))
  })

  it('RN-OP-07 / RN-OP-05: las líneas repetidas se suman antes de validar el stock', async () => {
    const { modulo } = await escenario()
    await expect(
      modulo.registrarVenta({
        lineas: [
          { productoId: 'lejia', cantidad: '6' },
          { productoId: 'lejia', cantidad: '6' },
        ],
      }),
    ).rejects.toThrow('Solo quedan 10 unid. de Lejía 1 L')
  })

  it('RN-OP-08: no se vende un producto archivado ni uno que no existe', async () => {
    const { modulo, catalogo } = await escenario()
    catalogo.archivar('lejia')
    await expect(
      modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '1' }] }),
    ).rejects.toThrow('Lejía 1 L está archivado. Reactívalo para usarlo')
    await expect(
      modulo.registrarVenta({ lineas: [{ productoId: 'nada', cantidad: '1' }] }),
    ).rejects.toThrow('No encontramos ese producto')
  })

  it.each([
    ['2026-10-15 09:00', 'registrada'],
    ['2026-10-14 18:30', 'registrada'],
    ['2026-10-08 10:00', 'registrada'],
    ['2026-10-07 23:59', 'error: Solo puedes anotar hasta 7 días atrás'],
    ['2026-10-16 08:00', 'error: La fecha no puede ser futura'],
  ])('RN-OP-09: vender 1 Lejía con fecha %s → %s', async (fecha, resultado) => {
    const { modulo } = await escenario()
    const venta = () =>
      modulo.registrarVenta({
        lineas: [{ productoId: 'lejia', cantidad: '1' }],
        ocurridaEn: instanteLocal(fecha),
      })
    expect(await resultadoDeAsync(venta)).toBe(resultado)
  })

  it('RN-OP-09: una venta de ayer guarda cuándo ocurrió y cuándo se anotó; por defecto, ahora', async () => {
    const { modulo, operaciones } = await escenario()
    const ayer = instanteLocal('2026-10-14 18:30')
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '1' }],
      ocurridaEn: ayer,
    })
    const deAyer = await operaciones.porId(operacionId)
    expect([deAyer?.ocurridaEn, deAyer?.registradaEn]).toEqual([
      ayer,
      instanteLocal('2026-10-15 10:00'),
    ])
    const deHoy = await operaciones.porId(
      (await modulo.registrarVenta({ lineas: [{ productoId: 'lejia', cantidad: '1' }] }))
        .operacionId,
    )
    expect(deHoy?.ocurridaEn).toBe(instanteLocal('2026-10-15 10:00'))
  })

  it('RN-OP-10 / RN-OP-12: la venta guarda precio y costo, y calcula total y ganancia por línea', async () => {
    const { modulo, operaciones } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [
        { productoId: 'lejia', cantidad: '2' },
        { productoId: 'carbon', cantidad: '1.25' },
        { productoId: 'detergente', cantidad: '0.333' },
      ],
    })
    const registro = await operaciones.porId(operacionId)
    expect(registro?.dispositivoId).toBe('disp-1')
    const venta = Operacion.desdeRegistro(registro!)
    expect(
      venta.lineas().map((l) => ({
        producto: l.productoId,
        precio: l.precioUnitario?.centimos,
        costo: l.costoUnitario.centimos,
        importe: l.importe?.centimos,
        ganancia: l.ganancia?.centimos,
      })),
    ).toEqual([
      { producto: 'lejia', precio: 350, costo: 240, importe: 700, ganancia: 220 },
      { producto: 'carbon', precio: 400, costo: 275, importe: 500, ganancia: 156 },
      { producto: 'detergente', precio: 790, costo: 530, importe: 263, ganancia: 87 },
    ])
    expect(venta.total()).toEqual(soles('14.63'))
    expect(venta.ganancia()).toEqual(soles('4.63'))
  })

  it('RN-OP-11: cambiar el precio solo para una venta', async () => {
    const { modulo, operaciones, catalogo } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '2', precioEspecial: '3.00' }],
    })
    const venta = Operacion.desdeRegistro((await operaciones.porId(operacionId))!)
    expect(venta.total()).toEqual(soles('6.00'))
    expect(venta.ganancia()).toEqual(soles('1.20'))
    expect((await catalogo.producto('lejia'))?.precioVenta).toEqual(soles('3.50'))
  })

  it('RN-OP-11: el precio especial debe ser mayor que cero', async () => {
    const { modulo, stock } = await escenario()
    await expect(
      modulo.registrarVenta({
        lineas: [{ productoId: 'lejia', cantidad: '2', precioEspecial: '0.00' }],
      }),
    ).rejects.toThrow('El precio de venta debe ser mayor que S/ 0.00')
    expect(await stock('lejia')).toEqual(unidades(10))
  })

  it('RN-OP-10: el costo es el precio de compra vigente al vender (ADR-0004)', async () => {
    const { modulo, operaciones, catalogo } = await escenario()
    await catalogo.actualizarPrecioCompra('lejia', soles('2.80'))
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '1' }],
    })
    expect((await operaciones.porId(operacionId))?.movimientos[0]?.costoUnitario).toBe(280)
  })

  it('la nota de la venta se guarda recortada', async () => {
    const { modulo, operaciones } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [{ productoId: 'lejia', cantidad: '1' }],
      nota: '  Pagó con Yape ',
    })
    expect((await operaciones.porId(operacionId))?.nota).toBe('Pagó con Yape')
  })

  it('RN-OP-13: lo que arma el carrito se registra tal cual', async () => {
    const { modulo, catalogo, stock, operaciones } = await escenario()
    const carrito = new Carrito()
    const enCarrito = async (id: string) => {
      const producto = (await catalogo.producto(id))!
      return { ...producto, precioVenta: producto.precioVenta }
    }
    carrito.agregar(await enCarrito('lejia'), unidades(1))
    carrito.agregar(await enCarrito('carbon'), kilos('1.25'))
    carrito.agregar(await enCarrito('lejia'), unidades(1))
    carrito.cambiarPrecio('carbon', soles('3.60'))
    const { operacionId } = await modulo.registrarVenta(carrito.aDatosDeVenta())
    const venta = Operacion.desdeRegistro((await operaciones.porId(operacionId))!)
    expect(venta.total()).toEqual(carrito.total())
    expect(venta.total()).toEqual(soles('11.50'))
    expect(await stock('lejia')).toEqual(unidades(8))
    expect(await stock('carbon')).toEqual(kilos('8.75'))
  })

  it('publica OperacionRegistrada con los productos de la venta', async () => {
    const { modulo, eventos } = await escenario()
    const { operacionId } = await modulo.registrarVenta({
      lineas: [
        { productoId: 'lejia', cantidad: '1' },
        { productoId: 'carbon', cantidad: '1' },
      ],
    })
    expect(eventos).toEqual([
      {
        tipo: 'OperacionRegistrada',
        operacionId,
        tipoOperacion: 'VENTA',
        productoIds: ['lejia', 'carbon'],
      },
    ])
  })

  it('el escenario usa los productos de los Antecedentes', async () => {
    const { catalogo } = await escenario()
    expect(await catalogo.producto('detergente')).toEqual(
      productoResumido({
        id: 'detergente',
        nombre: 'Detergente a granel',
        unidad: 'KILO',
        compra: '5.30',
        venta: '7.90',
        minimo: '2',
      }),
    )
  })
})

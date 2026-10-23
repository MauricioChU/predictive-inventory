import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { situacionDe } from '../__pruebas__/dobles'
import { crearEscenario, productoResumido, type ProductoDePrueba } from '../__pruebas__/escenario'
import { OPCIONES_DE_SOBRECOMPRA } from './ingresos'

const escenario = () => crearEscenario((almacen) => new UnidadDeTrabajoEnMemoria(almacen))
const unidades = (n: number) => Cantidad.deEntero(n)
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')
const soles = (texto: string) => Dinero.deTexto(texto)

const ESCOBA: ProductoDePrueba = {
  id: 'escoba',
  nombre: 'Escoba',
  unidad: 'UNIDAD',
  compra: '6.00',
  venta: '9.00',
  minimo: '1',
  stock: '4',
}

/** "Dado que Lejía 1 L tiene venta promedio diaria 2": 56 unid. en 28 días; en Para comprar ~7. */
async function lejiaConVpd2() {
  const e = await escenario()
  const lejia = (await e.catalogo.producto('lejia'))!
  e.analisis.fijar(
    situacionDe(lejia, unidades(10), {
      prediccion: { vendido: unidades(56), diasValidos: 28 },
      enListaParaComprar: true,
      cantidadSugerida: unidades(7),
    }),
  )
  return e
}

describe('registrarIngreso', () => {
  it('RN-OP-14: cada línea guarda su costo y suma al stock', async () => {
    const { modulo, stock, operaciones } = await escenario()
    const respuesta = await modulo.registrarIngreso({
      lineas: [
        { productoId: 'lejia', cantidad: '6', costo: '2.40' },
        { productoId: 'carbon', cantidad: '2.5', costo: '2.75' },
      ],
    })
    expect(respuesta.tipo).toBe('hecho')
    const id = respuesta.tipo === 'hecho' ? respuesta.operacionId : ''
    expect((await operaciones.porId(id))?.movimientos).toEqual([
      { productoId: 'lejia', cantidad: 6000, costoUnitario: 240, precioUnitario: null },
      { productoId: 'carbon', cantidad: 2500, costoUnitario: 275, precioUnitario: null },
    ])
    expect(await stock('lejia')).toEqual(unidades(16))
    expect(await stock('carbon')).toEqual(kilos('12.5'))
  })

  it('RN-OP-08: no llega mercadería de un producto archivado', async () => {
    const { modulo, agregarProductos } = await escenario()
    await agregarProductos([{ ...ESCOBA, stock: undefined, minimo: '2', archivado: true }])
    await expect(
      modulo.registrarIngreso({ lineas: [{ productoId: 'escoba', cantidad: '3', costo: '6.00' }] }),
    ).rejects.toThrow('Escoba está archivado. Reactívalo para usarlo')
  })

  it('RN-OP-03 / RN-OP-09 / RN-OP-14: valida cantidad, fecha y costo', async () => {
    const { modulo } = await escenario()
    const ingreso = (cantidad: string, costo: string, fecha?: string) =>
      modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad, costo }],
        ocurridaEn: fecha ? instanteLocal(fecha) : undefined,
      })
    await expect(ingreso('0', '2.40')).rejects.toThrow('La cantidad debe ser mayor que 0')
    await expect(ingreso('1', '-1.00')).rejects.toThrow('El precio de compra no puede ser negativo')
    await expect(ingreso('1', '2.40', '2026-10-16 08:00')).rejects.toThrow(
      'La fecha no puede ser futura',
    )
  })

  it('RN-OP-07 / RN-OP-03: las líneas repetidas se suman antes de validar', async () => {
    const { modulo, stock } = await escenario()
    await expect(
      modulo.registrarIngreso({
        lineas: [
          { productoId: 'lejia', cantidad: '60000', costo: '2.40' },
          { productoId: 'lejia', cantidad: '50000', costo: '2.40' },
        ],
      }),
    ).rejects.toThrow('La cantidad no puede pasar de 99 999')
    await modulo.registrarIngreso({
      lineas: [
        { productoId: 'lejia', cantidad: '2', costo: '2.40' },
        { productoId: 'lejia', cantidad: '3', costo: '2.40' },
      ],
    })
    expect(await stock('lejia')).toEqual(unidades(15))
  })

  it('RN-OP-07: el mismo producto con distinto costo en dos líneas se rechaza', async () => {
    const { modulo, stock } = await escenario()
    await expect(
      modulo.registrarIngreso({
        lineas: [
          { productoId: 'lejia', cantidad: '2', costo: '2.40' },
          { productoId: 'lejia', cantidad: '3', costo: '2.60' },
        ],
      }),
    ).rejects.toThrow(
      'Pusiste el mismo producto dos veces con distinto precio. Déjalo en una sola línea.',
    )
    expect(await stock('lejia')).toEqual(unidades(10))
  })

  it('un ingreso sin líneas se rechaza', async () => {
    const { modulo, operaciones } = await escenario()
    await expect(modulo.registrarIngreso({ lineas: [] })).rejects.toThrow(
      'Agrega al menos un producto',
    )
    expect(await operaciones.todas()).toHaveLength(3)
  })

  describe('RN-OP-14: precio de compra', () => {
    it('RN-OP-14: si el costo cambió, se pide confirmar sin registrar nada todavía', async () => {
      const { modulo, stock, catalogo } = await escenario()
      const respuesta = await modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '12', costo: '2.60' }],
      })
      expect(respuesta).toEqual({
        tipo: 'confirmar-precios',
        cambios: [
          {
            productoId: 'lejia',
            mensaje: '¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad',
          },
        ],
      })
      expect(await stock('lejia')).toEqual(unidades(10))
      expect(catalogo.preciosDeCompraActualizados).toEqual([])
    })

    it('RN-OP-14: al confirmar, registra y actualiza el precio de compra', async () => {
      const { modulo, stock, catalogo, operaciones } = await escenario()
      const respuesta = await modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '12', costo: '2.60' }],
        actualizarPreciosDeCompra: true,
      })
      expect(respuesta.tipo).toBe('hecho')
      expect(await stock('lejia')).toEqual(unidades(22))
      expect(catalogo.preciosDeCompraActualizados).toEqual([{ id: 'lejia', precio: soles('2.60') }])
      expect((await catalogo.producto('lejia'))?.precioCompra).toEqual(soles('2.60'))
      expect((await operaciones.todas()).at(-1)?.movimientos[0]?.costoUnitario).toBe(260)
    })

    it('RN-OP-14: se puede registrar el costo distinto sin cambiar el precio de compra', async () => {
      const { modulo, stock, catalogo, operaciones } = await escenario()
      await modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '12', costo: '2.60' }],
        actualizarPreciosDeCompra: false,
      })
      expect(await stock('lejia')).toEqual(unidades(22))
      expect(catalogo.preciosDeCompraActualizados).toEqual([])
      expect((await catalogo.producto('lejia'))?.precioCompra).toEqual(soles('2.40'))
      expect((await operaciones.todas()).at(-1)?.movimientos[0]?.costoUnitario).toBe(260)
    })

    it('RN-OP-14: con el mismo costo no pregunta nada', async () => {
      const { modulo, catalogo } = await escenario()
      const respuesta = await modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '12', costo: '2.40' }],
        actualizarPreciosDeCompra: true,
      })
      expect(respuesta.tipo).toBe('hecho')
      expect(catalogo.preciosDeCompraActualizados).toEqual([])
    })

    it('RN-OP-14: solo pregunta por las líneas cuyo costo cambió, con su margen y su unidad', async () => {
      const { modulo } = await escenario()
      const respuesta = await modulo.registrarIngreso({
        lineas: [
          { productoId: 'lejia', cantidad: '1', costo: '2.40' },
          { productoId: 'carbon', cantidad: '1', costo: '4.20' },
          { productoId: 'detergente', cantidad: '1', costo: '7.90' },
        ],
      })
      expect(respuesta).toEqual({
        tipo: 'confirmar-precios',
        cambios: [
          {
            productoId: 'carbon',
            mensaje: '¿Actualizar el precio de compra a S/ 4.20? Perderás S/ 0.20 por kilo',
          },
          {
            productoId: 'detergente',
            mensaje: '¿Actualizar el precio de compra a S/ 7.90? No ganarás nada por kilo',
          },
        ],
      })
    })

    it('RN-OP-06: si actualizar el precio de compra falla, el ingreso no queda registrado', async () => {
      const { modulo, stock, catalogo } = await escenario()
      catalogo.actualizarPrecioCompra = async () => {
        throw new Error('El catálogo falló')
      }
      await expect(
        modulo.registrarIngreso({
          lineas: [{ productoId: 'lejia', cantidad: '12', costo: '2.60' }],
          actualizarPreciosDeCompra: true,
        }),
      ).rejects.toThrow('El catálogo falló')
      expect(await stock('lejia')).toEqual(unidades(10))
    })
  })

  describe('RN-OP-20: aviso de sobrecompra', () => {
    it('RN-OP-20: avisa cuando una compra alcanza para demasiados días, sin registrar', async () => {
      const { modulo, stock } = await lejiaConVpd2()
      const respuesta = await modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '110', costo: '2.40' }],
      })
      expect(respuesta).toEqual({
        tipo: 'aviso-sobrecompra',
        avisos: [
          {
            productoId: 'lejia',
            mensaje: 'Con esto tendrías Lejía 1 L para ~60 días. Te sugerimos ~7 unid.',
            nombre: 'Lejía 1 L',
            lineas: ['Llegan 110 unid. → te alcanzan ~60 días', 'Te sugerimos ~7 unid.'],
          },
        ],
      })
      expect(OPCIONES_DE_SOBRECOMPRA).toEqual(['Registrar igual', 'Cambiar cantidad'])
      expect(await stock('lejia')).toEqual(unidades(10))
    })

    it('RN-OP-20: el aviso dice si no hacía falta comprar', async () => {
      const e = await escenario()
      const carbon = (await e.catalogo.producto('carbon'))!
      e.analisis.fijar(
        situacionDe(carbon, kilos('10'), { prediccion: { vendido: kilos('7'), diasValidos: 28 } }),
      )
      const respuesta = await e.modulo.registrarIngreso({
        lineas: [{ productoId: 'carbon', cantidad: '5', costo: '2.75' }],
      })
      expect(respuesta).toEqual({
        tipo: 'aviso-sobrecompra',
        avisos: [
          {
            productoId: 'carbon',
            mensaje: 'Con esto tendrías Carbón para ~60 días. Ahora no necesitabas comprar.',
            nombre: 'Carbón',
            lineas: ['Llegan 5 kg → te alcanzan ~60 días', 'No necesitabas comprar'],
          },
        ],
      })
    })

    it('RN-OP-20: avisa cuando se compra un producto parado', async () => {
      const e = await escenario()
      await e.agregarProductos([ESCOBA])
      e.analisis.fijar(
        situacionDe(productoResumido(ESCOBA), unidades(4), { parado: { diasSinVender: 45 } }),
      )
      const respuesta = await e.modulo.registrarIngreso({
        lineas: [{ productoId: 'escoba', cantidad: '2', costo: '6.00' }],
      })
      expect(respuesta).toEqual({
        tipo: 'aviso-sobrecompra',
        avisos: [
          {
            productoId: 'escoba',
            mensaje: 'Escoba no se vende hace 45 días y aún tienes 4 unid.',
            nombre: 'Escoba',
            lineas: ['No se vende hace 45 días', 'Aún tienes 4 unid.'],
          },
        ],
      })
    })

    it('RN-OP-20: una compra razonable no genera aviso', async () => {
      const { modulo, stock } = await lejiaConVpd2()
      const respuesta = await modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '20', costo: '2.40' }],
      })
      expect(respuesta.tipo).toBe('hecho')
      expect(await stock('lejia')).toEqual(unidades(30))
    })

    it('RN-OP-20: el aviso no bloquea: "Registrar igual" registra', async () => {
      const { modulo, stock } = await lejiaConVpd2()
      const respuesta = await modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '110', costo: '2.40' }],
        confirmarSobrecompra: true,
      })
      expect(respuesta.tipo).toBe('hecho')
      expect(await stock('lejia')).toEqual(unidades(120))
    })

    it('RN-OP-20: usa el límite configurado en la tienda', async () => {
      const e = await lejiaConVpd2()
      e.tienda.config.diasMaximosDeCompra = 60
      const respuesta = await e.modulo.registrarIngreso({
        lineas: [{ productoId: 'lejia', cantidad: '110', costo: '2.40' }],
      })
      expect(respuesta.tipo).toBe('hecho')
    })

    it('RN-OP-20: sin predicción ni producto parado, no hay aviso', async () => {
      const e = await escenario()
      const lejia = (await e.catalogo.producto('lejia'))!
      e.analisis.fijar(situacionDe(lejia, unidades(10)))
      const respuesta = await e.modulo.registrarIngreso({
        lineas: [
          { productoId: 'lejia', cantidad: '500', costo: '2.40' },
          { productoId: 'carbon', cantidad: '500', costo: '2.75' },
        ],
      })
      expect(respuesta.tipo).toBe('hecho')
    })

    it('RN-OP-20 / RN-OP-14: primero el aviso de sobrecompra, después el precio de compra', async () => {
      const { modulo, stock } = await lejiaConVpd2()
      const lineas = [{ productoId: 'lejia', cantidad: '110', costo: '2.60' }]
      expect((await modulo.registrarIngreso({ lineas })).tipo).toBe('aviso-sobrecompra')
      expect((await modulo.registrarIngreso({ lineas, confirmarSobrecompra: true })).tipo).toBe(
        'confirmar-precios',
      )
      expect(
        (
          await modulo.registrarIngreso({
            lineas,
            confirmarSobrecompra: true,
            actualizarPreciosDeCompra: false,
          })
        ).tipo,
      ).toBe('hecho')
      expect(await stock('lejia')).toEqual(unidades(120))
    })

    it('RN-OP-20 / RN-OP-07: revisa cada línea con la cantidad ya sumada', async () => {
      const { modulo } = await lejiaConVpd2()
      // 45 solas: (10 + 45) × 28 / 56 = 27 días; sumadas: (10 + 90) × 28 / 56 = 50 días.
      expect(
        (
          await modulo.registrarIngreso({
            lineas: [{ productoId: 'lejia', cantidad: '45', costo: '2.40' }],
            actualizarPreciosDeCompra: false,
          })
        ).tipo,
      ).toBe('hecho')
      const { modulo: otro } = await lejiaConVpd2()
      const respuesta = await otro.registrarIngreso({
        lineas: [
          { productoId: 'lejia', cantidad: '45', costo: '2.40' },
          { productoId: 'carbon', cantidad: '1', costo: '2.75' },
          { productoId: 'lejia', cantidad: '45', costo: '2.40' },
        ],
      })
      expect(respuesta).toEqual({
        tipo: 'aviso-sobrecompra',
        avisos: [
          {
            productoId: 'lejia',
            mensaje: 'Con esto tendrías Lejía 1 L para ~50 días. Te sugerimos ~7 unid.',
            nombre: 'Lejía 1 L',
            lineas: ['Llegan 90 unid. → te alcanzan ~50 días', 'Te sugerimos ~7 unid.'],
          },
        ],
      })
    })
  })
})

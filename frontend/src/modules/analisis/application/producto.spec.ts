import { describe, expect, it } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { instanteLocal } from '@/shared/domain/fecha'
import { formatearCantidad, formatearNumero } from '@/shared/domain/formato'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEntorno } from '../__pruebas__/entorno'
import { historial } from '../domain/__pruebas__/historial'
import { nuevaOperacion } from '../domain/__pruebas__/operaciones'
import { cant, DETERGENTE, ESCOBA, JABON, LEJIA } from '../domain/__pruebas__/productos'

function entorno(productos: readonly ProductoResumido[]) {
  return crearEntorno({ productos, uow: (a) => new UnidadDeTrabajoEnMemoria(a) })
}

describe('RN-AN-16: ¿Necesito comprar?', () => {
  it('RN-AN-16: responde con una sola frase según el caso', async () => {
    const e = entorno([LEJIA, DETERGENTE, JABON])
    await e.cargar(
      historial('lejia')
        .primerMovimiento('2026-08-01', 61)
        .vendio(56, '2026-09-17', '2026-10-14')
        .construir(),
      historial('detergente', { precioVenta: '7.90', precioCompra: '5.30' })
        .primerMovimiento('2026-08-01', 34)
        .vendio(14, '2026-09-17', '2026-10-14')
        .construir(),
      historial('jabon').primerMovimiento('2026-10-12', 10).construir(),
    )
    const respuesta = async (id: string) => (await e.modulo.necesitoComprar(id)).respuesta
    expect(await respuesta('lejia')).toBe('Sí, compra ~12 unid. (S/ 28.80)')
    expect(await respuesta('detergente')).toBe('No hace falta: te alcanza para ~40 días')
    expect(await respuesta('jabon')).toBe(
      'Tienes 10 unid. Todavía no sé cuánto vendes; vuelve a preguntar en unos días',
    )
  })

  it('RN-AN-16: con predicción y sin ventas en 4 semanas, no hace falta', async () => {
    const e = entorno([LEJIA])
    await e.cargar(historial('lejia').primerMovimiento('2026-09-16', 10).construir())
    expect((await e.modulo.necesitoComprar('lejia')).respuesta).toBe(
      'No hace falta: no vendiste en las últimas 4 semanas',
    )
  })

  it('RN-AN-16: un producto parado: no compres', async () => {
    const e = entorno([ESCOBA])
    await e.registrar(
      nuevaOperacion('STOCK_INICIAL', '2026-07-17 08:00', [
        { producto: 'escoba', cantidad: '5', costo: '6.00' },
      ]),
      nuevaOperacion('VENTA', '2026-08-31 10:00', [
        { producto: 'escoba', cantidad: '1', precio: '9.00', costo: '6.00' },
      ]),
    )
    expect((await e.modulo.necesitoComprar('escoba')).respuesta).toBe(
      'No compres: no se vende hace 45 días y tienes 4 unid.',
    )
  })

  // Ola 3 (ruling de la Ola 2): no contradecir la lista que el usuario acaba de editar.
  it('RN-AN-16: usa la cantidad de la lista de hoy y, si se quitó, sigue con el caso 3', async () => {
    const e = entorno([LEJIA])
    await e.cargar(
      historial('lejia')
        .primerMovimiento('2026-08-01', 61)
        .vendio(56, '2026-09-17', '2026-10-14')
        .construir(),
    )
    const respuesta = async () => (await e.modulo.necesitoComprar('lejia')).respuesta
    await e.modulo.cambiarCantidadEnLista('lejia', '24')
    expect(await respuesta()).toBe('Sí, compra ~24 unid. (S/ 57.60)')
    await e.modulo.quitarDeLista('lejia')
    expect(await respuesta()).toBe('No hace falta: te alcanza para ~2 días')
    // Al día siguiente los cambios ya no valen.
    e.reloj.fijar('2026-10-16T13:00:00.000Z')
    expect(await respuesta()).toMatch(/^Sí, compra ~/)
  })

  it('RN-AN-16: debajo se muestra el stock actual y la última llegada de mercadería', async () => {
    const e = entorno([LEJIA])
    await e.registrar(
      nuevaOperacion('STOCK_INICIAL', '2026-08-01 08:00', [
        { producto: 'lejia', cantidad: '10', costo: '2.40' },
      ]),
      nuevaOperacion('INGRESO', '2026-10-10 09:30', [
        { producto: 'lejia', cantidad: '6', costo: '2.40' },
      ]),
    )
    const r = await e.modulo.necesitoComprar('lejia')
    expect(formatearCantidad(r.stock, r.unidad)).toBe('16 unid.')
    expect(r.ultimoIngreso).toBe(instanteLocal('2026-10-10 09:30'))
  })

  it('RN-AN-16: sin llegadas de mercadería, la última llegada es null', async () => {
    const e = entorno([LEJIA])
    expect(await e.modulo.necesitoComprar('lejia')).toMatchObject({ ultimoIngreso: null })
  })

  it('RN-AN-16: un producto archivado o que no existe no se puede consultar', async () => {
    const e = entorno([{ ...ESCOBA, activo: false }])
    await expect(e.modulo.necesitoComprar('escoba')).rejects.toThrow('No encontramos ese producto')
    await expect(e.modulo.necesitoComprar('nada')).rejects.toThrow('No encontramos ese producto')
  })
})

describe('detalle del producto', () => {
  it('RN-AN-14: tendencia de 8 semanas, VPD y días de cobertura', async () => {
    const e = entorno([LEJIA])
    await e.cargar(
      historial('lejia')
        .primerMovimiento('2026-08-01', 500)
        .vendioPorBloques('2026-10-15', [10, 12, 9, 14, 15, 13, 16, 18])
        .construir(),
    )
    const detalle = await e.modulo.detalleDeProducto('lejia')
    expect(detalle?.tendencia.map(formatearNumero).join(', ')).toBe('10, 12, 9, 14, 15, 13, 16, 18')
    // Últimos 28 días: 15 + 13 + 16 + 18 = 62 → VPD 2.21…; stock 393 → 177 días.
    expect(detalle?.situacion.stock).toEqual(cant('393'))
    expect(detalle?.textoVentaDiaria).toBe('Vendes ~2.2 unid. al día')
    expect(detalle?.textoCobertura).toBe('Se acaba en ~177 días')
  })

  it('RN-AN-05: sin predicción no se muestra la cobertura ni la venta diaria', async () => {
    const e = entorno([LEJIA])
    e.inventario.stock.set('lejia', cant('4'))
    const detalle = await e.modulo.detalleDeProducto('lejia')
    expect(detalle).toMatchObject({ textoCobertura: null, textoVentaDiaria: null })
    expect(detalle?.tendencia.every((c) => c.esCero())).toBe(true)
  })

  it('RN-AL-01: un producto archivado no tiene detalle de análisis', async () => {
    const e = entorno([{ ...LEJIA, activo: false }])
    expect(await e.modulo.detalleDeProducto('lejia')).toBeNull()
  })
})

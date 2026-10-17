import { describe, expect, it } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { formatearCantidad, formatearDinero, formatearNumero } from '@/shared/domain/formato'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEntorno } from '../__pruebas__/entorno'
import { historial } from '../domain/__pruebas__/historial'
import { CARBON, LEJIA } from '../domain/__pruebas__/productos'

function entorno(productos: readonly ProductoResumido[] = [LEJIA, CARBON]) {
  return crearEntorno({ productos, uow: (a) => new UnidadDeTrabajoEnMemoria(a) })
}

/** Lejía: stock 5 y VPD 2 → 12 unid.; Carbón: stock 7 y VPD 0.75 → 1.5 kg. */
async function conLejiaYCarbon(e = entorno()) {
  await e.cargar(
    historial('lejia')
      .primerMovimiento('2026-08-01', 61)
      .vendio(56, '2026-09-17', '2026-10-14')
      .construir(),
    historial('carbon', { precioVenta: '4.00', precioCompra: '2.75' })
      .primerMovimiento('2026-08-01', 28)
      .vendio(21, '2026-09-17', '2026-10-14')
      .construir(),
  )
  return e
}

async function cantidades(e: Awaited<ReturnType<typeof conLejiaYCarbon>>) {
  const lista = await e.modulo.listaParaComprar()
  return lista.lineas.map((l) => [l.nombre, formatearCantidad(l.cantidad, l.unidad)])
}

describe('RN-AN-08: lista para comprar editable', () => {
  it('RN-AN-08: muestra la cantidad sugerida y el costo estimado de cada línea', async () => {
    const e = await conLejiaYCarbon()
    const lista = await e.modulo.listaParaComprar()
    expect(
      lista.lineas.map((l) => [
        l.nombre,
        formatearCantidad(l.cantidad, l.unidad),
        formatearDinero(l.costoEstimado),
      ]),
    ).toEqual([
      ['Lejía 1 L', '12 unid.', 'S/ 28.80'],
      ['Carbón', '1.5 kg', 'S/ 4.13'],
    ])
    expect(formatearDinero(lista.total)).toBe('S/ 32.93')
  })

  it('RN-AN-08: los cambios a la lista se recuerdan hasta el final del día', async () => {
    const e = await conLejiaYCarbon()
    await e.modulo.cambiarCantidadEnLista('lejia', '24')
    expect(await cantidades(e)).toEqual([
      ['Lejía 1 L', '24 unid.'],
      ['Carbón', '1.5 kg'],
    ])

    const otraVez = e.reabrir()
    const lista = await otraVez.listaParaComprar()
    expect(formatearNumero(lista.lineas[0]!.cantidad)).toBe('24')

    e.reloj.fijar('2026-10-16T13:00:00.000Z') // 2026-10-16 08:00 en Lima
    expect(await cantidades(e)).toEqual([
      ['Lejía 1 L', '12 unid.'],
      ['Carbón', '1.5 kg'],
    ])
  })

  it('RN-AN-08: un cambio a las 23:59 sigue siendo de ese día', async () => {
    const e = await conLejiaYCarbon()
    e.reloj.fijar('2026-10-16T04:59:00.000Z') // 2026-10-15 23:59 en Lima
    await e.modulo.cambiarCantidadEnLista('lejia', '20')
    e.reloj.fijar('2026-10-15T23:00:00.000Z')
    expect((await cantidades(e))[0]).toEqual(['Lejía 1 L', '20 unid.'])
  })

  it('RN-AN-08: quitar un producto de la lista y volver a ponerlo con otra cantidad', async () => {
    const e = await conLejiaYCarbon()
    await e.modulo.quitarDeLista('carbon')
    expect(await cantidades(e)).toEqual([['Lejía 1 L', '12 unid.']])
    expect(formatearDinero((await e.modulo.listaParaComprar()).total)).toBe('S/ 28.80')
    await e.modulo.cambiarCantidadEnLista('carbon', '2.5')
    expect(await cantidades(e)).toEqual([
      ['Lejía 1 L', '12 unid.'],
      ['Carbón', '2.5 kg'],
    ])
  })

  // Plan 13, ronda 1: Deshacer (RN-OP-18) deja la lista del día exactamente como estaba.
  it('RN-AN-08 / RN-OP-18: deshacer quitar una línea sin cambios la devuelve siguiendo la sugerencia', async () => {
    const e = await conLejiaYCarbon()
    const quitado = await e.modulo.quitarDeLista('carbon')
    await e.modulo.deshacerQuitarDeLista(quitado)
    expect(await cantidades(e)).toEqual([
      ['Lejía 1 L', '12 unid.'],
      ['Carbón', '1.5 kg'],
    ])
    // No queda como un cambio del usuario: si la sugerencia cambia, la línea la sigue.
    expect((await e.listaDeCompras.delDia('2026-10-15'))?.cambios).toEqual([])
  })

  it('RN-AN-08 / RN-OP-18: deshacer quitar una línea cambiada la devuelve con su cantidad', async () => {
    const e = await conLejiaYCarbon()
    await e.modulo.cambiarCantidadEnLista('lejia', '24')
    const quitado = await e.modulo.quitarDeLista('lejia')
    await e.modulo.deshacerQuitarDeLista(quitado)
    expect(await cantidades(e)).toEqual([
      ['Lejía 1 L', '24 unid.'],
      ['Carbón', '1.5 kg'],
    ])
    expect((await e.listaDeCompras.delDia('2026-10-15'))?.cambios).toEqual([
      { productoId: 'lejia', cantidad: 24_000 },
    ])
  })

  it('RN-AN-08: deshacer después de la medianoche no toca la lista del día nuevo', async () => {
    const e = await conLejiaYCarbon()
    const quitado = await e.modulo.quitarDeLista('carbon')
    e.reloj.fijar('2026-10-16T13:00:00.000Z') // 2026-10-16 08:00 en Lima
    await e.modulo.deshacerQuitarDeLista(quitado)
    expect(await e.listaDeCompras.delDia('2026-10-16')).toBeNull()
  })

  it.each([
    ['lejia', '0', 'La cantidad debe ser mayor que 0'],
    ['lejia', '1.5', 'Este producto se cuenta por unidades enteras'],
    ['carbon', '100000', 'La cantidad no puede pasar de 99 999'],
    ['otro', '2', 'No encontramos ese producto'],
  ])('RN-AN-08: cambiar %s a "%s" se rechaza: %s', async (productoId, texto, mensaje) => {
    const e = await conLejiaYCarbon()
    await expect(e.modulo.cambiarCantidadEnLista(productoId, texto)).rejects.toThrow(mensaje)
    expect(await e.listaDeCompras.delDia('2026-10-15')).toBeNull()
  })

  it('RN-AN-08: un producto archivado no se cambia en la lista', async () => {
    const e = await conLejiaYCarbon(entorno([{ ...LEJIA, activo: false }, CARBON]))
    await expect(e.modulo.cambiarCantidadEnLista('lejia', '24')).rejects.toThrow(
      'No encontramos ese producto',
    )
  })

  // Ola 3 (ruling de la Ola 2): quitar también valida el producto, con el texto de Catálogo.
  it('RN-AN-08: quitar de la lista un producto que no existe o está archivado se rechaza', async () => {
    const e = await conLejiaYCarbon(entorno([{ ...LEJIA, activo: false }, CARBON]))
    await expect(e.modulo.quitarDeLista('lejia')).rejects.toThrow('No encontramos ese producto')
    await expect(e.modulo.quitarDeLista('otro')).rejects.toThrow('No encontramos ese producto')
    expect(await e.listaDeCompras.delDia('2026-10-15')).toBeNull()
  })

  it('RN-AN-08: compartir la lista como texto', async () => {
    const e = await conLejiaYCarbon()
    expect(await e.modulo.textoParaCompartir()).toBe(
      [
        'Lista de compras – Bodega Rosita – 15/10/2026',
        '• Lejía 1 L: 12 unid.',
        '• Carbón: 1.5 kg',
        'Total estimado: S/ 32.93',
      ].join('\n'),
    )
  })

  it('RN-AN-08: el texto compartido lleva los cambios del día', async () => {
    const e = await conLejiaYCarbon()
    await e.modulo.cambiarCantidadEnLista('lejia', '24')
    await e.modulo.quitarDeLista('carbon')
    expect(await e.modulo.textoParaCompartir()).toBe(
      'Lista de compras – Bodega Rosita – 15/10/2026\n• Lejía 1 L: 24 unid.\nTotal estimado: S/ 57.60',
    )
  })

  it('RN-AN-08: convertir la lista en llegada de mercadería', async () => {
    const e = await conLejiaYCarbon()
    const lineas = await e.modulo.lineasParaRegistrarLlegada()
    expect(
      lineas.map((l) => ({
        producto: l.productoId,
        cantidad: formatearNumero(l.cantidad),
        costo: formatearDinero(l.costo),
      })),
    ).toEqual([
      { producto: 'lejia', cantidad: '12', costo: 'S/ 2.40' },
      { producto: 'carbon', cantidad: '1.5', costo: 'S/ 2.75' },
    ])
  })
})

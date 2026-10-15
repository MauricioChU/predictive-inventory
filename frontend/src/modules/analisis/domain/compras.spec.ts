import { describe, expect, it } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import type { EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import type { Cantidad } from '@/shared/domain/cantidad'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'
import { prediccionCon } from './__pruebas__/historial'
import { BOLSAS, CARBON, cant, DETERGENTE, JABON, LEJIA, producto } from './__pruebas__/productos'
import {
  aplicarCambiosALista,
  armarListaParaComprar,
  cambiosARegistro,
  cambiosDesdeRegistro,
  cantidadDeLista,
  cantidadSugerida,
  entraEnLista,
  ordenarLista,
  registrarCambio,
  textoParaCompartir,
  type LineaParaComprar,
  type ListaParaComprar,
} from './compras'
import { evaluarSituacion } from './situacion'

const CONFIG = { diasEntreCompras: 7, diasAnticipacion: 3 }

function situacion(p: ProductoResumido, stock: string, vpd: string | null) {
  return evaluarSituacion({
    producto: p,
    stock: cant(stock),
    prediccion: vpd === null ? null : prediccionCon(vpd),
    ...CONFIG,
  })
}

function lista(...situaciones: [ProductoResumido, string, string | null][]): ListaParaComprar {
  return armarListaParaComprar(
    situaciones.map(([p, stock, vpd]) => ({
      situacion: situacion(p, stock, vpd),
      precioCompra: p.precioCompra,
    })),
  )
}

function filas(l: ListaParaComprar) {
  return l.lineas.map((linea) => ({
    producto: linea.nombre,
    estado: linea.estado,
    sugerido: formatearCantidad(linea.cantidad, linea.unidad),
    costo: formatearDinero(linea.costoEstimado),
  }))
}

describe('RN-AN-06: cantidad sugerida', () => {
  it.each([
    ['Lejía 1 L', '5', '3', '2', '12 unid.', LEJIA],
    ['Lejía 1 L', '4', '3', '1.6', '11 unid.', LEJIA],
    ['Carbón', '7', '3', '0.75', '1.5 kg', CARBON],
    ['Carbón', '6.4', '3', '0.5', '0.5 kg', CARBON],
  ])(
    'RN-AN-06: %s con stock %s, mínimo %s y VPD %s → %s',
    (_nombre, stock, minimo, vpd, sugerido, p) => {
      const cantidad = cantidadSugerida({
        unidad: p.unidad,
        stock: cant(stock),
        stockMinimo: cant(minimo),
        prediccion: prediccionCon(vpd),
        diasEntreCompras: 7,
      })
      expect(formatearCantidad(cantidad, p.unidad)).toBe(sugerido)
    },
  )

  it('RN-AN-06: sin predicción el objetivo es 2 × mínimo', () => {
    const cantidad = cantidadSugerida({
      unidad: 'UNIDAD',
      stock: cant('2'),
      stockMinimo: cant('3'),
      prediccion: null,
      diasEntreCompras: 7,
    })
    expect(formatearCantidad(cantidad, 'UNIDAD')).toBe('4 unid.')
  })

  it.each([
    ['UNIDAD', '0', '0', '1 unid.'],
    ['KILO', '10', '3', '0.5 kg'],
    ['LITRO', '0', '0', '0.5 L'],
  ] as const)(
    'RN-AN-06: nunca menos que un incremento (%s, stock %s, mínimo %s → %s)',
    (unidad, stock, minimo, sugerido) => {
      const cantidad = cantidadSugerida({
        unidad,
        stock: cant(stock),
        stockMinimo: cant(minimo),
        prediccion: null,
        diasEntreCompras: 7,
      })
      expect(formatearCantidad(cantidad, unidad)).toBe(sugerido)
    },
  )

  it('RN-AN-06: si ya alcanza el objetivo con predicción, sugiere un incremento', () => {
    const cantidad = cantidadSugerida({
      unidad: 'KILO',
      stock: cant('50'),
      stockMinimo: cant('2'),
      prediccion: prediccionCon('0.5'),
      diasEntreCompras: 7,
    })
    expect(formatearCantidad(cantidad, 'KILO')).toBe('0.5 kg')
  })

  it('RN-AN-06: redondea hacia arriba con la VPD exacta (sin redondearla antes)', () => {
    // 20 vendidos en 7 días: objetivo = 3 + 20 = 23; faltan 23 − 5 = 18 exactos.
    const cantidad = cantidadSugerida({
      unidad: 'UNIDAD',
      stock: cant('5'),
      stockMinimo: cant('3'),
      prediccion: { vendido: cant('20'), diasValidos: 7 },
      diasEntreCompras: 7,
    })
    expect(cantidad.milesimas).toBe(18000)
  })
})

describe('RN-AN-07: quién entra en Para comprar', () => {
  function entra(
    stock: string,
    minimo: string,
    vpd: string | null,
    estado: EstadoDeStock = 'NORMAL',
  ) {
    return entraEnLista({
      estado,
      stock: cant(stock),
      stockMinimo: cant(minimo),
      prediccion: vpd === null ? null : prediccionCon(vpd),
      diasEntreCompras: 7,
    })
  }

  it('RN-AN-07: entra si no le alcanza hasta la próxima compra (7 − 5.25 < 3)', () => {
    expect(entra('7', '3', '0.75')).toBe(true)
  })

  it('RN-AN-07: no entra si le alcanza (20 − 3.5 ≥ 2)', () => {
    expect(entra('20', '2', '0.5')).toBe(false)
  })

  it('RN-AN-07: justo en el mínimo al llegar la próxima compra no entra (17 − 14 = 3)', () => {
    expect(entra('17', '3', '2')).toBe(false)
  })

  it('RN-AN-07: sin predicción y en estado NORMAL no entra', () => {
    expect(entra('10', '3', null)).toBe(false)
  })

  it('RN-AN-07: los agotados y por acabarse siempre entran', () => {
    expect(entra('0', '0', null, 'AGOTADO')).toBe(true)
    expect(entra('100', '3', '0', 'POR_ACABARSE')).toBe(true)
  })
})

describe('RN-AN-06 / RN-AN-07 / RN-AN-08: lista para comprar del escenario', () => {
  it('RN-AN-07: lista con cantidades sugeridas, orden y costo total', () => {
    const l = lista(
      [LEJIA, '5', '2'],
      [CARBON, '7', '0.75'],
      [JABON, '2', null],
      [BOLSAS, '0', null],
      [DETERGENTE, '20', '0.5'],
    )
    expect(filas(l)).toEqual([
      { producto: 'Bolsas', estado: 'AGOTADO', sugerido: '1 unid.', costo: 'S/ 0.05' },
      { producto: 'Lejía 1 L', estado: 'POR_ACABARSE', sugerido: '12 unid.', costo: 'S/ 28.80' },
      { producto: 'Jabón', estado: 'POR_ACABARSE', sugerido: '4 unid.', costo: 'S/ 4.80' },
      { producto: 'Carbón', estado: 'NORMAL', sugerido: '1.5 kg', costo: 'S/ 4.13' },
    ])
    expect(formatearDinero(l.total)).toBe('S/ 37.78')
    expect(l.lineas[1]).toMatchObject({ productoId: 'lejia', diasDeCobertura: 2 })
    expect(l.lineas[1]?.precioCompra).toEqual(LEJIA.precioCompra)
  })

  it('RN-AN-07: dentro de cada grupo, menos cobertura primero, sin predicción al final, luego nombre', () => {
    const linea = (nombre: string, diasDeCobertura: number | null): LineaParaComprar => ({
      productoId: nombre,
      nombre,
      unidad: 'UNIDAD',
      estado: 'POR_ACABARSE',
      diasDeCobertura,
      cantidad: cant('1'),
      precioCompra: LEJIA.precioCompra,
      costoEstimado: LEJIA.precioCompra,
    })
    const ordenadas = ordenarLista([
      linea('Zapallo', null),
      linea('Ácido', null),
      linea('Bórax', 3),
      linea('Azúcar', 1),
      linea('Agua', 3),
      { ...linea('Escoba', null), estado: 'AGOTADO' },
      { ...linea('Cera', 0), estado: 'NORMAL' },
    ])
    expect(ordenadas.map((l) => l.nombre)).toEqual([
      'Escoba',
      'Azúcar',
      'Agua',
      'Bórax',
      'Ácido',
      'Zapallo',
      'Cera',
    ])
  })

  it('RN-AN-08: el usuario cambia una cantidad o quita un producto, y el total se recalcula', () => {
    const base = lista([LEJIA, '5', '2'], [CARBON, '7', '0.75'], [JABON, '2', null])
    let cambios = registrarCambio([], { productoId: 'lejia', cantidad: cant('24') })
    cambios = registrarCambio(cambios, { productoId: 'jabon', cantidad: null })
    cambios = registrarCambio(cambios, { productoId: 'desconocido', cantidad: cant('3') })
    const editada = aplicarCambiosALista(base, cambios)
    expect(filas(editada)).toEqual([
      { producto: 'Lejía 1 L', estado: 'POR_ACABARSE', sugerido: '24 unid.', costo: 'S/ 57.60' },
      { producto: 'Carbón', estado: 'NORMAL', sugerido: '1.5 kg', costo: 'S/ 4.13' },
    ])
    expect(formatearDinero(editada.total)).toBe('S/ 61.73')
  })

  it('RN-AN-08: un cambio nuevo del mismo producto reemplaza al anterior', () => {
    const doce: Cantidad = cant('12')
    let cambios = registrarCambio([], { productoId: 'lejia', cantidad: null })
    cambios = registrarCambio(cambios, { productoId: 'carbon', cantidad: cant('2') })
    cambios = registrarCambio(cambios, { productoId: 'lejia', cantidad: doce })
    expect(cambios).toEqual([
      { productoId: 'carbon', cantidad: cant('2') },
      { productoId: 'lejia', cantidad: doce },
    ])
  })
})

describe('RN-AN-08: texto para compartir', () => {
  const l = lista([LEJIA, '5', '2'], [CARBON, '7', '0.75'])

  it('RN-AN-08: compartir la lista como texto', () => {
    expect(textoParaCompartir(l, 'Bodega Rosita', '2026-10-15')).toBe(
      [
        'Lista de compras – Bodega Rosita – 15/10/2026',
        '• Lejía 1 L: 12 unid.',
        '• Carbón: 1.5 kg',
        'Total estimado: S/ 32.93',
      ].join('\n'),
    )
  })

  it('RN-AN-08: sin nombre de tienda, el título lleva solo la fecha', () => {
    expect(textoParaCompartir(l, '  ', '2026-10-15').split('\n')[0]).toBe(
      'Lista de compras – 15/10/2026',
    )
  })

  it('RN-AN-08: una lista vacía comparte solo el título y el total', () => {
    const vacia = lista([producto('x', 'Nada', 'UNIDAD', '1.00', '2.00', '0'), '10', null])
    expect(textoParaCompartir(vacia, 'Bodega Rosita', '2026-10-15')).toBe(
      'Lista de compras – Bodega Rosita – 15/10/2026\nTotal estimado: S/ 0.00',
    )
  })
})

describe('RN-AN-08: cantidad escrita en la lista', () => {
  it('RN-AN-08: acepta una cantidad válida para la unidad del producto', () => {
    expect(cantidadDeLista('24', 'UNIDAD').milesimas).toBe(24000)
    expect(cantidadDeLista('1,5', 'KILO').milesimas).toBe(1500)
    expect(cantidadDeLista('99999', 'LITRO').milesimas).toBe(99_999_000)
  })

  it.each([
    ['0', 'UNIDAD', 'La cantidad debe ser mayor que 0'],
    ['-2', 'UNIDAD', 'La cantidad debe ser mayor que 0'],
    ['100000', 'UNIDAD', 'La cantidad no puede pasar de 99 999'],
    ['99999.5', 'KILO', 'La cantidad no puede pasar de 99 999'],
    ['1.5', 'UNIDAD', 'Este producto se cuenta por unidades enteras'],
    ['dos', 'KILO', 'Escribe una cantidad válida, por ejemplo 2 o 1.5'],
  ] as const)('RN-AN-08: "%s" en %s → %s', (texto, unidad, mensaje) => {
    expect(() => cantidadDeLista(texto, unidad)).toThrow(mensaje)
  })

  it('RN-AN-08: los cambios del día van y vuelven del registro en milésimas', () => {
    const cambios = [
      { productoId: 'lejia', cantidad: cant('24') },
      { productoId: 'jabon', cantidad: null },
    ]
    const registro = cambiosARegistro('2026-10-15', cambios)
    expect(registro).toEqual({
      dia: '2026-10-15',
      cambios: [
        { productoId: 'lejia', cantidad: 24000 },
        { productoId: 'jabon', cantidad: null },
      ],
    })
    expect(cambiosDesdeRegistro(registro)).toEqual(cambios)
    expect(cambiosDesdeRegistro(null)).toEqual([])
  })
})

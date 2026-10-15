import { describe, expect, it } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { prediccionCon } from './__pruebas__/historial'
import { cant, CARBON, DETERGENTE, ESCOBA, JABON, LEJIA } from './__pruebas__/productos'
import { respuestaNecesitoComprar } from './necesito-comprar'
import { evaluarSituacion } from './situacion'

function preguntar(
  p: ProductoResumido,
  stock: string,
  vpd: string | null,
  parado: { diasSinVender: number } | null = null,
) {
  const situacion = evaluarSituacion({
    producto: p,
    stock: cant(stock),
    prediccion: vpd === null ? null : prediccionCon(vpd),
    diasEntreCompras: 7,
    diasAnticipacion: 3,
    parado,
  })
  return respuestaNecesitoComprar(situacion, p.precioCompra)
}

describe('RN-AN-16: ¿Necesito comprar?', () => {
  it.each([
    ['Lejía 1 L', '5', '2', 'Sí, compra ~12 unid. (S/ 28.80)', LEJIA],
    ['Detergente a granel', '20', '0.5', 'No hace falta: te alcanza para ~40 días', DETERGENTE],
    [
      'Jabón',
      '10',
      null,
      'Tienes 10 unid. Todavía no sé cuánto vendes; vuelve a preguntar en unos días',
      JABON,
    ],
  ] as const)('RN-AN-16: %s con stock %s y VPD %s', (_nombre, stock, vpd, respuesta, p) => {
    expect(preguntar(p, stock, vpd)).toBe(respuesta)
  })

  it('RN-AN-16: un producto parado: no compres', () => {
    expect(preguntar(ESCOBA, '4', '0', { diasSinVender: 45 })).toBe(
      'No compres: no se vende hace 45 días y tienes 4 unid.',
    )
    expect(preguntar(CARBON, '2', null, { diasSinVender: 31 })).toBe(
      'No compres: no se vende hace 31 días y tienes 2 kg',
    )
  })

  it('RN-AN-16: parado gana aunque también esté en Para comprar', () => {
    expect(preguntar(ESCOBA, '1', '0', { diasSinVender: 60 })).toBe(
      'No compres: no se vende hace 60 días y tienes 1 unid.',
    )
  })

  it('RN-AN-16: en Para comprar, el costo estimado se redondea al céntimo', () => {
    expect(preguntar(CARBON, '2.5', null)).toBe('Sí, compra ~3.5 kg (S/ 9.63)')
  })

  it('RN-AN-16: con predicción pero sin ventas en 4 semanas, no hace falta', () => {
    expect(preguntar(LEJIA, '10', '0')).toBe('No hace falta: no vendiste en las últimas 4 semanas')
  })

  it('RN-AN-16: sin predicción, en kg el punto va después de la unidad', () => {
    expect(preguntar({ ...CARBON, stockMinimo: cant('1') }, '2.5', null)).toBe(
      'Tienes 2.5 kg. Todavía no sé cuánto vendes; vuelve a preguntar en unos días',
    )
  })

  it('RN-AN-16: la cobertura de 1 día va en singular', () => {
    const situacion = {
      ...evaluarSituacion({
        producto: LEJIA,
        stock: cant('2'),
        prediccion: prediccionCon('2'),
        diasEntreCompras: 7,
        diasAnticipacion: 3,
      }),
      enListaParaComprar: false,
      cantidadSugerida: null,
    }
    expect(respuestaNecesitoComprar(situacion, LEJIA.precioCompra)).toBe(
      'No hace falta: te alcanza para ~1 día',
    )
  })
})

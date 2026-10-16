import { describe, expect, it } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { prediccionCon } from './__pruebas__/historial'
import { cant, CARBON, DETERGENTE, ESCOBA, JABON, LEJIA } from './__pruebas__/productos'
import type { CambioEnLista } from './compras'
import { respuestaNecesitoComprar } from './necesito-comprar'
import { evaluarSituacion } from './situacion'

function preguntar(
  p: ProductoResumido,
  stock: string,
  vpd: string | null,
  parado: { diasSinVender: number } | null = null,
  cambioDelDia?: CambioEnLista,
) {
  const situacion = evaluarSituacion({
    producto: p,
    stock: cant(stock),
    prediccion: vpd === null ? null : prediccionCon(vpd),
    diasEntreCompras: 7,
    diasAnticipacion: 3,
    parado,
  })
  return respuestaNecesitoComprar(situacion, p.precioCompra, cambioDelDia)
}

const quitado = (productoId: string) => ({ productoId, cantidad: null })

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

  // Ola 3 (ruling de la Ola 2): no contradecir la lista que el usuario acaba de editar.
  it('RN-AN-16: en Para comprar, usa la cantidad que el usuario dejó hoy en la lista', () => {
    const cambio = { productoId: 'lejia', cantidad: cant('20') }
    expect(preguntar(LEJIA, '5', '2', null, cambio)).toBe('Sí, compra ~20 unid. (S/ 48.00)')
  })

  // Fix round 1, ruling 2: quitarlo de la lista no lo saca de "¿Necesito comprar?" si se acabó
  // o se está acabando; solo uno NORMAL quitado sigue con el caso 3.
  it('RN-AN-16: un producto NORMAL quitado de la lista de hoy sigue con el caso 3', () => {
    // Carbón: stock 7 y VPD 0.75 → 9 días (NORMAL), pero entra en la lista (7 − 5.25 < 3).
    expect(preguntar(CARBON, '7', '0.75')).toBe('Sí, compra ~1.5 kg (S/ 4.13)')
    expect(preguntar(CARBON, '7', '0.75', null, quitado('carbon'))).toBe(
      'No hace falta: te alcanza para ~9 días',
    )
  })

  it('RN-AN-16: un producto POR_ACABARSE o AGOTADO quitado de la lista sigue diciendo que compres lo sugerido', () => {
    expect(preguntar(LEJIA, '5', '2', null, quitado('lejia'))).toBe(
      'Sí, compra ~12 unid. (S/ 28.80)',
    )
    expect(preguntar(CARBON, '2.5', null, null, quitado('carbon'))).toBe(
      'Sí, compra ~3.5 kg (S/ 9.63)',
    )
    expect(preguntar(LEJIA, '0', '2', null, quitado('lejia'))).toBe(
      'Sí, compra ~17 unid. (S/ 40.80)',
    )
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

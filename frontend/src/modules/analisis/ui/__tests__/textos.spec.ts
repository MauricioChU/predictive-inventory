import { describe, expect, it } from 'vitest'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import {
  OPCIONES_DE_MAS_VENDIDOS,
  OPCIONES_DE_PERIODO,
  partesDelCambio,
  textoCostoUnitario,
  textoDeDia,
  textoMejorDia,
  textoPerdidaPorUnidad,
  textoSinVender,
  textoSinVentas,
  textoVeces,
  textoUltimaLlegada,
  tituloDeGanancia,
  tonoDeRespuesta,
} from '../textos'

const soles = (texto: string) => Dinero.deTexto(texto)

describe('Control: textos de la pantalla', () => {
  it('RN-AN-03: el periodo del resumen es Hoy · Ayer · 7 días · 30 días', () => {
    expect(OPCIONES_DE_PERIODO.map((o) => [o.valor, o.etiqueta])).toEqual([
      ['HOY', 'Hoy'],
      ['AYER', 'Ayer'],
      ['7_DIAS', '7 días'],
      ['30_DIAS', '30 días'],
    ])
  })

  it('RN-AN-09: los más vendidos miran 7 o 30 días', () => {
    expect(OPCIONES_DE_MAS_VENDIDOS.map((o) => [o.valor, o.etiqueta])).toEqual([
      [7, '7 días'],
      [30, '30 días'],
    ])
  })

  it('la ganancia del periodo se dice con palabras de la tienda, y una pérdida se dice como tal', () => {
    expect(tituloDeGanancia('HOY', soles('48.20'))).toBe('Hoy ganaste')
    expect(tituloDeGanancia('AYER', soles('0'))).toBe('Ayer ganaste')
    expect(tituloDeGanancia('7_DIAS', soles('-2.40'))).toBe('En 7 días perdiste')
    expect(tituloDeGanancia('30_DIAS', soles('1'))).toBe('En 30 días ganaste')
  })

  it('RN-UX-10: un periodo sin ventas lo dice ("Todavía no hay ventas esta semana")', () => {
    expect(textoSinVentas('HOY')).toBe('Todavía no hay ventas hoy')
    expect(textoSinVentas('AYER')).toBe('Ayer no hubo ventas')
    expect(textoSinVentas('7_DIAS')).toBe('Todavía no hay ventas esta semana')
    expect(textoSinVentas('30_DIAS')).toBe('Todavía no hay ventas en los últimos 30 días')
  })

  it('RN-AN-12: separa la flecha (que no se lee) del texto del cambio y le da su tono', () => {
    expect(partesDelCambio('▲ 12 % más')).toEqual({ flecha: '▲', texto: '12 % más', tono: 'sube' })
    expect(partesDelCambio('▼ 10 % menos')).toEqual({
      flecha: '▼',
      texto: '10 % menos',
      tono: 'baja',
    })
    expect(partesDelCambio('= igual')).toEqual({ flecha: '=', texto: 'igual', tono: 'igual' })
  })

  it('RN-AN-13: el día de la semana con mayúscula y el mejor día en una frase', () => {
    expect(textoDeDia('miércoles')).toBe('Miércoles')
    expect(textoMejorDia('sábado')).toBe('Tu mejor día es el sábado')
  })

  it('RN-AN-09: "1 vez" y "5 veces"', () => {
    expect(textoVeces(1)).toBe('1 vez')
    expect(textoVeces(5)).toBe('5 veces')
  })

  it('RN-AN-11: los días sin vender de un producto parado', () => {
    expect(textoSinVender(45)).toBe('No se vende hace 45 días')
  })

  it('RN-AN-10: la pérdida por unidad, por kilo o por litro; sin pérdida, no se gana nada', () => {
    expect(textoPerdidaPorUnidad(soles('0.50'), 'UNIDAD')).toBe('Pierdes S/ 0.50 por unidad')
    expect(textoPerdidaPorUnidad(soles('1.25'), 'KILO')).toBe('Pierdes S/ 1.25 por kilo')
    expect(textoPerdidaPorUnidad(soles('0.10'), 'LITRO')).toBe('Pierdes S/ 0.10 por litro')
    expect(textoPerdidaPorUnidad(soles('0'), 'UNIDAD')).toBe('Lo vendes al precio que lo compras')
  })
})

describe('Para comprar: textos de cada línea', () => {
  it('RN-AN-08: el costo de compra por unidad, por kilo o por litro', () => {
    expect(textoCostoUnitario(soles('2.40'), 'UNIDAD')).toBe('Costo S/ 2.40 c/u')
    expect(textoCostoUnitario(soles('2.75'), 'KILO')).toBe('Costo S/ 2.75 el kg')
    expect(textoCostoUnitario(soles('5.30'), 'LITRO')).toBe('Costo S/ 5.30 el L')
  })
})

describe('¿Necesito comprar?: textos de la respuesta', () => {
  it('RN-AN-16: el tono sigue al caso (el texto lo dice igual, RN-UX-04)', () => {
    expect(tonoDeRespuesta('COMPRAR')).toBe('atencion')
    expect(tonoDeRespuesta('NO_HACE_FALTA')).toBe('exito')
    expect(tonoDeRespuesta('NO_COMPRES')).toBe('peligro')
    expect(tonoDeRespuesta('SIN_PREDICCION')).toBe('info')
  })

  it('RN-AN-16: la última llegada de mercadería, con cuántos días hace', () => {
    expect(textoUltimaLlegada(null, null)).toBe('Todavía no registras llegadas de este producto')
    expect(textoUltimaLlegada(instanteLocal('2026-10-15 09:30'), 0)).toBe('Hoy')
    expect(textoUltimaLlegada(instanteLocal('2026-10-14 23:59'), 1)).toBe('Ayer')
    expect(textoUltimaLlegada(instanteLocal('2026-10-10 00:10'), 5)).toBe(
      '10/10/2026 (hace 5 días)',
    )
  })
})

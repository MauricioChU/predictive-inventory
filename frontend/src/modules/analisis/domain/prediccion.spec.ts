import { describe, expect, it } from 'vitest'
import type { Prediccion } from '@/shared/contratos/entre-modulos'
import { historial, prediccionCon, type HistorialDePrueba } from './__pruebas__/historial'
import { cant } from './__pruebas__/productos'
import {
  calcularPrediccion,
  diasDeCobertura,
  textoCobertura,
  textoVentaDiaria,
  ventaDiariaAproximada,
} from './prediccion'

const HOY = '2026-10-15'

function prediccionDe(h: HistorialDePrueba, hoy = HOY): Prediccion | null {
  return calcularPrediccion({ hoy, stock: h.stock, primerDia: h.primerDia, filas: h.filas })
}

function vpd(p: Prediccion | null): number | null {
  return p === null ? null : p.vendido.milesimas / 1000 / p.diasValidos
}

describe('RN-AN-04: venta promedio diaria', () => {
  it('RN-AN-04: 56 vendidos en los 28 días completos dan una VPD de 2', () => {
    const h = historial().primerMovimiento('2026-08-01').vendio(56, '2026-09-17', '2026-10-14')
    const p = prediccionDe(h.construir())
    expect(p?.diasValidos).toBe(28)
    expect(p?.vendido.milesimas).toBe(56000)
    expect(vpd(p)).toBe(2)
  })

  it('RN-AN-04: los días agotados todo el día no cuentan', () => {
    const h = historial()
      .primerMovimiento('2026-08-01')
      .vendio(40, '2026-09-17', '2026-10-14')
      .agotadoDias(8, '2026-09-17', '2026-10-14')
    const p = prediccionDe(h.construir())
    expect(p?.diasValidos).toBe(20)
    expect(vpd(p)).toBe(2)
  })

  it('RN-AN-04: un día que empieza agotado pero recibe mercadería sí cuenta', () => {
    const h = historial()
      .primerMovimiento('2026-08-01')
      .vendio(28, '2026-09-17', '2026-10-14')
      .agotadoDias(3, '2026-09-20', '2026-10-14')
    const p = prediccionDe(h.construir())
    expect(p?.diasValidos).toBe(25)
  })

  it('RN-AN-04: un producto nuevo usa solo los días desde su primer movimiento', () => {
    const h = historial('jabon')
      .primerMovimiento('2026-10-05', 100)
      .vendio(15, '2026-10-05', '2026-10-14')
    const p = prediccionDe(h.construir())
    expect(p?.diasValidos).toBe(10)
    expect(vpd(p)).toBe(1.5)
  })

  it('RN-AN-04: con menos de 7 días válidos no hay predicción', () => {
    const h = historial('jabon')
      .primerMovimiento('2026-10-10', 100)
      .vendio(6, '2026-10-10', '2026-10-14')
    expect(prediccionDe(h.construir())).toBeNull()
  })

  it('RN-AN-04: con exactamente 7 días válidos sí hay predicción', () => {
    const h = historial('jabon')
      .primerMovimiento('2026-10-08', 100)
      .vendio(7, '2026-10-08', '2026-10-14')
    expect(prediccionDe(h.construir())).toEqual({ vendido: cant('7'), diasValidos: 7 })
  })

  it('RN-AN-04: las ventas de hoy no entran en el promedio', () => {
    const h = historial()
      .primerMovimiento('2026-08-01')
      .vendio(56, '2026-09-17', '2026-10-14')
      .vendio(5, HOY)
    const p = prediccionDe(h.construir())
    expect(p?.diasValidos).toBe(28)
    expect(vpd(p)).toBe(2)
  })

  it('RN-AN-04: lo vendido hoy no hace parecer agotados los días anteriores', () => {
    // Quedaban 2 desde el 24/09 y hoy se vendieron: hasta ayer hubo stock todos los días.
    const h = historial()
      .primerMovimiento('2026-09-17', 10)
      .vendio(8, '2026-09-17', '2026-09-24')
      .vendio(2, HOY)
      .construir()
    expect(h.stock.esCero()).toBe(true)
    expect(prediccionDe(h)).toEqual({ vendido: cant('8'), diasValidos: 28 })
  })

  it('RN-AN-04: solo mira los 28 días completos anteriores a hoy', () => {
    const h = historial()
      .primerMovimiento('2026-08-01')
      .vendio(100, '2026-08-01', '2026-09-16')
      .vendio(28, '2026-09-17', '2026-10-14')
    const p = prediccionDe(h.construir())
    expect(p).toEqual({ vendido: cant('28'), diasValidos: 28 })
  })

  it('RN-AN-04: sin movimientos, o con el primero hoy, no hay predicción', () => {
    expect(prediccionDe(historial().construir())).toBeNull()
    expect(prediccionDe(historial().primerMovimiento(HOY, 10).construir())).toBeNull()
  })

  it('RN-AN-04: un producto que no se movió sigue teniendo días válidos si tiene stock', () => {
    const p = prediccionDe(historial().primerMovimiento('2026-08-01', 10).construir())
    expect(p).toEqual({ vendido: cant('0'), diasValidos: 28 })
  })

  it('RN-AN-04: un producto agotado desde hace semanas no tiene predicción', () => {
    const p = calcularPrediccion({
      hoy: HOY,
      stock: cant('0'),
      primerDia: '2026-08-01',
      filas: historial().primerMovimiento('2026-08-01', 10).vendio(10, '2026-08-01').construir()
        .filas,
    })
    expect(p).toBeNull()
  })
})

describe('RN-AN-05: días de cobertura', () => {
  it.each([
    ['5', '2', 2, 'Se acaba en ~2 días'],
    ['1', '2', 0, 'Se acaba hoy'],
    ['7', '0.75', 9, 'Se acaba en ~9 días'],
    ['3', '2', 1, 'Se acaba en ~1 día'],
  ])('RN-AN-05: stock %s con VPD %s → %s días ("%s")', (stock, venta, dias, texto) => {
    const p = prediccionCon(venta)
    expect(diasDeCobertura(p, cant(stock))).toBe(dias)
    expect(textoCobertura(p, cant(stock))).toBe(texto)
  })

  it('RN-AN-05: con VPD 0 no hay cobertura y se dice que no hubo ventas', () => {
    const p = prediccionCon('0')
    expect(diasDeCobertura(p, cant('10'))).toBeNull()
    expect(textoCobertura(p, cant('10'))).toBe('Sin ventas en las últimas 4 semanas')
  })

  it('RN-AN-05: sin predicción no se muestra nada', () => {
    expect(textoCobertura(null, cant('10'))).toBeNull()
  })

  it('RN-AN-05: con stock 0 no se muestra nada (el estado ya dice Agotado)', () => {
    expect(textoCobertura(prediccionCon('2'), cant('0'))).toBeNull()
    expect(textoCobertura(prediccionCon('0'), cant('0'))).toBeNull()
  })

  it('RN-AN-05: la cobertura usa la fracción exacta, sin redondear la VPD', () => {
    // 20 vendidos en 7 días: VPD 2.857…; 8 ÷ 2.857… = 2.8 → 2 días.
    expect(diasDeCobertura({ vendido: cant('20'), diasValidos: 7 }, cant('8'))).toBe(2)
    // 2 vendidos en 3 días: VPD 0.666…; 2 ÷ 0.666… = 3 exactos (con 0.667 saldría 2).
    expect(diasDeCobertura({ vendido: cant('2'), diasValidos: 3 }, cant('2'))).toBe(3)
  })
})

describe('venta diaria aproximada (detalle del producto)', () => {
  it('RN-AN-14: se muestra con un decimal y la unidad del producto', () => {
    expect(textoVentaDiaria(prediccionCon('2'), 'UNIDAD')).toBe('Vendes ~2 unid. al día')
    expect(textoVentaDiaria(prediccionCon('1.5', 10), 'UNIDAD')).toBe('Vendes ~1.5 unid. al día')
    expect(textoVentaDiaria(prediccionCon('0.75'), 'KILO')).toBe('Vendes ~0.8 kg al día')
    expect(textoVentaDiaria({ vendido: cant('20'), diasValidos: 7 }, 'LITRO')).toBe(
      'Vendes ~2.9 L al día',
    )
    expect(ventaDiariaAproximada(prediccionCon('0')).milesimas).toBe(0)
  })

  it('RN-AN-14: sin predicción no se muestra', () => {
    expect(textoVentaDiaria(null, 'UNIDAD')).toBeNull()
  })

  it('RN-AN-14: con una VPD mayor que 0 pero menor que 0.05, se dice que vende menos de 0.1', () => {
    // 1 en 28 días: 0.0357… se redondearía a "~0".
    expect(textoVentaDiaria({ vendido: cant('1'), diasValidos: 28 }, 'UNIDAD')).toBe(
      'Vendes menos de 0.1 unid. al día',
    )
    expect(textoVentaDiaria({ vendido: cant('1.3'), diasValidos: 28 }, 'KILO')).toBe(
      'Vendes menos de 0.1 kg al día',
    )
    // 0.05 exacto ya se redondea a 0.1.
    expect(textoVentaDiaria({ vendido: cant('1.4'), diasValidos: 28 }, 'KILO')).toBe(
      'Vendes ~0.1 kg al día',
    )
  })

  // Fix round 1, ruling 1: la cobertura ya dice "Sin ventas en las últimas 4 semanas".
  it('RN-AN-14: con VPD 0 no se muestra la venta diaria', () => {
    expect(textoVentaDiaria(prediccionCon('0'), 'LITRO')).toBeNull()
    expect(textoVentaDiaria({ vendido: cant('0'), diasValidos: 28 }, 'UNIDAD')).toBeNull()
  })
})

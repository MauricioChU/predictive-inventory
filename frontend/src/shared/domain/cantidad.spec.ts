import { describe, expect, it } from 'vitest'
import { Cantidad } from './cantidad'

describe('Cantidad', () => {
  it('se construye desde texto en milésimas', () => {
    expect(Cantidad.deTexto('2', 'UNIDAD').milesimas).toBe(2000)
    expect(Cantidad.deTexto('1.25', 'KILO').milesimas).toBe(1250)
    expect(Cantidad.deTexto('0,125', 'KILO').milesimas).toBe(125)
    expect(Cantidad.deTexto('3.0', 'UNIDAD').milesimas).toBe(3000)
    expect(Cantidad.deTexto('-2', 'UNIDAD').milesimas).toBe(-2000)
  })
  it('RN-OP-04: UNIDAD solo acepta enteros', () => {
    expect(() => Cantidad.deTexto('1.5', 'UNIDAD')).toThrow(
      'Este producto se cuenta por unidades enteras',
    )
  })
  it('RN-OP-04: KILO y LITRO aceptan hasta tres decimales', () => {
    expect(() => Cantidad.deTexto('0.0005', 'KILO')).toThrow('Usa como máximo tres decimales')
    expect(Cantidad.deTexto('0.333', 'LITRO').milesimas).toBe(333)
  })
  it('rechaza texto que no es una cantidad', () => {
    expect(() => Cantidad.deTexto('', 'KILO')).toThrow(
      'Escribe una cantidad válida, por ejemplo 2 o 1.5',
    )
    expect(() => Cantidad.deTexto('dos', 'UNIDAD')).toThrow(
      'Escribe una cantidad válida, por ejemplo 2 o 1.5',
    )
  })
  it('opera y compara', () => {
    const a = Cantidad.deEntero(10)
    const b = Cantidad.deMilesimas(2500)
    expect(a.restar(b).milesimas).toBe(7500)
    expect(b.restar(a).esNegativa()).toBe(true)
    expect(b.negar().abs().igualA(b)).toBe(true)
    expect(Cantidad.deEntero(1).esUno()).toBe(true)
    expect(Cantidad.sumarTodas([a, b]).milesimas).toBe(12500)
  })
  it('valida precisión de valores ya construidos', () => {
    expect(Cantidad.deMilesimas(1500).esValidaPara('UNIDAD')).toBe(false)
    expect(Cantidad.deMilesimas(1500).esValidaPara('KILO')).toBe(true)
  })
  it('RN-AN-06: redondea hacia arriba al incremento de la unidad', () => {
    expect(Cantidad.incrementoDe('UNIDAD').milesimas).toBe(1000)
    expect(Cantidad.incrementoDe('LITRO').milesimas).toBe(500)
    expect(
      Cantidad.deMilesimas(1250).redondearHaciaArribaA(Cantidad.incrementoDe('KILO')).milesimas,
    ).toBe(1500)
    expect(
      Cantidad.deMilesimas(10200).redondearHaciaArribaA(Cantidad.incrementoDe('UNIDAD')).milesimas,
    ).toBe(11000)
    expect(
      Cantidad.deMilesimas(1000).redondearHaciaArribaA(Cantidad.incrementoDe('UNIDAD')).milesimas,
    ).toBe(1000)
  })
  // No está en el enunciado de la Tarea 4: completa la cobertura de los predicados y
  // comparadores restantes de Cantidad (RN-SIS-02 exige 95% en el dominio).
  it('expone los predicados y comparadores restantes', () => {
    const cero = Cantidad.cero()
    const a = Cantidad.deEntero(10)
    const b = Cantidad.deMilesimas(2500)
    expect(cero.esCero()).toBe(true)
    expect(a.esCero()).toBe(false)
    expect(a.esPositiva()).toBe(true)
    expect(cero.esPositiva()).toBe(false)
    expect(a.compararCon(b)).toBeGreaterThan(0)
    expect(a.mayorQue(b)).toBe(true)
    expect(b.mayorQue(a)).toBe(false)
    expect(b.menorQue(a)).toBe(true)
    expect(a.menorQue(b)).toBe(false)
    expect(a.mayorOIgualQue(a)).toBe(true)
    expect(b.mayorOIgualQue(a)).toBe(false)
    expect(b.menorOIgualQue(a)).toBe(true)
    expect(a.menorOIgualQue(b)).toBe(false)
  })
  // Fix round 1, M1: -0 y 0 deben ser indistinguibles para quien usa Cantidad.
  it('M1: normaliza -0 a 0', () => {
    expect(Object.is(Cantidad.deMilesimas(-0).milesimas, 0)).toBe(true)
    expect(Object.is(Cantidad.cero().negar().milesimas, 0)).toBe(true)
  })
  // Fix round 1, M2: una cantidad que desborda Number.isSafeInteger debe rechazarse como
  // ErrorDeDominio con el mismo mensaje de "cantidad inválida", no con un Error interno.
  it('M2: rechaza cantidades que desbordan como ErrorDeDominio, no como Error interno', () => {
    expect(() => Cantidad.deTexto('99999999999999', 'KILO')).toThrow(
      'Escribe una cantidad válida, por ejemplo 2 o 1.5',
    )
  })
  // Fix round 1, M8: deEntero exige un entero (si no, "3 unidades y media" pasaría la
  // validación de UNIDAD sin que nadie lo note).
  it('M8: deEntero exige un entero', () => {
    expect(() => Cantidad.deEntero(1.5)).toThrow()
  })
})

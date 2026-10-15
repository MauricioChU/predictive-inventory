import { describe, expect, it } from 'vitest'
import { Dinero, redondearMitadLejosDeCero } from './dinero'
import { Cantidad } from './cantidad'
import { formatearDinero } from './formato'

describe('Dinero', () => {
  it('se construye desde texto con punto, coma o símbolo', () => {
    expect(Dinero.deTexto('2.40').centimos).toBe(240)
    expect(Dinero.deTexto('2,40').centimos).toBe(240)
    expect(Dinero.deTexto('S/ 3.5').centimos).toBe(350)
    expect(Dinero.deTexto('0').centimos).toBe(0)
    expect(Dinero.deTexto('-1.00').centimos).toBe(-100)
    expect(Dinero.deTexto('99999.99').centimos).toBe(9_999_999)
  })
  it('RN-CAT-04: rechaza más de dos decimales', () => {
    expect(() => Dinero.deTexto('2.405')).toThrow('Usa como máximo dos decimales')
  })
  it('rechaza texto que no es un monto', () => {
    expect(() => Dinero.deTexto('')).toThrow('Escribe un monto válido, por ejemplo 3.50')
    expect(() => Dinero.deTexto('abc')).toThrow('Escribe un monto válido, por ejemplo 3.50')
  })
  it('suma, resta y compara', () => {
    const a = Dinero.deCentimos(350)
    const b = Dinero.deCentimos(240)
    expect(a.sumar(b).centimos).toBe(590)
    expect(a.restar(b).centimos).toBe(110)
    expect(b.restar(a).esNegativo()).toBe(true)
    expect(a.mayorQue(b)).toBe(true)
    expect(b.menorOIgualQue(a)).toBe(true)
    expect(Dinero.sumarTodos([a, b, a]).centimos).toBe(940)
  })
  it('RN-OP-12: multiplica por cantidad redondeando al céntimo, mitad hacia arriba', () => {
    expect(Dinero.deTexto('2.75').multiplicarPor(Cantidad.deMilesimas(1250)).centimos).toBe(344) // 3.4375
    expect(Dinero.deTexto('7.90').multiplicarPor(Cantidad.deMilesimas(333)).centimos).toBe(263) // 2.6307
    expect(Dinero.deTexto('5.30').multiplicarPor(Cantidad.deMilesimas(333)).centimos).toBe(176) // 1.7649
    expect(Dinero.deTexto('2.75').multiplicarPor(Cantidad.deMilesimas(1500)).centimos).toBe(413) // 4.125
  })
  it('redondea valores negativos alejándose de cero', () => {
    expect(Dinero.deTexto('2.75').multiplicarPor(Cantidad.deMilesimas(-500)).centimos).toBe(-138) // -1.375
    expect(redondearMitadLejosDeCero(-1375, 1000)).toBe(-1)
    expect(redondearMitadLejosDeCero(1500, 1000)).toBe(2)
  })
  it('exige céntimos enteros', () => {
    expect(() => Dinero.deCentimos(1.5)).toThrow()
  })
  // Fix round 1, M1: -0 y 0 deben ser indistinguibles para quien usa Dinero.
  it('M1: normaliza -0 a 0', () => {
    expect(Object.is(Dinero.deCentimos(-0).centimos, 0)).toBe(true)
    expect(Object.is(Dinero.cero().negar().centimos, 0)).toBe(true)
    expect(Object.is(redondearMitadLejosDeCero(-400, 1000), 0)).toBe(true)
  })
  // Fix round 1, M2: un monto que desborda Number.isSafeInteger debe rechazarse como
  // ErrorDeDominio con el mismo mensaje de "monto inválido", no con un Error interno.
  it('M2: rechaza montos que desbordan como ErrorDeDominio, no como Error interno', () => {
    expect(() => Dinero.deTexto('999999999999999999')).toThrow(
      'Escribe un monto válido, por ejemplo 3.50',
    )
  })
  // Fix round 1, M3: "S/" solo se acepta como prefijo opcional; solo se recorta el
  // espacio exterior (y el que sigue a "S/"). No se aceptan números pegados por un espacio
  // interno ni un "S/" en medio del texto.
  it('M3: rechaza "S/" en medio del texto o dos números separados por un espacio', () => {
    expect(() => Dinero.deTexto('3 S/ 5')).toThrow('Escribe un monto válido, por ejemplo 3.50')
    expect(() => Dinero.deTexto('1 2')).toThrow('Escribe un monto válido, por ejemplo 3.50')
  })
  it('M3: acepta espacio exterior alrededor del monto', () => {
    expect(Dinero.deTexto('  3.50  ').centimos).toBe(350)
    expect(Dinero.deTexto('  S/ 3.50  ').centimos).toBe(350)
  })
  // Fix round 2, minor (dinero.ts:33-36): deTexto debe aceptar lo que la propia app ya
  // produce con formatearDinero (miles agrupados con un espacio, y "-S/" con el signo
  // antes del símbolo), sin dejar de rechazar "1 2", "3 S/ 5" ni espacios dobles.
  it('ronda de ida y vuelta: deTexto(formatearDinero(x)) === x, incluidos miles agrupados y negativos', () => {
    for (const centimos of [0, 5, 240, 125000, 9_999_999, -480, -9_999_999]) {
      const dinero = Dinero.deCentimos(centimos)
      expect(Dinero.deTexto(formatearDinero(dinero)).centimos).toBe(centimos)
    }
  })
  it('acepta miles agrupados con un espacio y "-S/" con el signo antes del símbolo', () => {
    expect(Dinero.deTexto('S/ 1 250.00').centimos).toBe(125000)
    expect(Dinero.deTexto('-S/ 4.80').centimos).toBe(-480)
  })
  it('sigue rechazando "1 2", "3 S/ 5" y espacios dobles dentro del número', () => {
    expect(() => Dinero.deTexto('1 2')).toThrow('Escribe un monto válido, por ejemplo 3.50')
    expect(() => Dinero.deTexto('3 S/ 5')).toThrow('Escribe un monto válido, por ejemplo 3.50')
    expect(() => Dinero.deTexto('1  250.00')).toThrow('Escribe un monto válido, por ejemplo 3.50')
  })
  // No está en el enunciado de la Tarea 3: completa la cobertura de los predicados y
  // comparadores restantes de Dinero (RN-SIS-02 exige 95% en el dominio).
  it('expone los predicados y comparadores restantes', () => {
    const cero = Dinero.cero()
    const a = Dinero.deCentimos(350)
    const b = Dinero.deCentimos(240)
    expect(cero.esCero()).toBe(true)
    expect(a.esCero()).toBe(false)
    expect(a.esPositivo()).toBe(true)
    expect(cero.esPositivo()).toBe(false)
    expect(a.negar().centimos).toBe(-350)
    expect(a.compararCon(b)).toBeGreaterThan(0)
    expect(a.igualA(Dinero.deCentimos(350))).toBe(true)
    expect(a.igualA(b)).toBe(false)
    expect(b.menorQue(a)).toBe(true)
    expect(a.menorQue(b)).toBe(false)
  })
})

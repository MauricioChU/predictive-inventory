import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import { ConteoGuiado, ordenarParaConteo } from './conteo-guiado'

const AHORA = instanteLocal('2026-10-15 10:00')
const DESPUES = instanteLocal('2026-10-15 10:30')
const NOMBRES: Record<string, string> = {
  carbon: 'Carbón',
  detergente: 'Detergente a granel',
  lejia: 'Lejía 1 L',
}
const nombreDe = (id: string) => NOMBRES[id] ?? id
const unidades = (n: number) => Cantidad.deEntero(n)

describe('ordenarParaConteo', () => {
  it('RN-OP-21: agrupa por categoría y ordena por nombre, sin importar tildes ni mayúsculas', () => {
    expect(
      ordenarParaConteo([
        { id: 'lejia', nombre: 'Lejía 1 L', categoriaNombre: 'Otros' },
        { id: 'bolsa', nombre: 'bolsa chica', categoriaNombre: 'Bolsas' },
        { id: 'carbon', nombre: 'Carbón', categoriaNombre: 'otros' },
        { id: 'escoba', nombre: 'Escoba', categoriaNombre: 'Escobas, trapeadores y accesorios' },
        { id: 'detergente', nombre: 'Detergente a granel', categoriaNombre: 'Otros' },
        { id: 'asa', nombre: 'Bolsa asa', categoriaNombre: 'Bolsas' },
      ]),
    ).toEqual(['asa', 'bolsa', 'escoba', 'carbon', 'detergente', 'lejia'])
  })
})

describe('ConteoGuiado', () => {
  const iniciar = () => ConteoGuiado.iniciar(['carbon', 'detergente', 'lejia'], AHORA)

  it('RN-OP-21: empieza en el primer producto, con "Llevas 0 de 3"', () => {
    const conteo = iniciar()
    expect(conteo.productoActual).toBe('carbon')
    expect(conteo.progreso()).toBe('Llevas 0 de 3')
    expect(conteo.terminado).toBe(false)
    expect(conteo.resumen(nombreDe)).toBeNull()
    expect(conteo.aRegistro()).toEqual({
      id: 'actual',
      iniciadoEn: AHORA,
      orden: ['carbon', 'detergente', 'lejia'],
      posicion: 0,
      contados: [],
      saltados: [],
      terminadoEn: null,
    })
  })

  it('RN-OP-21: recorrido con un salto y una diferencia, y su resumen', () => {
    const conteo = iniciar()
      .contar(Cantidad.cero(), Dinero.cero(), AHORA)
      .saltar(AHORA)
      .contar(unidades(-2), Dinero.deTexto('-4.80'), DESPUES)
    expect(conteo.terminado).toBe(true)
    expect(conteo.productoActual).toBeNull()
    expect(conteo.progreso()).toBe('Llevas 3 de 3')
    expect(conteo.aRegistro()).toMatchObject({
      posicion: 3,
      contados: [
        { productoId: 'carbon', diferencia: 0, valor: 0 },
        { productoId: 'lejia', diferencia: -2000, valor: -480 },
      ],
      saltados: ['detergente'],
      terminadoEn: DESPUES,
    })
    expect(conteo.resumen(nombreDe)).toEqual([
      'Contaste 2 productos. 1 con diferencia: -S/ 4.80',
      'Te faltó contar 1: Detergente a granel',
    ])
  })

  it('RN-OP-21: sin diferencias y sin saltos, "Todo cuadraba."', () => {
    const conteo = ConteoGuiado.iniciar(['lejia'], AHORA).contar(
      Cantidad.cero(),
      Dinero.cero(),
      AHORA,
    )
    expect(conteo.resumen(nombreDe)).toEqual(['Contaste 1 producto. Todo cuadraba.'])
  })

  it('RN-OP-21: cada paso devuelve un conteo nuevo; el anterior no cambia', () => {
    const inicio = iniciar()
    const despues = inicio.saltar(AHORA)
    expect(inicio.productoActual).toBe('carbon')
    expect(despues.productoActual).toBe('detergente')
    const registro = despues.aRegistro()
    registro.saltados.push('otro')
    expect(despues.aRegistro().saltados).toEqual(['carbon'])
  })

  it('RN-OP-21: los productos que ya no se pueden contar (archivados) se saltan solos, sin contar como faltantes', () => {
    const activos = new Set(['carbon', 'lejia'])
    const conteo = iniciar()
      .contar(Cantidad.cero(), Dinero.cero(), AHORA)
      .omitirNoContables((id) => activos.has(id), AHORA)
    expect(conteo.productoActual).toBe('lejia')
    expect(conteo.progreso()).toBe('Llevas 2 de 3')
    const final = conteo
      .contar(Cantidad.cero(), Dinero.cero(), AHORA)
      .omitirNoContables((id) => activos.has(id), AHORA)
    expect(final.resumen(nombreDe)).toEqual(['Contaste 2 productos. Todo cuadraba.'])
  })

  it('RN-OP-21: si los que faltan ya no se pueden contar, el conteo termina', () => {
    const conteo = iniciar()
      .contar(Cantidad.cero(), Dinero.cero(), AHORA)
      .omitirNoContables((id) => id === 'carbon', DESPUES)
    expect(conteo.terminado).toBe(true)
    expect(conteo.aRegistro().terminadoEn).toBe(DESPUES)
  })

  it('omitirNoContables no cambia nada si el producto actual se puede contar', () => {
    const conteo = iniciar()
    expect(conteo.omitirNoContables(() => true, AHORA)).toBe(conteo)
  })

  it('RN-OP-21: sin productos para contar, el conteo ya está terminado', () => {
    const conteo = ConteoGuiado.iniciar([], AHORA)
    expect(conteo.terminado).toBe(true)
    expect(conteo.resumen(nombreDe)).toEqual(['Contaste 0 productos. Todo cuadraba.'])
  })

  it('un conteo terminado no se puede seguir', () => {
    const conteo = ConteoGuiado.iniciar([], AHORA)
    expect(() => conteo.saltar(AHORA)).toThrow('El conteo guiado ya terminó')
    expect(() => conteo.contar(Cantidad.cero(), Dinero.cero(), AHORA)).toThrow(
      'El conteo guiado ya terminó',
    )
  })

  it('un registro con la posición fuera del orden no tiene producto actual', () => {
    const registro = { ...iniciar().aRegistro(), posicion: 3 }
    expect(ConteoGuiado.desdeRegistro(registro).productoActual).toBeNull()
  })

  it('desdeRegistro y aRegistro son inversas', () => {
    const registro = iniciar().saltar(AHORA).aRegistro()
    expect(ConteoGuiado.desdeRegistro(registro).aRegistro()).toEqual(registro)
    expect(ConteoGuiado.desdeRegistro(registro).productoActual).toBe('detergente')
  })
})

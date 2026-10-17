import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import { agruparAvisos, empeoro, RUTA_PARA_COMPRAR, rutaDeProducto, textoDeAviso } from './avisos'

function situacion(datos: Partial<SituacionDeProducto> = {}): SituacionDeProducto {
  return {
    productoId: 'p1',
    nombre: 'Lejía 1 L',
    unidad: 'UNIDAD',
    stock: Cantidad.deEntero(3),
    stockMinimo: Cantidad.deEntero(3),
    prediccion: null,
    diasDeCobertura: null,
    estado: 'POR_ACABARSE',
    enListaParaComprar: false,
    cantidadSugerida: null,
    parado: null,
    ...datos,
  }
}

describe('empeoro', () => {
  it('RN-AL-03: NORMAL a POR_ACABARSE empeora', () => {
    expect(empeoro('NORMAL', 'POR_ACABARSE')).toBe(true)
  })
  it('RN-AL-03: POR_ACABARSE a POR_ACABARSE no empeora', () => {
    expect(empeoro('POR_ACABARSE', 'POR_ACABARSE')).toBe(false)
  })
  it('RN-AL-03: POR_ACABARSE a AGOTADO empeora', () => {
    expect(empeoro('POR_ACABARSE', 'AGOTADO')).toBe(true)
  })
  it('RN-AL-04: AGOTADO a NORMAL no empeora (mejora)', () => {
    expect(empeoro('AGOTADO', 'NORMAL')).toBe(false)
  })
  it('RN-AL-03: sin registro previo (NORMAL por defecto) a AGOTADO empeora', () => {
    expect(empeoro('NORMAL', 'AGOTADO')).toBe(true)
  })
})

describe('textoDeAviso', () => {
  it('RN-AL-03: por acabarse sin predicción', () => {
    const texto = textoDeAviso(situacion({ estado: 'POR_ACABARSE', stock: Cantidad.deEntero(3) }))
    expect(texto).toBe('Queda poco: Lejía 1 L (3 unid.)')
  })
  it('RN-AL-03: por acabarse con predicción (varios días)', () => {
    const texto = textoDeAviso(
      situacion({ estado: 'POR_ACABARSE', stock: Cantidad.deEntero(6), diasDeCobertura: 3 }),
    )
    expect(texto).toBe('Queda poco: Lejía 1 L (6 unid., se acaba en ~3 días)')
  })
  it('RN-AL-03: por acabarse con predicción de 1 día (singular)', () => {
    const texto = textoDeAviso(
      situacion({ estado: 'POR_ACABARSE', stock: Cantidad.deEntero(2), diasDeCobertura: 1 }),
    )
    expect(texto).toBe('Queda poco: Lejía 1 L (2 unid., se acaba en ~1 día)')
  })
  it('RN-AL-03: por acabarse con predicción de 0 días (se acaba hoy)', () => {
    const texto = textoDeAviso(
      situacion({ estado: 'POR_ACABARSE', stock: Cantidad.deEntero(1), diasDeCobertura: 0 }),
    )
    expect(texto).toBe('Queda poco: Lejía 1 L (1 unid., se acaba hoy)')
  })
  it('RN-AL-03: agotado', () => {
    const texto = textoDeAviso(situacion({ estado: 'AGOTADO', stock: Cantidad.cero() }))
    expect(texto).toBe('Se acabó: Lejía 1 L')
  })
  it('RN-AL-03: un producto NORMAL no debería pedir un texto de aviso', () => {
    expect(() => textoDeAviso(situacion({ estado: 'NORMAL' }))).toThrow()
  })
})

describe('rutaDeProducto y RUTA_PARA_COMPRAR', () => {
  it('RN-AL-07: rutaDeProducto construye la ruta del producto', () => {
    expect(rutaDeProducto('abc-123')).toBe('/productos/abc-123')
  })
  it('RN-AL-07: RUTA_PARA_COMPRAR apunta a la lista de para comprar', () => {
    expect(RUTA_PARA_COMPRAR).toBe('/control/para-comprar')
  })
})

describe('agruparAvisos (RN-AL-07)', () => {
  it('RN-AL-07: sin avisos no genera notificaciones', () => {
    expect(agruparAvisos([])).toEqual([])
  })
  it('RN-AL-07: un solo aviso usa la ruta del producto', () => {
    const s = situacion({ productoId: 'p1', estado: 'POR_ACABARSE', stock: Cantidad.deEntero(3) })
    expect(agruparAvisos([s])).toEqual([
      { texto: 'Queda poco: Lejía 1 L (3 unid.)', url: '/productos/p1' },
    ])
  })
  it('RN-AL-07: tres avisos a la vez se agrupan en una sola notificación con RUTA_PARA_COMPRAR', () => {
    const s1 = situacion({ productoId: 'p1', estado: 'POR_ACABARSE' })
    const s2 = situacion({ productoId: 'p2', estado: 'AGOTADO' })
    const s3 = situacion({ productoId: 'p3', estado: 'POR_ACABARSE' })
    expect(agruparAvisos([s1, s2, s3])).toEqual([
      { texto: '3 productos se están acabando', url: RUTA_PARA_COMPRAR },
    ])
  })
})

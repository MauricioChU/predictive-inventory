import { describe, expect, it } from 'vitest'
import {
  campoDelError,
  erroresDeCampos,
  textoDeGanancia,
  type ValoresDeProducto,
} from '../formulario'

const VALIDOS: ValoresDeProducto = {
  nombre: 'Lejía 1 L',
  categoriaId: 'c-1',
  unidad: 'UNIDAD',
  precioCompra: '2.40',
  precioVenta: '3.50',
  stockMinimo: '3',
  stockInicial: '12',
}

describe('erroresDeCampos (cada mensaje de RN-CAT junto a su campo)', () => {
  it('un producto válido no tiene errores', () => {
    expect(erroresDeCampos(VALIDOS, { conStockInicial: true })).toEqual({})
  })

  it('RN-CAT-01: nombre vacío o de largo inválido', () => {
    expect(erroresDeCampos({ ...VALIDOS, nombre: '  ' }, { conStockInicial: true })).toEqual({
      nombre: 'Escribe el nombre del producto',
    })
    expect(erroresDeCampos({ ...VALIDOS, nombre: 'L' }, { conStockInicial: true })).toEqual({
      nombre: 'El nombre debe tener entre 2 y 80 letras',
    })
  })

  it('sin categoría elegida', () => {
    expect(erroresDeCampos({ ...VALIDOS, categoriaId: null }, { conStockInicial: true })).toEqual({
      categoria: 'Elige una categoría',
    })
  })

  it('RN-CAT-04: cada precio con su propio mensaje, a la vez', () => {
    expect(
      erroresDeCampos(
        { ...VALIDOS, precioCompra: '-1.00', precioVenta: '0.00' },
        { conStockInicial: true },
      ),
    ).toEqual({
      precioCompra: 'El precio de compra no puede ser negativo',
      precioVenta: 'El precio de venta debe ser mayor que S/ 0.00',
    })
    expect(
      erroresDeCampos(
        { ...VALIDOS, precioCompra: '2.405', precioVenta: '100000.00' },
        { conStockInicial: true },
      ),
    ).toEqual({
      precioCompra: 'Usa como máximo dos decimales',
      precioVenta: 'El precio no puede pasar de S/ 99 999.99',
    })
  })

  it('RN-CAT-04: la coma vale como punto ("2,40")', () => {
    expect(
      erroresDeCampos(
        { ...VALIDOS, precioCompra: '2,40', precioVenta: '3,50' },
        { conStockInicial: true },
      ),
    ).toEqual({})
  })

  it('RN-CAT-06: el stock mínimo respeta la unidad y no es negativo', () => {
    expect(erroresDeCampos({ ...VALIDOS, stockMinimo: '2.5' }, { conStockInicial: true })).toEqual({
      stockMinimo: 'Este producto se cuenta por unidades enteras',
    })
    expect(
      erroresDeCampos(
        { ...VALIDOS, unidad: 'KILO', stockMinimo: '0.0005', stockInicial: '1' },
        {
          conStockInicial: true,
        },
      ),
    ).toEqual({ stockMinimo: 'Usa como máximo tres decimales' })
    expect(
      erroresDeCampos(
        { ...VALIDOS, unidad: 'LITRO', stockMinimo: '-1' },
        { conStockInicial: true },
      ),
    ).toEqual({ stockMinimo: 'El stock mínimo no puede ser negativo' })
  })

  it('RN-CAT-08: el stock inicial solo se revisa al crear', () => {
    const conInicialMalo = { ...VALIDOS, stockInicial: '-2' }
    expect(erroresDeCampos(conInicialMalo, { conStockInicial: true })).toEqual({
      stockInicial: 'El stock inicial no puede ser negativo',
    })
    expect(erroresDeCampos(conInicialMalo, { conStockInicial: false })).toEqual({})
    expect(erroresDeCampos({ ...VALIDOS, stockInicial: '' }, { conStockInicial: true })).toEqual({})
  })
})

describe('campoDelError (dónde va un error que devuelve el caso de uso)', () => {
  it('cada código a su campo', () => {
    expect(campoDelError('NOMBRE_DUPLICADO')).toBe('nombre')
    expect(campoDelError('NOMBRE_VACIO')).toBe('nombre')
    expect(campoDelError('CATEGORIA_INEXISTENTE')).toBe('categoria')
    expect(campoDelError('UNIDAD_CON_MOVIMIENTOS')).toBe('unidad')
    expect(campoDelError('PRECIO_COMPRA_NEGATIVO')).toBe('precioCompra')
    expect(campoDelError('PRECIO_VENTA_INVALIDO')).toBe('precioVenta')
    expect(campoDelError('STOCK_MINIMO_NEGATIVO')).toBe('stockMinimo')
    expect(campoDelError('CANTIDAD_ENTERA')).toBe('stockMinimo')
    expect(campoDelError('STOCK_INICIAL_NEGATIVO')).toBe('stockInicial')
    expect(campoDelError('FOTO_INVALIDA')).toBe('foto')
    expect(campoDelError('FOTO_PESADA')).toBe('foto')
  })

  it('lo que no es de un campo va como error general', () => {
    expect(campoDelError('PRODUCTO_NO_ENCONTRADO')).toBeNull()
    expect(campoDelError('DINERO_INVALIDO')).toBeNull()
  })
})

describe('textoDeGanancia (lo que se gana con los precios escritos)', () => {
  it('ganancia por unidad, kilo o litro', () => {
    expect(textoDeGanancia('2.40', '3.50', 'UNIDAD')).toBe('Ganas S/ 1.10 por cada unidad')
    expect(textoDeGanancia('2,75', '4', 'KILO')).toBe('Ganas S/ 1.25 por cada kilo')
  })

  it('RN-CAT-05: con pérdida o sin ganancia, el mismo texto que la confirmación', () => {
    expect(textoDeGanancia('5.00', '4.50', 'UNIDAD')).toBe('Vas a perder S/ 0.50 por cada unidad')
    expect(textoDeGanancia('3', '3.00', 'LITRO')).toBe(
      'Con este precio no ganas nada por cada litro',
    )
  })

  it('nada mientras algún precio no se pueda leer', () => {
    expect(textoDeGanancia('', '3.50', 'UNIDAD')).toBeNull()
    expect(textoDeGanancia('2.40', 'abc', 'UNIDAD')).toBeNull()
    expect(textoDeGanancia('2.40', '0', 'UNIDAD')).toBeNull()
  })
})

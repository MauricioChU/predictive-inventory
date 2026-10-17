import { describe, expect, it } from 'vitest'
import { CATEGORIAS_INICIALES, Categoria, leerNombreDeCategoria } from './categoria'

describe('leerNombreDeCategoria (RN-CAT-15)', () => {
  it('acepta un nombre de 2 a 40 letras', () => {
    expect(leerNombreDeCategoria('Bolsas')).toBe('Bolsas')
  })
  it('rechaza un nombre de 1 letra', () => {
    expect(() => leerNombreDeCategoria('B')).toThrowError(
      'El nombre de la categoría debe tener entre 2 y 40 letras',
    )
  })
  it('rechaza un nombre de 41 letras', () => {
    expect(() => leerNombreDeCategoria('a'.repeat(41))).toThrowError(
      'El nombre de la categoría debe tener entre 2 y 40 letras',
    )
  })
  it('acepta exactamente 40 letras', () => {
    const nombre = 'a'.repeat(40)
    expect(leerNombreDeCategoria(nombre)).toBe(nombre)
  })
  it('recorta espacios exteriores', () => {
    expect(leerNombreDeCategoria('  Bolsas  ')).toBe('Bolsas')
  })
})

describe('Categoria', () => {
  it('se crea con id y nombre', () => {
    const categoria = Categoria.crear('c1', 'Bolsas')
    expect(categoria.id).toBe('c1')
    expect(categoria.nombre).toBe('Bolsas')
  })
  it('nombreNormalizado ignora mayúsculas, tildes y espacios repetidos (igual que RN-CAT-01)', () => {
    const categoria = Categoria.crear('c1', 'Carbón y combustibles')
    expect(categoria.nombreNormalizado).toBe('carbon y combustibles')
    expect(Categoria.crear('c2', 'carbon y combustibles').nombreNormalizado).toBe(
      categoria.nombreNormalizado,
    )
  })
  it('renombrar cambia el nombre', () => {
    const categoria = Categoria.crear('c1', 'Bolsas')
    categoria.renombrar('Bolsas y envoltorios')
    expect(categoria.nombre).toBe('Bolsas y envoltorios')
  })
  it('ida y vuelta aRegistro / desdeRegistro', () => {
    const categoria = Categoria.crear('c1', 'Carbón y combustibles')
    const registro = categoria.aRegistro()
    expect(registro).toEqual({
      id: 'c1',
      nombre: 'Carbón y combustibles',
      nombreNormalizado: 'carbon y combustibles',
    })
    expect(Categoria.desdeRegistro(registro).aRegistro()).toEqual(registro)
  })
})

describe('CATEGORIAS_INICIALES', () => {
  it('tiene las 10 categorías iniciales en el orden de la spec', () => {
    expect(CATEGORIAS_INICIALES).toEqual([
      'Lejías y desinfectantes',
      'Detergentes y jabones',
      'Lavavajillas',
      'Limpiadores y ceras',
      'Papel y descartables',
      'Bolsas',
      'Escobas, trapeadores y accesorios',
      'Ambientadores e insecticidas',
      'Carbón y combustibles',
      'Otros',
    ])
  })
})

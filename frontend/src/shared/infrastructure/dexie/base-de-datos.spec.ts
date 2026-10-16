// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CLAVE_DE_TABLA, type NombreDeTabla } from '../../contratos/registros'
import { crearBaseDePrueba, IDBFactory } from './__pruebas__/base-de-prueba'
import { BaseDeDatos, NOMBRE_DE_LA_BASE, VERSION_DE_LA_BASE } from './base-de-datos'

const TABLAS = Object.keys(CLAVE_DE_TABLA) as NombreDeTabla[]

describe('BaseDeDatos (Dexie)', () => {
  it('se llama predictive-inventory y está en la versión 1', async () => {
    const db = crearBaseDePrueba()
    await db.open()
    expect(db.name).toBe('predictive-inventory')
    expect(NOMBRE_DE_LA_BASE).toBe('predictive-inventory')
    expect(db.verno).toBe(VERSION_DE_LA_BASE)
    expect(VERSION_DE_LA_BASE).toBe(1)
  })

  it('tiene las tablas de la app, cada una con la clave primaria de CLAVE_DE_TABLA', async () => {
    const db = crearBaseDePrueba()
    await db.open()
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLAS].sort())
    const claves = Object.fromEntries(TABLAS.map((t) => [t, db.table(t).schema.primKey.keyPath]))
    expect(claves).toEqual(CLAVE_DE_TABLA)
  })

  it('tiene los índices del esquema (versión 1)', async () => {
    const db = crearBaseDePrueba()
    await db.open()
    const indices = (tabla: NombreDeTabla) =>
      db
        .table(tabla)
        .schema.indexes.map((i) => (i.multi ? `*${i.name}` : i.name))
        .sort()
    expect(indices('productos')).toEqual(['categoriaId', 'estado', 'nombreNormalizado'])
    expect(indices('categorias')).toEqual(['nombreNormalizado'])
    expect(indices('operaciones')).toEqual([
      '*productoIds',
      'anulaA',
      'ocurridaEn',
      'registradaEn',
      'tipo',
    ])
    expect(indices('resumenes')).toEqual(['[productoId+dia]', 'dia', 'productoId'])
    const sinIndices = [
      'existencias',
      'configuracion',
      'avisos',
      'listaDeCompras',
      'conteo',
      'fotos',
    ]
    expect(sinIndices.map((t) => [t, indices(t as NombreDeTabla)])).toEqual(
      sinIndices.map((t) => [t, []]),
    )
  })

  it('los datos sobreviven a cerrar y volver a abrir la base', async () => {
    const fabrica = new IDBFactory()
    const primera = crearBaseDePrueba(fabrica)
    await primera.categorias.put({ id: 'c1', nombre: 'Otros', nombreNormalizado: 'otros' })
    primera.close()

    const segunda = crearBaseDePrueba(fabrica)
    expect(await segunda.categorias.get('c1')).toEqual({
      id: 'c1',
      nombre: 'Otros',
      nombreNormalizado: 'otros',
    })
  })

  it('sin opciones usa el IndexedDB del entorno', () => {
    expect(new BaseDeDatos()).toBeInstanceOf(BaseDeDatos)
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { crearBaseDePrueba } from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import {
  categoriaDe,
  probarRepositoriosDeCatalogo,
  productoDe,
} from '../__pruebas__/contrato-de-repositorios'
import {
  RepositorioDeCategoriasDexie,
  RepositorioDeFotosDexie,
  RepositorioDeProductosDexie,
} from './repositorios'

probarRepositoriosDeCatalogo('Dexie', {
  productos: () => new RepositorioDeProductosDexie(crearBaseDePrueba()),
  categorias: () => new RepositorioDeCategoriasDexie(crearBaseDePrueba()),
  fotos: () => new RepositorioDeFotosDexie(crearBaseDePrueba()),
})

describe('Repositorios de Catálogo en Dexie: lo guardado está en sus tablas', () => {
  it('productos, categorías y fotos se guardan como registros en su tabla', async () => {
    const db = crearBaseDePrueba()
    await new RepositorioDeProductosDexie(db).guardar(productoDe())
    await new RepositorioDeCategoriasDexie(db).guardar(categoriaDe())
    await new RepositorioDeFotosDexie(db).guardar({
      productoId: 'p1',
      imagen: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    })
    expect(await db.productos.get('p1')).toEqual(productoDe())
    expect(await db.categorias.get('c1')).toEqual(categoriaDe())
    expect((await db.fotos.get('p1'))?.imagen).toBeInstanceOf(Blob)
  })
})

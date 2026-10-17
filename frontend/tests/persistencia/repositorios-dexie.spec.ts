// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { RepositorioDeAvisosDexie, type RepositorioDeAvisos } from '@/modules/alertas'
import {
  RepositorioDeListaDeComprasDexie,
  RepositorioDeResumenesDexie,
  type RepositorioDeListaDeCompras,
  type RepositorioDeResumenes,
} from '@/modules/analisis'
import {
  RepositorioDeCategoriasDexie,
  RepositorioDeFotosDexie,
  RepositorioDeProductosDexie,
  type RepositorioDeCategorias,
  type RepositorioDeFotos,
  type RepositorioDeProductos,
} from '@/modules/catalogo'
import {
  RepositorioDeConteoDexie,
  RepositorioDeExistenciasDexie,
  RepositorioDeOperacionesDexie,
  type RepositorioDeConteo,
  type RepositorioDeExistencias,
  type RepositorioDeOperaciones,
} from '@/modules/inventario'
import { AlmacenDeRespaldoDexie, type AlmacenDeRespaldo } from '@/modules/respaldo'
import { RepositorioDeConfiguracionDexie, type RepositorioDeConfiguracion } from '@/modules/tienda'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import { crearBaseDePrueba } from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import { UnidadDeTrabajoDexie } from '@/shared/infrastructure/dexie/unidad-de-trabajo-dexie'

/** Lo que la composición (Ola 3) arma sobre una sola base: un adaptador Dexie por puerto. */
interface PersistenciaDexie {
  uow: UnidadDeTrabajo
  productos: RepositorioDeProductos
  categorias: RepositorioDeCategorias
  fotos: RepositorioDeFotos
  operaciones: RepositorioDeOperaciones
  existencias: RepositorioDeExistencias
  conteo: RepositorioDeConteo
  resumenes: RepositorioDeResumenes
  listaDeCompras: RepositorioDeListaDeCompras
  avisos: RepositorioDeAvisos
  configuracion: RepositorioDeConfiguracion
  almacenDeRespaldo: AlmacenDeRespaldo
}

describe('Persistencia Dexie desde la API pública de los módulos', () => {
  it('cada puerto de repositorio tiene su implementación Dexie y todas comparten la base', async () => {
    const db = crearBaseDePrueba()
    const p: PersistenciaDexie = {
      uow: new UnidadDeTrabajoDexie(db),
      productos: new RepositorioDeProductosDexie(db),
      categorias: new RepositorioDeCategoriasDexie(db),
      fotos: new RepositorioDeFotosDexie(db),
      operaciones: new RepositorioDeOperacionesDexie(db),
      existencias: new RepositorioDeExistenciasDexie(db),
      conteo: new RepositorioDeConteoDexie(db),
      resumenes: new RepositorioDeResumenesDexie(db),
      listaDeCompras: new RepositorioDeListaDeComprasDexie(db),
      avisos: new RepositorioDeAvisosDexie(db),
      configuracion: new RepositorioDeConfiguracionDexie(db),
      almacenDeRespaldo: new AlmacenDeRespaldoDexie(db),
    }

    await p.uow.ejecutar(async () => {
      await p.categorias.guardar({ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' })
      await p.avisos.guardar({ productoId: 'lejia', ultimoEstadoAvisado: 'AGOTADO' })
    })

    const copia = await p.almacenDeRespaldo.leerTodo()
    expect(copia.categorias).toEqual([{ id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' }])
    expect(copia.avisos).toEqual([{ productoId: 'lejia', ultimoEstadoAvisado: 'AGOTADO' }])
  })
})

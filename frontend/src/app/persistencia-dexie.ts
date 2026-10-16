import { RepositorioDeAvisosDexie } from '@/modules/alertas'
import { RepositorioDeListaDeComprasDexie, RepositorioDeResumenesDexie } from '@/modules/analisis'
import {
  RepositorioDeCategoriasDexie,
  RepositorioDeFotosDexie,
  RepositorioDeProductosDexie,
} from '@/modules/catalogo'
import {
  RepositorioDeConteoDexie,
  RepositorioDeExistenciasDexie,
  RepositorioDeOperacionesDexie,
} from '@/modules/inventario'
import { AlmacenDeRespaldoDexie } from '@/modules/respaldo'
import { RepositorioDeConfiguracionDexie } from '@/modules/tienda'
import type { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import { UnidadDeTrabajoDexie } from '@/shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import type { Infraestructura } from './composicion'

export type PersistenciaDeLaApp = Pick<
  Infraestructura,
  'uow' | 'repositorios' | 'almacenDeRespaldo'
>

/**
 * La persistencia de la app sobre UNA base Dexie: la unidad de trabajo, un repositorio por
 * puerto y el almacén de respaldo. La usan el navegador y la aplicación de prueba con
 * fake-indexeddb, así las dos componen exactamente lo mismo.
 */
export function crearPersistenciaDexie(db: BaseDeDatos): PersistenciaDeLaApp {
  return {
    uow: new UnidadDeTrabajoDexie(db),
    repositorios: {
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
    },
    almacenDeRespaldo: new AlmacenDeRespaldoDexie(db),
  }
}

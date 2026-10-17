// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { crearBaseDePrueba } from '../../../../shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import {
  NEGOCIO,
  probarRepositorioDeConfiguracion,
  SISTEMA,
} from '../__pruebas__/contrato-de-repositorio'
import { RepositorioDeConfiguracionDexie } from './repositorio'

describe('RepositorioDeConfiguracionDexie', () => {
  probarRepositorioDeConfiguracion(() => new RepositorioDeConfiguracionDexie(crearBaseDePrueba()))

  it('negocio y sistema son dos filas de la tabla configuracion (claves "negocio" y "sistema")', async () => {
    const db = crearBaseDePrueba()
    const repo = new RepositorioDeConfiguracionDexie(db)
    await repo.guardarNegocio(NEGOCIO)
    await repo.guardarSistema(SISTEMA)
    expect((await db.configuracion.toArray()).map((r) => r.clave).sort()).toEqual([
      'negocio',
      'sistema',
    ])
  })
})

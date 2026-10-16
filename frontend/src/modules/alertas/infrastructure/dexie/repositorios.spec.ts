// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { crearBaseDePrueba } from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import { probarRepositorioDeAvisos } from '../__pruebas__/contrato-de-repositorios'
import { RepositorioDeAvisosDexie } from './repositorios'

describe('RepositorioDeAvisosDexie', () => {
  probarRepositorioDeAvisos(() => new RepositorioDeAvisosDexie(crearBaseDePrueba()))

  it('guarda los registros en la tabla avisos', async () => {
    const db = crearBaseDePrueba()
    await new RepositorioDeAvisosDexie(db).guardar({
      productoId: 'p1',
      ultimoEstadoAvisado: 'AGOTADO',
    })
    expect(await db.avisos.get('p1')).toEqual({ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' })
  })
})

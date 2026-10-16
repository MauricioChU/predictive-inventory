import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { probarRepositoriosDeInventario, registro } from '../__pruebas__/contrato-de-repositorios'
import {
  RepositorioDeConteoEnMemoria,
  RepositorioDeExistenciasEnMemoria,
  RepositorioDeOperacionesEnMemoria,
} from './repositorios'

probarRepositoriosDeInventario('EnMemoria', {
  operaciones: () => new RepositorioDeOperacionesEnMemoria(new AlmacenEnMemoria()),
  existencias: () => new RepositorioDeExistenciasEnMemoria(new AlmacenEnMemoria()),
  conteo: () => new RepositorioDeConteoEnMemoria(new AlmacenEnMemoria()),
})

describe('Repositorios de Inventario en memoria: lo guardado está en sus tablas', () => {
  it('la operación y la existencia se guardan como registros en su tabla', async () => {
    const almacen = new AlmacenEnMemoria()
    await new RepositorioDeOperacionesEnMemoria(almacen).agregar(registro('op-1'))
    await new RepositorioDeExistenciasEnMemoria(almacen).fijar(
      'carbon',
      Cantidad.deTexto('1.25', 'KILO'),
    )
    expect(almacen.obtener('operaciones', 'op-1')).toEqual(registro('op-1'))
    expect(almacen.obtener('existencias', 'carbon')).toEqual({
      productoId: 'carbon',
      cantidad: 1250,
    })
  })
})

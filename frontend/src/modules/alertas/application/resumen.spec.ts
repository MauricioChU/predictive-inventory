import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearContextoDePrueba, crearSituacion } from '../__pruebas__/dobles'
import { resumenDeAtencion } from './resumen'

function prepararContexto(ahora?: string) {
  const almacen = new AlmacenEnMemoria()
  return crearContextoDePrueba(new UnidadDeTrabajoEnMemoria(almacen), almacen, ahora)
}

describe('resumenDeAtencion (RN-AL-06)', () => {
  it('RN-AL-06: cuenta agotados y por acabarse de los productos activos; NORMAL no cuenta', async () => {
    const { dependencias, analisisFalso } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Lejía 1 L',
        estado: 'AGOTADO',
        stock: Cantidad.cero(),
      }),
      crearSituacion({
        productoId: 'p2',
        nombre: 'Carbón',
        estado: 'POR_ACABARSE',
        stock: Cantidad.deEntero(2),
      }),
      crearSituacion({
        productoId: 'p3',
        nombre: 'Bolsas',
        estado: 'NORMAL',
        stock: Cantidad.deEntero(200),
      }),
    ]

    const resumen = await resumenDeAtencion(dependencias)

    expect(resumen).toEqual({
      agotados: 1,
      porAcabarse: 1,
      contador: 2,
      texto: '1 agotado y 1 por acabarse',
    })
  })

  it('RN-AL-06: sin nada que atender: Todo bien', async () => {
    const { dependencias, analisisFalso } = prepararContexto()
    analisisFalso.situacionesActuales = [
      crearSituacion({
        productoId: 'p1',
        nombre: 'Bolsas',
        estado: 'NORMAL',
        stock: Cantidad.deEntero(200),
      }),
    ]

    const resumen = await resumenDeAtencion(dependencias)

    expect(resumen).toEqual({
      agotados: 0,
      porAcabarse: 0,
      contador: 0,
      texto: 'Todo bien: no falta nada',
    })
  })
})

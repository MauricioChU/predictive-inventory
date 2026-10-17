import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearContextoDePrueba, crearSituacion } from '../__pruebas__/dobles'
import { cerrarResumenDelDia, resumenDeAtencion, resumenDelDia } from './resumen'

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

describe('resumenDelDia y cerrarResumenDelDia (RN-AL-09)', () => {
  it('RN-AL-09: se muestra la primera vez del día con las tres líneas exactas', async () => {
    const { dependencias, analisisFalso } = prepararContexto('2026-10-15T15:00:00.000Z')
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
    ]
    analisisFalso.fijarTotalesDeDia({
      dia: '2026-10-14',
      ventas: Dinero.deCentimos(10000),
      costoVendido: Dinero.cero(),
      gananciaBruta: Dinero.cero(),
      mermas: Dinero.cero(),
      gananciaNeta: Dinero.deCentimos(4820),
      diferenciasDeConteo: Dinero.cero(),
    })

    const resumen = await resumenDelDia(dependencias)

    expect(resumen).toEqual({ lineas: ['1 agotado', '1 por acabarse', 'Ayer ganaste S/ 48.20'] })
  })

  it('RN-AL-09: tras cerrarlo, no vuelve a aparecer el mismo día', async () => {
    const { dependencias } = prepararContexto('2026-10-15T15:00:00.000Z')

    await cerrarResumenDelDia(dependencias)
    const resumen = await resumenDelDia(dependencias)

    expect(resumen).toBeNull()
  })

  it('RN-AL-09: al día siguiente vuelve a aparecer', async () => {
    const { dependencias, reloj } = prepararContexto('2026-10-15T15:00:00.000Z')

    await cerrarResumenDelDia(dependencias)
    reloj.fijar('2026-10-16T09:00:00.000Z')
    const resumen = await resumenDelDia(dependencias)

    expect(resumen).not.toBeNull()
  })

  it('RN-AL-09: el día de negocio es el de Lima, no el de UTC', async () => {
    const { dependencias, reloj } = prepararContexto('2026-10-15T15:00:00.000Z')
    await cerrarResumenDelDia(dependencias)

    reloj.fijar('2026-10-16T03:00:00.000Z') // 22:00 del 15 en Lima
    expect(await resumenDelDia(dependencias)).toBeNull()

    reloj.fijar('2026-10-16T05:00:00.000Z') // 00:00 del 16 en Lima
    expect(await resumenDelDia(dependencias)).not.toBeNull()
  })

  it('RN-AL-08: resumenDelDia y resumenDeAtencion nunca piden permiso', async () => {
    const { dependencias, notificador } = prepararContexto()

    await resumenDelDia(dependencias)
    await resumenDeAtencion(dependencias)

    expect(notificador.solicitudes).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { BusEnMemoria, type EventoDeDominio } from '@/shared/domain/eventos'
import { instanteLocal } from '@/shared/domain/fecha'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { Operacion } from '../domain/operacion'
import type { DatosDeProducto } from '../domain/reglas'
import {
  RepositorioDeExistenciasEnMemoria,
  RepositorioDeOperacionesEnMemoria,
} from '../infrastructure/memoria/repositorios'
import { ProyeccionEspia } from '../__pruebas__/dobles'
import { LibroDeOperaciones } from './registrar'

const AHORA = instanteLocal('2026-10-15 10:00')
const soles = (texto: string) => Dinero.deTexto(texto)
const unidades = (n: number) => Cantidad.deEntero(n)

const PRODUCTOS = new Map<string, DatosDeProducto>([
  ['lejia', { nombre: 'Lejía 1 L', unidad: 'UNIDAD' }],
  ['carbon', { nombre: 'Carbón', unidad: 'KILO' }],
])

const datos = (id: string) => ({ id, ocurridaEn: AHORA, registradaEn: AHORA, dispositivoId: 'd' })

const stockInicial = (id: string, productoId: string, cantidad: number) =>
  Operacion.stockInicial(datos(id), {
    productoId,
    cantidad: unidades(cantidad),
    costoUnitario: soles('2.40'),
  })

const venta = (id: string, ...lineas: [string, number][]) =>
  Operacion.venta(
    datos(id),
    lineas.map(([productoId, cantidad]) => ({
      productoId,
      cantidad: unidades(cantidad),
      precioUnitario: soles('3.50'),
      costoUnitario: soles('2.40'),
    })),
  )

function preparar() {
  const almacen = new AlmacenEnMemoria()
  const operaciones = new RepositorioDeOperacionesEnMemoria(almacen)
  const existencias = new RepositorioDeExistenciasEnMemoria(almacen)
  const transacciones = new UnidadDeTrabajoEnMemoria(almacen)
  const bitacora: string[] = []
  const uow: UnidadDeTrabajo = {
    async ejecutar(trabajo) {
      const resultado = await transacciones.ejecutar(trabajo)
      bitacora.push('confirmada')
      return resultado
    },
  }
  const bus = new BusEnMemoria()
  const eventos: EventoDeDominio[] = []
  const anotar = (evento: EventoDeDominio) => {
    eventos.push(evento)
    bitacora.push(`evento ${evento.tipo}`)
  }
  bus.suscribir('OperacionRegistrada', anotar)
  bus.suscribir('OperacionAnulada', anotar)
  const proyeccion = new ProyeccionEspia()
  const ofertas: { operacionId: string; registradaEn: string }[] = []
  const libro = new LibroDeOperaciones({
    operaciones,
    existencias,
    uow,
    bus,
    proyecciones: () => [proyeccion],
    alConfirmarRegistro: (operacionId, registradaEn) => {
      ofertas.push({ operacionId, registradaEn })
      bitacora.push('deshacer ofrecido')
    },
  })
  return { almacen, operaciones, existencias, bitacora, eventos, proyeccion, ofertas, libro }
}

describe('LibroDeOperaciones.registrar', () => {
  it('RN-OP-01: guarda la operación y fija la existencia resultante de cada producto', async () => {
    const { libro, operaciones, existencias } = preparar()
    await libro.registrar(stockInicial('op-1', 'lejia', 10))
    await libro.registrar(venta('op-2', ['lejia', 3]), PRODUCTOS)
    expect((await operaciones.todas()).map((r) => r.id)).toEqual(['op-1', 'op-2'])
    expect(await existencias.obtener('lejia')).toEqual(unidades(7))
  })

  it('las proyecciones reciben el registro exacto que se guardó', async () => {
    const { libro, operaciones, proyeccion } = preparar()
    const operacion = stockInicial('op-1', 'lejia', 10)
    await libro.registrar(operacion)
    expect(proyeccion.registradas).toEqual([operacion.aRegistro()])
    expect(proyeccion.registradas[0]).toEqual(await operaciones.porId('op-1'))
  })

  it('RN-OP-18: los eventos se publican solo tras confirmar, y después se ofrece deshacer', async () => {
    const { libro, bitacora, eventos, ofertas } = preparar()
    await libro.registrar(stockInicial('op-1', 'lejia', 10))
    expect(bitacora).toEqual(['confirmada', 'evento OperacionRegistrada', 'deshacer ofrecido'])
    expect(eventos).toEqual([
      {
        tipo: 'OperacionRegistrada',
        operacionId: 'op-1',
        tipoOperacion: 'STOCK_INICIAL',
        productoIds: ['lejia'],
      },
    ])
    expect(ofertas).toEqual([{ operacionId: 'op-1', registradaEn: AHORA }])
  })

  it('RN-OP-06: si una proyección lanza en alRegistrar, no queda guardada ni la operación ni la existencia', async () => {
    const { libro, operaciones, existencias, proyeccion, eventos, ofertas } = preparar()
    proyeccion.fallarAlRegistrar = true
    await expect(libro.registrar(stockInicial('op-1', 'lejia', 10))).rejects.toThrow(
      'La proyección falló',
    )
    expect(await operaciones.todas()).toEqual([])
    expect(await existencias.todas()).toEqual(new Map())
    expect(eventos).toEqual([])
    expect(ofertas).toEqual([])
  })

  it('RN-OP-05 / RN-OP-06: si una línea no alcanza, no se registra ninguna', async () => {
    const { libro, operaciones, existencias, eventos } = preparar()
    await libro.registrar(stockInicial('op-1', 'lejia', 10))
    await libro.registrar(stockInicial('op-2', 'carbon', 10))
    await expect(
      libro.registrar(venta('op-3', ['lejia', 2], ['carbon', 20]), PRODUCTOS),
    ).rejects.toThrow('Solo quedan 10 kg de Carbón')
    expect((await operaciones.todas()).map((r) => r.id)).toEqual(['op-1', 'op-2'])
    expect(await existencias.obtener('lejia')).toEqual(unidades(10))
    expect(await existencias.obtener('carbon')).toEqual(unidades(10))
    expect(eventos).toHaveLength(2)
  })

  it('RN-OP-06: varias escrituras en una transacción se confirman juntas o ninguna', async () => {
    const { libro, operaciones, eventos } = preparar()
    await expect(
      libro.enTransaccion(async (escritura) => {
        await escritura.registrar(stockInicial('op-1', 'lejia', 10))
        await escritura.registrar(venta('op-2', ['lejia', 11]), PRODUCTOS)
      }),
    ).rejects.toThrow('Solo quedan 10 unid. de Lejía 1 L')
    expect(await operaciones.todas()).toEqual([])
    expect(eventos).toEqual([])

    const resultado = await libro.enTransaccion(async (escritura) => {
      await escritura.registrar(stockInicial('op-1', 'lejia', 10))
      await escritura.registrar(venta('op-2', ['lejia', 4]), PRODUCTOS)
      return 'listo'
    })
    expect(resultado).toBe('listo')
    expect(eventos.map((e) => e.tipo === 'OperacionRegistrada' && e.operacionId)).toEqual([
      'op-1',
      'op-2',
    ])
  })

  it('una anulación no se escribe con registrar', async () => {
    const { libro } = preparar()
    const original = stockInicial('op-1', 'lejia', 10)
    await expect(libro.registrar(Operacion.anulacionDe(original, datos('op-2')))).rejects.toThrow(
      'Una anulación se escribe con anular()',
    )
  })
})

describe('LibroDeOperaciones.anular', () => {
  it('RN-OP-17: guarda la anulación, revierte la existencia y avisa a las proyecciones con la original', async () => {
    const { libro, operaciones, existencias, proyeccion, eventos, ofertas, bitacora } = preparar()
    await libro.registrar(stockInicial('op-1', 'lejia', 10))
    const original = venta('op-2', ['lejia', 2])
    await libro.registrar(original, PRODUCTOS)
    bitacora.length = 0
    const anulacion = Operacion.anulacionDe(original, datos('op-3'))
    await libro.anular(original, anulacion, PRODUCTOS)

    expect(await operaciones.anulacionDe('op-2')).toEqual(anulacion.aRegistro())
    expect(await existencias.obtener('lejia')).toEqual(unidades(10))
    expect(proyeccion.anuladas).toEqual([
      { original: original.aRegistro(), anulacion: anulacion.aRegistro() },
    ])
    expect(eventos.at(-1)).toEqual({
      tipo: 'OperacionAnulada',
      operacionId: 'op-2',
      anulacionId: 'op-3',
      productoIds: ['lejia'],
    })
    expect(bitacora).toEqual(['confirmada', 'evento OperacionAnulada'])
    expect(ofertas.map((o) => o.operacionId)).toEqual(['op-1', 'op-2'])
  })

  it('RN-OP-17: se rechaza si dejaría stock negativo', async () => {
    const { libro, existencias } = preparar()
    const ingreso = stockInicial('op-1', 'lejia', 3)
    await libro.registrar(ingreso)
    await libro.registrar(venta('op-2', ['lejia', 2]), PRODUCTOS)
    await expect(
      libro.anular(ingreso, Operacion.anulacionDe(ingreso, datos('op-3')), PRODUCTOS),
    ).rejects.toThrow('Solo queda 1 unid. de Lejía 1 L')
    expect(await existencias.obtener('lejia')).toEqual(unidades(1))
  })

  it('la anulación debe apuntar a la operación original', async () => {
    const { libro } = preparar()
    const una = stockInicial('op-1', 'lejia', 3)
    const otra = stockInicial('op-2', 'lejia', 3)
    await expect(libro.anular(una, Operacion.anulacionDe(otra, datos('op-3')))).rejects.toThrow(
      'La anulación op-3 no revierte a op-1',
    )
  })
})

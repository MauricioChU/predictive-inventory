// @vitest-environment node
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearBaseDePrueba } from '../../../../shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import type { BaseDeDatos } from '../../../../shared/infrastructure/dexie/base-de-datos'
import { UnidadDeTrabajoDexie } from '../../../../shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import type { ProductoRegistro } from '../../../../shared/contratos/registros'
import type { DatosDelRespaldo } from '../../domain/formato-de-respaldo'
import { Cantidad } from '../../../../shared/domain/cantidad'
import { instanteLocal } from '../../../../shared/domain/fecha'
import { RelojFijo } from '../../../../shared/domain/reloj'
import {
  AnalisisDePrueba,
  CatalogoDePrueba,
  TiendaDePrueba,
} from '../../application/__pruebas__/dobles'
import { guardarCopia, restaurarCopia } from '../../application/copia'
import type { DependenciasDeRespaldo } from '../../application/puertos'
import {
  AlmacenamientoPersistenteEnMemoria,
  GeneradorDeExcelEnMemoria,
  LectorDeExcelEnMemoria,
} from '../memoria/dobles'
import {
  DATOS_VACIOS,
  operacion,
  probarAlmacenDeRespaldo,
  producto,
  type EntornoDeAlmacenDeRespaldo,
} from '../__pruebas__/contrato-de-almacen-de-respaldo'
import { AlmacenDeRespaldoDexie } from './almacen-de-respaldo'

function entorno(db: BaseDeDatos = crearBaseDePrueba()): EntornoDeAlmacenDeRespaldo {
  return {
    almacen: new AlmacenDeRespaldoDexie(db),
    async sembrar(tabla, ...registros) {
      await db.table(tabla).bulkPut(registros)
    },
    leer(tabla) {
      return db.table(tabla).toArray()
    },
  }
}

/** Dependencias de Respaldo sobre IndexedDB: almacén y unidad de trabajo Dexie; el
 * reconstructor y las existencias leen y escriben las mismas tablas (solo peticiones de IndexedDB). */
function dependenciasSobre(db: BaseDeDatos): DependenciasDeRespaldo {
  const tienda = new TiendaDePrueba()
  tienda.fijarConfiguracion({ nombreTienda: 'Bodega Rosita' })
  const catalogo = new CatalogoDePrueba()
  const analisis = new AnalisisDePrueba()
  return {
    almacen: new AlmacenDeRespaldoDexie(db),
    reconstructor: {
      async reconstruirTodo() {
        const totales = new Map<string, number>()
        for (const op of await db.operaciones.toArray()) {
          for (const m of op.movimientos) {
            totales.set(m.productoId, (totales.get(m.productoId) ?? 0) + m.cantidad)
          }
        }
        await db.existencias.clear()
        await db.existencias.bulkPut(
          [...totales].map(([productoId, cantidad]) => ({ productoId, cantidad })),
        )
      },
    },
    generadorDeExcel: new GeneradorDeExcelEnMemoria(),
    lectorDeExcel: new LectorDeExcelEnMemoria(),
    almacenamiento: new AlmacenamientoPersistenteEnMemoria(),
    uow: new UnidadDeTrabajoDexie(db),
    reloj: new RelojFijo(instanteLocal('2026-10-15 20:30')),
    catalogo: () => catalogo,
    inventario: () => ({
      stockDe: async (id) => Cantidad.deMilesimas((await db.existencias.get(id))?.cantidad ?? 0),
      existencias: async () =>
        new Map(
          (await db.existencias.toArray()).map((e) => [
            e.productoId,
            Cantidad.deMilesimas(e.cantidad),
          ]),
        ),
      tieneOperaciones: async (id) =>
        (await db.operaciones.where('productoIds').equals(id).count()) > 0,
      ultimoIngresoDe: async () => null,
      operaciones: () => db.operaciones.toArray(),
    }),
    analisis: () => analisis,
    tienda: () => tienda,
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

/**
 * Como en el navegador: `blob.arrayBuffer()` termina en otra vuelta del bucle de eventos (en
 * Node termina enseguida y una transacción de IndexedDB sobreviviría a la espera).
 */
function arrayBufferLento(alLeer: () => void = () => undefined) {
  const original = Blob.prototype.arrayBuffer
  return vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(async function (this: Blob) {
    alLeer()
    await esperar(5)
    return original.call(this)
  })
}

describe('AlmacenDeRespaldoDexie', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  probarAlmacenDeRespaldo(() => entorno())

  it('RN-RE-02: lee todo en una transacción y convierte las fotos después de cerrarla', async () => {
    const db = crearBaseDePrueba()
    const e = entorno(db)
    await e.sembrar('productos', producto('lejia'), producto('carbon'))
    await e.sembrar(
      'fotos',
      {
        productoId: 'lejia',
        imagen: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
      },
      { productoId: 'carbon', imagen: new Blob([new Uint8Array([4])], { type: 'image/png' }) },
    )
    const transaccionAlConvertir: boolean[] = []
    arrayBufferLento(() => transaccionAlConvertir.push(Dexie.currentTransaction?.active ?? false))
    const transaccion = vi.spyOn(db, 'transaction')

    const datos = await e.almacen.leerTodo()

    expect(transaccion).toHaveBeenCalledTimes(1)
    expect(transaccion.mock.calls[0]?.[0]).toBe('r!')
    expect(transaccionAlConvertir).toEqual([false, false])
    expect([...datos.fotos].sort((a, b) => a.productoId.localeCompare(b.productoId))).toEqual([
      { productoId: 'carbon', tipo: 'image/png', base64: 'BA==' },
      { productoId: 'lejia', tipo: 'image/jpeg', base64: 'AQID' },
    ])
  })

  it('RN-RE-02: lo que se confirma mientras se convierten las fotos no entra en la copia', async () => {
    const db = crearBaseDePrueba()
    const e = entorno(db)
    await e.sembrar('productos', producto('lejia'))
    await e.sembrar('operaciones', operacion('op-1'))
    await e.sembrar('fotos', { productoId: 'lejia', imagen: new Blob([new Uint8Array([1])]) })
    let durante: Promise<void> | null = null
    arrayBufferLento(() => {
      durante ??= new UnidadDeTrabajoDexie(db).ejecutar(async () => {
        await db.operaciones.add(operacion('op-durante', '2026-10-02T05:00:00.000Z'))
        await db.productos.put(producto('nuevo'))
      })
    })

    const datos = await e.almacen.leerTodo()
    await durante

    expect(datos.operaciones.map((o) => o.id)).toEqual(['op-1'])
    expect(datos.productos.map((p) => p.id)).toEqual(['lejia'])
    expect(await db.operaciones.count()).toBe(2)
  })

  it('leerTodo no se llama dentro de una unidad de trabajo (las fotos no se pueden convertir ahí)', async () => {
    const db = crearBaseDePrueba()
    await expect(
      new UnidadDeTrabajoDexie(db).ejecutar(() => new AlmacenDeRespaldoDexie(db).leerTodo()),
    ).rejects.toThrow('leerTodo abre su propia transacción')
  })

  it('leerTodo desde una continuación de una transacción ya terminada abre su propia transacción de lectura', async () => {
    const db = crearBaseDePrueba()
    const e = entorno(db)
    await e.sembrar('productos', producto('lejia'))
    let seConfirmo!: () => void
    // El `then` de una promesa de Dexie corre en la zona donde se encadenó: la de una
    // transacción que para entonces ya se confirmó (Dexie.currentTransaction, inactiva).
    const confirmada = new Dexie.Promise<void>((resolver) => (seConfirmo = resolver))
    let lectura: Promise<DatosDelRespaldo> | null = null
    await new UnidadDeTrabajoDexie(db).ejecutar(async () => {
      await db.operaciones.add(operacion('op-1'))
      lectura = confirmada.then(() => {
        expect(Dexie.currentTransaction?.active).toBe(false)
        return e.almacen.leerTodo()
      })
    })
    seConfirmo()
    const datos = await lectura!
    expect(datos.operaciones.map((o) => o.id)).toEqual(['op-1'])
    expect(datos.productos.map((p) => p.id)).toEqual(['lejia'])
  })

  it('leerTodo devuelve las operaciones en orden de registro', async () => {
    const e = entorno()
    await e.sembrar(
      'operaciones',
      operacion('c', '2026-10-01T05:00:00.000Z'),
      operacion('a', '2026-10-03T05:00:00.000Z'),
      operacion('b', '2026-10-02T05:00:00.000Z'),
    )
    expect((await e.almacen.leerTodo()).operaciones.map((o) => o.id)).toEqual(['c', 'b', 'a'])
  })

  it('RN-RE-04: reemplazarTodo es atómico: si un registro no se puede guardar, no cambia nada', async () => {
    const e = entorno()
    await e.sembrar('productos', producto('viejo'))
    await e.sembrar('existencias', { productoId: 'viejo', cantidad: 5000 })
    const sinId = { ...producto('x'), id: undefined } as unknown as ProductoRegistro
    await expect(
      e.almacen.reemplazarTodo({ ...DATOS_VACIOS, productos: [producto('lejia'), sinId] }),
    ).rejects.toThrow()
    expect((await e.leer('productos')).map((p) => p.id)).toEqual(['viejo'])
    expect(await e.leer('existencias')).toEqual([{ productoId: 'viejo', cantidad: 5000 }])
  })

  it('RN-RE-04: dentro de una unidad de trabajo que falla después, reemplazarTodo se revierte', async () => {
    const db = crearBaseDePrueba()
    const e = entorno(db)
    await e.sembrar('productos', producto('viejo'))
    await expect(
      new UnidadDeTrabajoDexie(db).ejecutar(async () => {
        await e.almacen.reemplazarTodo({
          ...DATOS_VACIOS,
          productos: [producto('lejia')],
          fotos: [{ productoId: 'lejia', tipo: 'image/png', base64: 'CQgH' }],
        })
        expect((await db.productos.toArray()).map((p) => p.id)).toEqual(['lejia'])
        throw new Error('La copia tiene datos que no cuadran. No se cambió nada')
      }),
    ).rejects.toThrow('La copia tiene datos que no cuadran')
    expect((await e.leer('productos')).map((p) => p.id)).toEqual(['viejo'])
    expect(await e.leer('fotos')).toEqual([])
  })

  it('RN-RE-02/03: guardar la copia y restaurarla funciona sobre IndexedDB aunque leer las fotos tarde', async () => {
    const db = crearBaseDePrueba()
    const e = entorno(db)
    await e.sembrar('categorias', { id: 'cat-1', nombre: 'Otros', nombreNormalizado: 'otros' })
    await e.sembrar('productos', producto('lejia'))
    await e.sembrar('operaciones', operacion('op-1'))
    await e.sembrar('existencias', { productoId: 'lejia', cantidad: 10000 })
    await e.sembrar('fotos', {
      productoId: 'lejia',
      imagen: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }),
    })
    arrayBufferLento()
    const deps = dependenciasSobre(db)

    const texto = await (await guardarCopia(deps)).contenido.text()
    await db.operaciones.add({
      ...operacion('venta-despues', '2026-10-15T15:00:00.000Z'),
      tipo: 'VENTA',
      movimientos: [
        { productoId: 'lejia', cantidad: -5000, costoUnitario: 240, precioUnitario: 350 },
      ],
    })
    await db.existencias.put({ productoId: 'lejia', cantidad: 5000 })

    await restaurarCopia(deps, texto, { confirmaciones: 2 })

    expect(await db.existencias.toArray()).toEqual([{ productoId: 'lejia', cantidad: 10000 }])
    expect((await db.operaciones.toArray()).map((o) => o.id)).toEqual(['op-1'])
    const foto = await db.fotos.get('lejia')
    vi.restoreAllMocks()
    expect([...new Uint8Array(await foto!.imagen.arrayBuffer())]).toEqual([9, 8, 7])
  })
})

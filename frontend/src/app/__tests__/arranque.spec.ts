import { mount } from '@vue/test-utils'
import Dexie from 'dexie'
import { IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificadorDelSistema } from '@/modules/alertas'
import { ProcesadorDeFotosCanvas } from '@/modules/catalogo'
import {
  AlmacenamientoPersistenteDelNavegador,
  GeneradorDeExcelDelNavegador,
  LectorDeExcelDelNavegador,
} from '@/modules/respaldo'
import {
  BaseDeDatos,
  ESQUEMA_V1,
  NOMBRE_DE_LA_BASE,
} from '@/shared/infrastructure/dexie/base-de-datos'
import {
  crearBaseDePrueba,
  IDBFactory,
} from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import { arrancar } from '../arranque'
import {
  crearInfraestructuraDelNavegador,
  vigilarVersionDeLaBase,
  type InfraestructuraDelNavegador,
} from '../infraestructura-navegador'
import { motivoDelError } from '../motivo-sin-datos'
import PantallaSinDatos from '../vistas/PantallaSinDatos.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('crearInfraestructuraDelNavegador', () => {
  it('ADR-0001: Dexie y los adaptadores reales del navegador', () => {
    const infraestructura = crearInfraestructuraDelNavegador(crearBaseDePrueba())

    expect(infraestructura.notificador).toBeInstanceOf(NotificadorDelSistema)
    expect(infraestructura.procesadorDeFotos).toBeInstanceOf(ProcesadorDeFotosCanvas)
    expect(infraestructura.generadorDeExcel).toBeInstanceOf(GeneradorDeExcelDelNavegador)
    expect(infraestructura.lectorDeExcel).toBeInstanceOf(LectorDeExcelDelNavegador)
    expect(infraestructura.almacenamiento).toBeInstanceOf(AlmacenamientoPersistenteDelNavegador)
    expect(infraestructura.reloj.ahora()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(infraestructura.ids.nuevo()).not.toBe(infraestructura.ids.nuevo())
  })

  it('por defecto usa la base "predictive-inventory"', () => {
    const db = new BaseDeDatos()
    crearInfraestructuraDelNavegador(db)
    expect(db.name).toBe('predictive-inventory')
  })
})

describe('vigilarVersionDeLaBase', () => {
  it('si otra pestaña abre una versión más nueva, cierra la conexión (sin reabrirla) y avisa', async () => {
    const fabrica = new IDBFactory()
    const db = crearBaseDePrueba(fabrica)
    const alActualizarse = vi.fn()
    vigilarVersionDeLaBase(db, alActualizarse)
    await db.open()

    const nueva = new Dexie(NOMBRE_DE_LA_BASE, { indexedDB: fabrica, IDBKeyRange })
    nueva.version(2).stores(ESQUEMA_V1)
    await nueva.open() // no queda bloqueada: la vieja cerró

    expect(alActualizarse).toHaveBeenCalledOnce()
    expect(db.isOpen()).toBe(false)
    await expect(db.table('productos').count()).rejects.toThrow()
    nueva.close()
  })

  it('si una pestaña vieja no suelta la base, la apertura avisa con console.warn y sigue al liberarse', async () => {
    const fabrica = new IDBFactory()
    const vieja = await new Promise<IDBDatabase>((resolver, rechazar) => {
      const pedido = fabrica.open(NOMBRE_DE_LA_BASE, 1)
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => rechazar(pedido.error)
    })
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const db = crearBaseDePrueba(fabrica)
    vigilarVersionDeLaBase(db, vi.fn())

    const abriendo = db.open()
    await vi.waitFor(() =>
      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('otra pestaña')),
    )
    vieja.close()

    await expect(abriendo).resolves.toBe(db)
    db.close()
  })
})

describe('motivoDelError', () => {
  function deDexie(nombre: string, interno?: unknown): Error {
    return Object.assign(new Error(nombre), { name: nombre, inner: interno })
  }

  it.each([
    ['sin IndexedDB (MissingAPIError)', deDexie('MissingAPIError'), 'sin-indexeddb'],
    [
      'apertura rechazada en una ventana privada',
      deDexie('OpenFailedError', new DOMException('privada', 'InvalidStateError')),
      'sin-indexeddb',
    ],
    ['almacenamiento bloqueado', new DOMException('bloqueado', 'SecurityError'), 'sin-indexeddb'],
    ['sin espacio', new DOMException('lleno', 'QuotaExceededError'), 'sin-espacio'],
    [
      'sin espacio dentro de un error de Dexie',
      deDexie('AbortError', new DOMException('lleno', 'QuotaExceededError')),
      'sin-espacio',
    ],
    [
      'sin espacio como causa',
      new Error('al guardar', { cause: deDexie('QuotaExceededError') }),
      'sin-espacio',
    ],
    ['cualquier otra cosa', new Error('algo raro'), 'otro'],
    ['algo que no es un error', 'texto', 'otro'],
  ])('%s', (_caso, error, motivo) => {
    expect(motivoDelError(error)).toBe(motivo)
  })
})

describe('arrancar', () => {
  function pasos(crearInfraestructura: () => InfraestructuraDelNavegador) {
    return { crearInfraestructura, montar: vi.fn(), mostrarError: vi.fn() }
  }

  it('abre la base, compone la aplicación, la abre y recién entonces monta', async () => {
    const p = pasos(() => crearInfraestructuraDelNavegador(crearBaseDePrueba()))

    await arrancar(p)

    expect(p.mostrarError).not.toHaveBeenCalled()
    expect(p.montar).toHaveBeenCalledOnce()
    const [aplicacion, inicio] = p.montar.mock.calls[0]!
    expect(inicio).toMatchObject({ primeraVez: true, tamanoDeLetra: 'GRANDE' })
    expect(await aplicacion.catalogo.listarCategorias()).toHaveLength(10)
  })

  it('M1: pide el almacenamiento persistente DESPUÉS de montar y sin esperarlo (aunque nunca conteste)', async () => {
    const orden: string[] = []
    const p = pasos(() => {
      const infraestructura = crearInfraestructuraDelNavegador(crearBaseDePrueba())
      infraestructura.almacenamiento = {
        solicitar: () => {
          orden.push('pide almacenamiento')
          return new Promise<boolean>(() => undefined)
        },
      }
      return infraestructura
    })
    p.montar.mockImplementation(() => orden.push('monta'))

    await arrancar(p)
    await vi.waitFor(() => expect(orden).toEqual(['monta', 'pide almacenamiento']))
    expect(p.mostrarError).not.toHaveBeenCalled()
  })

  it('I2: si fallan las lecturas de Análisis (resumenes.entre), la app monta igual', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const p = pasos(() => {
      const infraestructura = crearInfraestructuraDelNavegador(crearBaseDePrueba())
      infraestructura.repositorios.resumenes.entre = () => Promise.reject(new Error('lectura rota'))
      return infraestructura
    })

    await arrancar(p)

    expect(p.mostrarError).not.toHaveBeenCalled()
    expect(p.montar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resumenDelDia: null }),
    )
  })

  it('I2: si no se puede sembrar las categorías, la app monta igual', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const p = pasos(() => {
      const infraestructura = crearInfraestructuraDelNavegador(crearBaseDePrueba())
      infraestructura.repositorios.categorias.guardar = () => Promise.reject(new Error('rota'))
      return infraestructura
    })

    await arrancar(p)

    expect(p.montar).toHaveBeenCalledOnce()
    expect(p.mostrarError).not.toHaveBeenCalled()
  })

  it('si el navegador no tiene IndexedDB (o lo bloquea), muestra la pantalla sin datos y no monta', async () => {
    // jsdom no trae IndexedDB: como una ventana privada que no deja guardar datos.
    const p = pasos(() => crearInfraestructuraDelNavegador(new BaseDeDatos()))

    await arrancar(p)

    expect(p.montar).not.toHaveBeenCalled()
    expect(p.mostrarError).toHaveBeenCalledOnce()
    expect(motivoDelError(p.mostrarError.mock.calls[0]![0])).toBe('sin-indexeddb')
  })

  it('si no hay espacio para crear el estado del sistema, muestra el error de espacio', async () => {
    const sinEspacio = new DOMException('lleno', 'QuotaExceededError')
    const p = pasos(() => {
      const infraestructura = crearInfraestructuraDelNavegador(crearBaseDePrueba())
      infraestructura.repositorios.configuracion.guardarSistema = () => Promise.reject(sinEspacio)
      return infraestructura
    })

    await arrancar(p)

    expect(p.montar).not.toHaveBeenCalled()
    expect(p.mostrarError).toHaveBeenCalledOnce()
    // Dexie lo envuelve en su propio QuotaExceededError: el motivo sale igual.
    expect(motivoDelError(p.mostrarError.mock.calls[0]![0])).toBe('sin-espacio')
  })

  it('un error al montar no se disfraza como un problema de datos', async () => {
    const alMontar = new Error('falla al montar')
    const p = pasos(() => crearInfraestructuraDelNavegador(crearBaseDePrueba()))
    p.montar.mockImplementation(() => {
      throw alMontar
    })

    await expect(arrancar(p)).rejects.toBe(alMontar)
    expect(p.mostrarError).not.toHaveBeenCalled()
  })
})

describe('PantallaSinDatos', () => {
  it.each([
    [
      'sin-indexeddb',
      'No pudimos abrir tus datos',
      'Si abriste la app en una ventana privada o de incógnito, ábrela en una ventana normal.',
      'Intentar de nuevo',
    ],
    [
      'sin-espacio',
      'No pudimos abrir tus datos',
      'Tu celular no tiene espacio libre para guardar datos. Libera espacio y vuelve a abrir la app.',
      'Intentar de nuevo',
    ],
    [
      'otro',
      'No pudimos abrir tus datos',
      'Cierra y vuelve a abrir la app. Si sigue pasando, avísale a quien te ayuda con la app.',
      'Intentar de nuevo',
    ],
    ['actualizada', 'La app se actualizó', '', 'Toca para volver a abrirla'],
  ] as const)(
    'RN-UX-07 (%s): dice qué pasó y qué hacer, y el botón vuelve a abrir la app',
    async (motivo, titulo, texto, boton) => {
      const alReintentar = vi.fn()
      const envoltura = mount(PantallaSinDatos, { props: { motivo, alReintentar } })

      expect(envoltura.get('h1').text()).toBe(titulo)
      expect(envoltura.text()).toContain(texto)
      expect(envoltura.get('button').text()).toBe(boton)
      await envoltura.get('button').trigger('click')
      expect(alReintentar).toHaveBeenCalledOnce()
    },
  )
})

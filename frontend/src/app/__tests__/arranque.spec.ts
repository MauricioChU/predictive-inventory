import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { NotificadorDelSistema } from '@/modules/alertas'
import { ProcesadorDeFotosCanvas } from '@/modules/catalogo'
import {
  AlmacenamientoPersistenteDelNavegador,
  GeneradorDeExcelDelNavegador,
  LectorDeExcelDelNavegador,
} from '@/modules/respaldo'
import { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import { crearBaseDePrueba } from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import { arrancar } from '../arranque'
import { crearInfraestructuraDelNavegador } from '../infraestructura-navegador'
import ErrorDeArranque from '../vistas/ErrorDeArranque.vue'

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

describe('arrancar', () => {
  it('abre la base, compone la aplicación, la abre y recién entonces monta', async () => {
    const montar = vi.fn()
    const mostrarError = vi.fn()

    await arrancar({
      crearInfraestructura: () => crearInfraestructuraDelNavegador(crearBaseDePrueba()),
      montar,
      mostrarError,
    })

    expect(mostrarError).not.toHaveBeenCalled()
    expect(montar).toHaveBeenCalledOnce()
    const [aplicacion, inicio] = montar.mock.calls[0]!
    expect(inicio).toMatchObject({ primeraVez: true, tamanoDeLetra: 'GRANDE' })
    expect(await aplicacion.catalogo.listarCategorias()).toHaveLength(10)
  })

  it('si el navegador no tiene IndexedDB (o lo bloquea), muestra el error amable y no monta', async () => {
    const montar = vi.fn()
    const mostrarError = vi.fn()

    // jsdom no trae IndexedDB: como una ventana privada que no deja guardar datos.
    await arrancar({
      crearInfraestructura: () => crearInfraestructuraDelNavegador(new BaseDeDatos()),
      montar,
      mostrarError,
    })

    expect(montar).not.toHaveBeenCalled()
    expect(mostrarError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('si falla al abrir la app (p. ej. sin espacio), también muestra el error', async () => {
    const montar = vi.fn()
    const mostrarError = vi.fn()
    const sinEspacio = new Error('QuotaExceededError')

    await arrancar({
      crearInfraestructura: () => {
        const infraestructura = crearInfraestructuraDelNavegador(crearBaseDePrueba())
        infraestructura.repositorios.configuracion.guardarSistema = () => Promise.reject(sinEspacio)
        return infraestructura
      },
      montar,
      mostrarError,
    })

    expect(montar).not.toHaveBeenCalled()
    expect(mostrarError).toHaveBeenCalledWith(sinEspacio)
  })

  it('un error al montar no se disfraza como un problema de datos', async () => {
    const mostrarError = vi.fn()
    const alMontar = new Error('falla al montar')

    await expect(
      arrancar({
        crearInfraestructura: () => crearInfraestructuraDelNavegador(crearBaseDePrueba()),
        montar: () => {
          throw alMontar
        },
        mostrarError,
      }),
    ).rejects.toBe(alMontar)
    expect(mostrarError).not.toHaveBeenCalled()
  })
})

describe('ErrorDeArranque', () => {
  it('RN-UX-07: dice qué pasó y qué hacer, y ofrece intentar de nuevo', async () => {
    const alReintentar = vi.fn()
    const envoltura = mount(ErrorDeArranque, { props: { alReintentar } })

    expect(envoltura.get('h1').text()).toBe('No pudimos abrir tus datos')
    expect(envoltura.text()).toContain('ábrela en una ventana normal')
    await envoltura.get('button').trigger('click')
    expect(alReintentar).toHaveBeenCalledOnce()
  })
})

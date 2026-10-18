import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useEstadoGlobal } from '@/app/estado-global'
import router, { rutas } from '@/router'
import { instalarGuardiaDeLaPrimeraVez } from '../primera-vez'

/** RN-UX-16: mientras falte la primera vez, la app no tiene otra pantalla que la bienvenida. */
function crearRouterConGuardia() {
  const enrutador = createRouter({ history: createMemoryHistory(), routes: rutas })
  instalarGuardiaDeLaPrimeraVez(enrutador)
  return enrutador
}

function fijarPrimeraVez(pendiente: boolean): void {
  const pinia = createPinia()
  setActivePinia(pinia)
  useEstadoGlobal(pinia).primeraVez = pendiente
}

describe('guardia global de la primera vez (RN-UX-16)', () => {
  describe('con la primera vez pendiente', () => {
    beforeEach(() => fijarPrimeraVez(true))

    it.each([
      '/',
      '/vender',
      '/recibir',
      '/productos',
      '/control',
      '/ajustes',
      '/historial',
      '/contar',
    ])('%s termina en la bienvenida', async (camino) => {
      const enrutador = crearRouterConGuardia()
      await enrutador.push(camino)
      expect(enrutador.currentRoute.value.fullPath).toBe('/bienvenida')
    })

    it('una ruta que no existe termina en la bienvenida', async () => {
      const enrutador = crearRouterConGuardia()
      await enrutador.push('/esto-no-existe')
      expect(enrutador.currentRoute.value.fullPath).toBe('/bienvenida')
    })

    it.each([
      ['/bienvenida', 'primera-vez'],
      ['/bienvenida?paso=nombre', 'primera-vez'],
      ['/ajustes/restaurar', 'restaurar-copia'],
      ['/ajustes/restaurar?desde=primera-vez', 'restaurar-copia'],
      ['/productos/nuevo', 'producto-nuevo'],
      ['/ajustes/importar', 'importar-productos'],
    ])('%s se permite', async (camino, nombre) => {
      const enrutador = crearRouterConGuardia()
      await enrutador.push(camino)
      expect(enrutador.currentRoute.value.name).toBe(nombre)
      expect(enrutador.currentRoute.value.fullPath).toBe(camino)
    })

    it('la ruta que se pidió no se recuerda: al terminar no hay a dónde "volver"', async () => {
      const enrutador = crearRouterConGuardia()
      await enrutador.push('/vender')
      expect(enrutador.currentRoute.value.redirectedFrom?.fullPath).toBe('/vender')
      expect(enrutador.currentRoute.value.query).toEqual({})
    })
  })

  describe('con la primera vez completada', () => {
    beforeEach(() => fijarPrimeraVez(false))

    it.each([
      ['/', 'inicio'],
      ['/vender', 'vender'],
      ['/control', 'control'],
      ['/ajustes', 'ajustes'],
      ['/ajustes/restaurar', 'restaurar-copia'],
      ['/productos/nuevo', 'producto-nuevo'],
    ])('%s no se redirige', async (camino, nombre) => {
      const enrutador = crearRouterConGuardia()
      await enrutador.push(camino)
      expect(enrutador.currentRoute.value.name).toBe(nombre)
      expect(enrutador.currentRoute.value.fullPath).toBe(camino)
    })

    it('la bienvenida sin paso ya no se repite: lleva a Inicio', async () => {
      const enrutador = crearRouterConGuardia()
      await enrutador.push('/bienvenida')
      expect(enrutador.currentRoute.value.name).toBe('inicio')
    })

    it('una ruta que no existe lleva a Inicio', async () => {
      const enrutador = crearRouterConGuardia()
      await enrutador.push('/esto-no-existe')
      expect(enrutador.currentRoute.value.name).toBe('inicio')
    })
  })

  describe('sin la aplicación montada (sin Pinia activa)', () => {
    it('no hay estado que mirar: no redirige', async () => {
      setActivePinia(undefined)
      const enrutador = crearRouterConGuardia()
      await enrutador.push('/vender')
      expect(enrutador.currentRoute.value.name).toBe('vender')
    })
  })

  it('el router de la app ya trae la guardia instalada', async () => {
    fijarPrimeraVez(true)
    await router.push('/vender')
    expect(router.currentRoute.value.fullPath).toBe('/bienvenida')
  })
})

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { RUTA_PARA_COMPRAR } from '@/modules/alertas'
import { rutas } from '@/router'

// Plan 13 (contrato de rutas de la Ola 4): Control, Para comprar y ¿Necesito comprar?
describe('rutas de Control', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: rutas })

  it.each([
    ['control', '/control', 'Control'],
    ['para-comprar', '/control/para-comprar', 'Para comprar'],
    ['necesito-comprar', '/control/necesito-comprar', '¿Necesito comprar?'],
  ])('"%s" está en %s con el título "%s"', (nombre, camino, titulo) => {
    const ruta = router.resolve({ name: nombre })
    expect(ruta.path).toBe(camino)
    expect(ruta.meta.titulo).toBe(titulo)
  })

  it('M5: la notificación de "Para comprar" abre esa pantalla (no cae en Inicio)', () => {
    expect(router.resolve(RUTA_PARA_COMPRAR).name).toBe('para-comprar')
  })

  it('solo Control va en la navegación; las otras dos se abren desde pantallas', () => {
    const enNavegacion = (nombre: string) => router.resolve({ name: nombre }).meta.enNavegacion
    expect(enNavegacion('control')).toBe(true)
    expect(enNavegacion('para-comprar')).toBeFalsy()
    expect(enNavegacion('necesito-comprar')).toBeFalsy()
  })
})

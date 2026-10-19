import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { RUTA_SE_ACABAN } from '@/modules/alertas'
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

  it('RN-AL-07: la notificación de varios avisos abre Productos filtrado por "Se acaban"', () => {
    const destino = router.resolve(RUTA_SE_ACABAN)
    expect(destino.name).toBe('productos')
    expect(destino.query).toEqual({ estado: 'se-acaban' })
  })

  it('solo Control va en la navegación; las otras dos se abren desde pantallas', () => {
    const enNavegacion = (nombre: string) => router.resolve({ name: nombre }).meta.enNavegacion
    expect(enNavegacion('control')).toBe(true)
    expect(enNavegacion('para-comprar')).toBeFalsy()
    expect(enNavegacion('necesito-comprar')).toBeFalsy()
  })
})

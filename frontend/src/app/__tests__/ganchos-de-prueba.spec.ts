import { afterEach, describe, expect, it } from 'vitest'
import { crearAnunciador } from '@/shared/ui/anunciador'
import { crearContextoAvisoDeshacer } from '../aviso-deshacer'
import { exponerGanchosDePrueba } from '../ganchos-de-prueba'

describe('m11: ganchos para las pruebas E2E (solo desarrollo o navegador automatizado)', () => {
  afterEach(() => {
    delete window.__pruebas
  })

  it('en desarrollo expone mostrarAvisoDeshacer, que muestra el aviso global, y se retira al llamar a la limpieza', () => {
    const contexto = crearContextoAvisoDeshacer(crearAnunciador())
    const retirar = exponerGanchosDePrueba(contexto)
    window.__pruebas?.mostrarAvisoDeshacer('Venta registrada')
    expect(contexto.activo.value).toMatchObject({ mensaje: 'Venta registrada' })
    retirar()
    expect(window.__pruebas).toBeUndefined()
  })

  it('RN-OP-18: el gancho no puede cambiar los 10 s del aviso', () => {
    const contexto = crearContextoAvisoDeshacer(crearAnunciador())
    const retirar = exponerGanchosDePrueba(contexto)
    const mostrar = window.__pruebas?.mostrarAvisoDeshacer as unknown as (
      ...args: unknown[]
    ) => void
    mostrar('Venta registrada', 60)
    expect(contexto.activo.value).not.toHaveProperty('segundos')
    retirar()
    expect(window.__pruebas).toBeUndefined()
  })
})

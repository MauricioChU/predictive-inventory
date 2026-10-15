import { afterEach, describe, expect, it } from 'vitest'
import { crearAnunciador } from '../anunciador'
import { crearContextoAvisoDeshacer } from '../aviso-deshacer'
import { exponerGanchosDePrueba } from '../ganchos-de-prueba'

describe('m11: ganchos para las pruebas E2E (solo desarrollo o navegador automatizado)', () => {
  afterEach(() => {
    delete window.__pruebas
  })

  it('en desarrollo expone mostrarAvisoDeshacer, que muestra el aviso global, y se retira al llamar a la limpieza', () => {
    const contexto = crearContextoAvisoDeshacer(crearAnunciador())
    const retirar = exponerGanchosDePrueba(contexto)
    window.__pruebas?.mostrarAvisoDeshacer('Venta registrada', 30)
    expect(contexto.activo.value).toMatchObject({ mensaje: 'Venta registrada', segundos: 30 })
    retirar()
    expect(window.__pruebas).toBeUndefined()
  })
})

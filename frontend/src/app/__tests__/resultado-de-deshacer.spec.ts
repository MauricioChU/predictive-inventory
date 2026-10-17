import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearAnunciador, ESPERA_ANUNCIO_MS } from '@/shared/ui/anunciador'
import { ErrorDeDominio } from '@/shared/domain/errores'
import {
  crearContextoAvisoDeshacer,
  resultadoDeDeshacerFallido,
  SEGUNDOS_DEL_RESULTADO_DE_DESHACER,
} from '../aviso-deshacer'

/**
 * Plan 12, r1 #2 (RN-UX-11): después de CUALQUIER Deshacer que salió bien, la persona ve (y
 * oye) qué se deshizo, esté donde esté: lo muestra LayoutApp, una sola vez para toda la app.
 */
describe('RN-UX-11: resultado visible de un Deshacer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('se muestra, se anuncia y queda al menos 5 s (o hasta que se cierra)', async () => {
    const anunciador = crearAnunciador()
    const contexto = crearContextoAvisoDeshacer(anunciador)
    expect(contexto.resultado.value).toBeUndefined()

    contexto.mostrarResultado({ tono: 'exito', titulo: 'Deshiciste la venta de S/ 7.00' })
    expect(contexto.resultado.value).toMatchObject({
      tono: 'exito',
      titulo: 'Deshiciste la venta de S/ 7.00',
    })
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(anunciador.texto.value).toBe('Deshiciste la venta de S/ 7.00')

    expect(SEGUNDOS_DEL_RESULTADO_DE_DESHACER).toBeGreaterThanOrEqual(5)
    await vi.advanceTimersByTimeAsync(SEGUNDOS_DEL_RESULTADO_DE_DESHACER * 1000 - 200)
    expect(contexto.resultado.value, 'sigue a la vista').toBeDefined()
    await vi.advanceTimersByTimeAsync(200)
    expect(contexto.resultado.value, 'se cierra solo').toBeUndefined()

    contexto.mostrarResultado({ tono: 'atencion', titulo: 'Ya pasó el tiempo', texto: 'Anúlala' })
    contexto.cerrarResultado()
    expect(contexto.resultado.value).toBeUndefined()
  })

  it('un aviso Deshacer nuevo reemplaza al resultado anterior', () => {
    const contexto = crearContextoAvisoDeshacer(crearAnunciador())
    contexto.mostrarResultado({ tono: 'exito', titulo: 'Deshiciste la venta de S/ 7.00' })
    contexto.mostrar({ mensaje: 'Venta registrada', alDeshacer: () => {} })
    expect(contexto.resultado.value).toBeUndefined()
    expect(contexto.activo.value?.mensaje).toBe('Venta registrada')
  })
})

describe('plan 17: resultadoDeDeshacerFallido (un Deshacer que no se pudo, fuera de inventario)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('un error del dominio se dice con su mensaje (y un punto final)', () => {
    const error = new ErrorDeDominio(
      'CATEGORIA_NOMBRE_DUPLICADO',
      'Ya existe una categoría con ese nombre',
    )
    expect(resultadoDeDeshacerFallido(error)).toEqual({
      tono: 'atencion',
      titulo: 'No pudimos deshacer',
      texto: 'Ya existe una categoría con ese nombre.',
    })
    const conPunto = new ErrorDeDominio('X', 'Ya no está.')
    expect(resultadoDeDeshacerFallido(conPunto).texto).toBe('Ya no está.')
  })

  it('cualquier otro error se registra y se dice en palabras simples, con qué hacer', () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const causa = new Error('base cerrada')
    expect(resultadoDeDeshacerFallido(causa)).toEqual({
      tono: 'atencion',
      titulo: 'No pudimos deshacer',
      texto: 'Vuelve a intentarlo. Si sigue pasando, cierra la app y ábrela otra vez.',
    })
    expect(registro).toHaveBeenCalledWith('No se pudo deshacer:', causa)
  })
})

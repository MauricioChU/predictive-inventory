import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import {
  crearAplicacionDePrueba,
  type AplicacionDePrueba,
} from '../../../tests/soporte/aplicacion-de-prueba'
import { crearProductoDePrueba } from '../../../tests/soporte/productos-de-prueba'
import { abrirApp } from '../abrir-app'
import { useEstadoGlobal } from '../estado-global'

const HOY = instanteLocal('2026-10-15 08:00')
const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }

describe('estado global (Pinia)', () => {
  let app: AplicacionDePrueba

  async function conectar() {
    // Sin ventana para juntar re-evaluaciones: el contador llega enseguida (la ventana y sus
    // consecuencias se prueban en estado-global-rafaga.spec.ts).
    app = crearAplicacionDePrueba({ ahora: HOY, ventanaDeReevaluacionMs: 0 })
    const inicio = await abrirApp(app, { aplicarTamanoDeLetra: () => undefined })
    const estado = useEstadoGlobal()
    estado.conectar(app, inicio)
    await estado.refrescarAtencion()
    return estado
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(async () => {
    useEstadoGlobal().desconectar()
    vi.restoreAllMocks()
    await app.cerrar()
  })

  it('conectar toma lo que devolvió abrirApp', async () => {
    const estado = await conectar()

    expect(estado.primeraVez).toBe(true)
    expect(estado.tamanoDeLetra).toBe('GRANDE')
    expect(estado.resumenDelDia?.lineas).toHaveLength(3)
    expect(estado.recordatorioDeCopia).toBe('Todavía no guardas una copia de tus datos')
    expect(estado.contadorDeAtencion).toBe(0)
  })

  it('RN-AL-06: el contador de atención se refresca con los eventos (producto creado, venta)', async () => {
    const estado = await conectar()

    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    await vi.waitFor(() => expect(estado.contadorDeAtencion).toBe(1))

    await app.inventario.registrarIngreso({
      lineas: [{ productoId: id, cantidad: '10', costo: '2.40' }],
    })
    await vi.waitFor(() => expect(estado.contadorDeAtencion).toBe(0))

    await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: '8' }] })
    await vi.waitFor(() => expect(estado.contadorDeAtencion).toBe(1))
  })

  it('ADR-0002: los manejadores son "dispara y olvida": publicar no espera la lectura del contador', async () => {
    const estado = await conectar()
    vi.spyOn(app.analisis.consultable, 'situaciones').mockReturnValue(new Promise(() => undefined))

    const resultado = await Promise.race([
      app.bus.publicar({ tipo: 'ProductoCreado', productoId: 'x' }).then(() => 'publicó'),
      new Promise((resolver) => setTimeout(() => resolver('esperó al manejador'), 100)),
    ])

    expect(resultado).toBe('publicó')
    expect(estado.contadorDeAtencion).toBe(0)
  })

  it('varias lecturas pedidas seguidas se juntan: mientras lee, a lo sumo una más', async () => {
    const estado = await conectar()
    let terminar: () => void = () => undefined
    const leer = vi.spyOn(app.alertas, 'resumenDeAtencion').mockImplementation(
      () =>
        new Promise((resolver) => {
          terminar = () => resolver({ agotados: 0, porAcabarse: 0, contador: 0, texto: '' })
        }),
    )

    for (let i = 0; i < 5; i += 1) void estado.refrescarAtencion()
    terminar()
    await vi.waitFor(() => expect(leer).toHaveBeenCalledTimes(2))
    terminar()
    await new Promise((resolver) => setTimeout(resolver, 10))

    expect(leer).toHaveBeenCalledTimes(2)
  })

  it('RN-UX-01: al cambiar la letra en la configuración, la aplica y guarda la copia rápida', async () => {
    const estado = await conectar()

    await app.tienda.actualizarConfiguracion({ tamanoDeLetra: 'MUY_GRANDE' })

    await vi.waitFor(() => expect(estado.tamanoDeLetra).toBe('MUY_GRANDE'))
    expect(document.documentElement.dataset.letra).toBe('MUY_GRANDE')
    expect(localStorage.getItem('pi.letra')).toBe('MUY_GRANDE')
  })

  it('al completar la primera vez, primeraVez pasa a false', async () => {
    const estado = await conectar()

    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'NORMAL' })

    await vi.waitFor(() => expect(estado.primeraVez).toBe(false))
    expect(estado.tamanoDeLetra).toBe('NORMAL')
  })

  it('RN-RE-04: tras restaurar una copia recarga la letra y el contador', async () => {
    const estado = await conectar()
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
    const id = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    await app.esperarTareasPendientes()
    const copia = await (await app.respaldo.guardarCopia()).contenido.text()
    await app.inventario.registrarIngreso({
      lineas: [{ productoId: id, cantidad: '10', costo: '2.40' }],
    })
    await app.tienda.actualizarConfiguracion({ tamanoDeLetra: 'NORMAL' })
    await vi.waitFor(() => {
      expect(estado.tamanoDeLetra).toBe('NORMAL')
      expect(estado.contadorDeAtencion).toBe(0)
    })

    await app.respaldo.restaurarCopia(copia, { confirmaciones: 2 })

    await vi.waitFor(() => {
      expect(estado.tamanoDeLetra).toBe('GRANDE')
      expect(estado.contadorDeAtencion).toBe(1)
    })
    expect(document.documentElement.dataset.letra).toBe('GRANDE')
  })

  it('RN-AL-09: cerrarResumenDelDia lo quita y no vuelve a salir hoy', async () => {
    const estado = await conectar()

    await estado.cerrarResumenDelDia()

    expect(estado.resumenDelDia).toBeNull()
    expect(await app.alertas.resumenDelDia()).toBeNull()
  })

  it('RN-RE-06: refrescarRecordatorioDeCopia, después de marcar la copia guardada', async () => {
    const estado = await conectar()
    await app.respaldo.marcarCopiaGuardada()

    await estado.refrescarRecordatorioDeCopia()

    expect(estado.recordatorioDeCopia).toBeNull()
  })

  it('desconectar deja de escuchar los eventos y los resúmenes de Alertas', async () => {
    const estado = await conectar()
    const leer = vi.spyOn(app.alertas, 'resumenDeAtencion')
    estado.desconectar()

    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    await app.inventario.reconstruirExistencias()
    await app.esperarTareasPendientes()

    expect(leer).not.toHaveBeenCalled()
    expect((await app.alertas.resumenDeAtencion()).contador).toBe(1)
    expect(estado.contadorDeAtencion).toBe(0)
  })

  it('RN-AL-06: una lectura propia que termina después de un resumen de Alertas no lo pisa', async () => {
    const estado = await conectar()
    let terminar: () => void = () => undefined
    vi.spyOn(app.alertas, 'resumenDeAtencion').mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          // Lo que leyó ANTES de que se agotara el producto.
          terminar = () => resolver({ agotados: 0, porAcabarse: 0, contador: 0, texto: '' })
        }),
    )
    const lectura = estado.refrescarAtencion()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    await app.esperarTareasPendientes()
    expect(estado.contadorDeAtencion).toBe(1)

    terminar()
    await lectura
    expect(estado.contadorDeAtencion).toBe(1)
  })

  it('una actualización pedida mientras otra está en curso no se pierde si la que corría falla', async () => {
    const estado = await conectar()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fallar: (error: Error) => void = () => undefined
    const leer = vi
      .spyOn(app.alertas, 'resumenDeAtencion')
      .mockImplementationOnce(
        () =>
          new Promise((_resolver, rechazar) => {
            fallar = rechazar
          }),
      )
      .mockResolvedValue({ agotados: 1, porAcabarse: 0, contador: 1, texto: '1 agotado' })

    const primera = estado.refrescarAtencion()
    // Se pide otra mientras la primera lectura sigue en curso.
    void estado.refrescarAtencion()
    fallar(new Error('falla la primera'))
    await primera

    expect(leer).toHaveBeenCalledTimes(2)
    expect(estado.contadorDeAtencion).toBe(1)
  })

  it('un error al leer el contador se registra y no rechaza', async () => {
    const estado = await conectar()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(app.alertas, 'resumenDeAtencion').mockRejectedValue(new Error('sin base'))

    await expect(estado.refrescarAtencion()).resolves.toBeUndefined()

    expect(error).toHaveBeenCalledWith(
      'No se pudo actualizar el contador de atención:',
      expect.any(Error),
    )
    expect(estado.contadorDeAtencion).toBe(0)
  })

  it('si falla la re-evaluación, se registra, no rompe a quien publicó y el contador queda como estaba', async () => {
    const estado = await conectar()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(app.analisis.consultable, 'situaciones').mockRejectedValue(new Error('sin base'))

    await expect(
      app.bus.publicar({ tipo: 'ProductoCreado', productoId: 'x' }),
    ).resolves.toBeUndefined()
    await app.esperarTareasPendientes()

    expect(error).toHaveBeenCalledWith('Falló la evaluación de avisos:', expect.any(Error))
    expect(estado.contadorDeAtencion).toBe(0)
  })
})

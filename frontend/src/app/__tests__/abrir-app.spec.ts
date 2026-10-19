import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { instanteLocal } from '@/shared/domain/fecha'
import {
  ALMACENES,
  crearAplicacionDePrueba,
  type AplicacionDePrueba,
} from '../../../tests/soporte/aplicacion-de-prueba'
import { crearProductoDePrueba } from '../../../tests/soporte/productos-de-prueba'
import { abrirApp, pedirAlmacenamientoPersistente } from '../abrir-app'

const HOY = instanteLocal('2026-10-15 08:00')

/** 01-catalogo: las categorías iniciales (listarCategorias: por nombre y "Otros" al final). */
const CATEGORIAS_INICIALES_ESPERADAS = [
  'Ambientadores e insecticidas',
  'Bolsas',
  'Carbón y combustibles',
  'Detergentes y jabones',
  'Escobas, trapeadores y accesorios',
  'Lavavajillas',
  'Lejías y desinfectantes',
  'Limpiadores y ceras',
  'Papel y descartables',
  'Otros',
]

describe.each(ALMACENES)('abrirApp (%s)', (almacen) => {
  let app: AplicacionDePrueba
  const aplicarTamanoDeLetra = vi.fn()

  function nuevaApp(): AplicacionDePrueba {
    app = crearAplicacionDePrueba({ ahora: HOY, almacen })
    return app
  }

  afterEach(async () => {
    aplicarTamanoDeLetra.mockClear()
    vi.restoreAllMocks()
    await app.cerrar()
  })

  it('la primera vez crea el dispositivo, siembra las categorías y aplica la letra, sin pedir todavía el almacenamiento', async () => {
    nuevaApp()
    const solicitar = vi.spyOn(app.almacenamiento, 'solicitar')

    const inicio = await abrirApp(app, { aplicarTamanoDeLetra })

    expect(inicio).toEqual({
      primeraVez: true,
      tamanoDeLetra: 'GRANDE',
      resumenDelDia: { lineas: ['Nada agotado', 'Nada por acabarse', 'Ayer no hubo ventas'] },
      recordatorioDeCopia: 'Todavía no guardas una copia de tus datos',
      recordatorioDelLocal: null,
    })
    const estado = await app.tienda.consultable.estadoDelSistema()
    expect(estado.dispositivoId).toBe('id-1')
    // M1: el pedido de almacenamiento persistente va después de montar (pedirAlmacenamientoPersistente).
    expect(solicitar).not.toHaveBeenCalled()
    expect(estado.almacenamientoPersistente).toBe('DESCONOCIDO')
    expect((await app.catalogo.listarCategorias()).map((c) => c.nombre)).toEqual(
      CATEGORIAS_INICIALES_ESPERADAS,
    )
    expect(aplicarTamanoDeLetra).toHaveBeenCalledExactlyOnceWith('GRANDE')
  })

  it('RN-RE-09: pedirAlmacenamientoPersistente pregunta la primera vez y guarda la respuesta', async () => {
    nuevaApp()
    await abrirApp(app, { aplicarTamanoDeLetra })

    await pedirAlmacenamientoPersistente(app)

    expect((await app.tienda.consultable.estadoDelSistema()).almacenamientoPersistente).toBe(
      'CONCEDIDO',
    )
  })

  it('RN-RE-09: si el navegador no concede el almacenamiento, lo guarda (el recordatorio sale a los 3 días)', async () => {
    nuevaApp()
    app.almacenamiento.fijarResultado(false)

    await pedirAlmacenamientoPersistente(app)

    expect((await app.tienda.consultable.estadoDelSistema()).almacenamientoPersistente).toBe(
      'RECHAZADO',
    )
  })

  it('RN-RE-09: si pedir el almacenamiento falla, se registra y no rechaza', async () => {
    nuevaApp()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(app.almacenamiento, 'solicitar').mockRejectedValue(new Error('sin permiso'))

    await expect(pedirAlmacenamientoPersistente(app)).resolves.toBeUndefined()

    expect(error).toHaveBeenCalledWith(
      'No se pudo pedir el almacenamiento persistente:',
      expect.any(Error),
    )
  })

  it.each([
    [
      'sembrar las categorías',
      (a: AplicacionDePrueba) => vi.spyOn(a.catalogo, 'sembrarCategoriasIniciales'),
    ],
    ['el resumen del día', (a: AplicacionDePrueba) => vi.spyOn(a.alertas, 'resumenDelDia')],
    [
      'el recordatorio de copia',
      (a: AplicacionDePrueba) => vi.spyOn(a.respaldo, 'recordatorioDeCopia'),
    ],
    [
      'el recordatorio del pago del local',
      (a: AplicacionDePrueba) => vi.spyOn(a.alertas, 'recordatorioDelLocal'),
    ],
  ])('si falla %s, lo registra y la app abre igual', async (_paso, espiar) => {
    nuevaApp()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    espiar(app).mockRejectedValue(new Error('falla un paso'))

    const inicio = await abrirApp(app, { aplicarTamanoDeLetra })

    expect(inicio.primeraVez).toBe(true)
    expect(inicio.tamanoDeLetra).toBe('GRANDE')
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^No se pudo /), expect.any(Error))
  })

  it('RN-AL-10: con el pago del local a la vista, entrega el recordatorio; sin él, null', async () => {
    nuevaApp()
    expect((await abrirApp(app, { aplicarTamanoDeLetra })).recordatorioDelLocal).toBeNull()

    await app.tienda.actualizarConfiguracion({
      alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 120000, dias: [17] },
    })
    const inicio = await abrirApp(app, { aplicarTamanoDeLetra })

    expect(inicio.recordatorioDelLocal).toBe('Pasado mañana pagas el local: S/ 1 200.00')
  })

  it('si fallan las lecturas de Análisis (resumen y avisos), la app abre igual sin resumen del día', async () => {
    nuevaApp()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    app.infraestructura.repositorios.resumenes.entre = () =>
      Promise.reject(new Error('lectura rota'))

    const inicio = await abrirApp(app, { aplicarTamanoDeLetra })
    await app.esperarTareasPendientes()

    expect(inicio).toMatchObject({ primeraVez: true, resumenDelDia: null })
    expect(error).toHaveBeenCalledWith('No se pudo preparar el resumen del día:', expect.any(Error))
    expect(error).toHaveBeenCalledWith('Falló la evaluación de avisos:', expect.any(Error))
  })

  it.each([
    [
      'el estado del sistema',
      (a: AplicacionDePrueba) => vi.spyOn(a.tienda.consultable, 'estadoDelSistema'),
    ],
    ['la configuración', (a: AplicacionDePrueba) => vi.spyOn(a.tienda, 'obtenerConfiguracion')],
  ])('sin %s no se puede abrir: el error llega a quien arranca', async (_paso, espiar) => {
    nuevaApp()
    const sinDatos = new Error('no se pudo leer')
    espiar(app).mockRejectedValue(sinDatos)

    await expect(abrirApp(app, { aplicarTamanoDeLetra })).rejects.toBe(sinDatos)
  })

  it('RN-AL-02: al abrir se re-evalúan los avisos aunque no haya pasado ninguna operación', async () => {
    nuevaApp()
    await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
    const id = await crearProductoDePrueba(app, {
      nombre: 'Lejía 1 L',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stockInicial: '5',
    })
    await app.esperarTareasPendientes()
    // Cambia sin evento (como la predicción con el paso de los días).
    await app.infraestructura.repositorios.existencias.fijar(id, Cantidad.cero())
    expect(app.notificador.mostradas).toEqual([])

    await abrirApp(app, { aplicarTamanoDeLetra })
    await app.esperarTareasPendientes()

    expect(app.notificador.mostradas).toEqual([
      { texto: 'Se acabó: Lejía 1 L', url: `/productos/${id}` },
    ])
  })

  it('RN-RE-09: al volver a abrir no pide otra vez el almacenamiento, no duplica categorías y usa la letra elegida', async () => {
    nuevaApp()
    await abrirApp(app, { aplicarTamanoDeLetra })
    await pedirAlmacenamientoPersistente(app)
    const { dispositivoId } = await app.tienda.consultable.estadoDelSistema()
    await app.tienda.completarPrimeraVez({
      nombreTienda: 'Bodega Rosita',
      tamanoDeLetra: 'MUY_GRANDE',
    })
    const solicitar = vi.spyOn(app.almacenamiento, 'solicitar')

    const inicio = await abrirApp(app, { aplicarTamanoDeLetra })
    await pedirAlmacenamientoPersistente(app)

    expect(inicio.primeraVez).toBe(false)
    expect(inicio.tamanoDeLetra).toBe('MUY_GRANDE')
    expect(aplicarTamanoDeLetra).toHaveBeenLastCalledWith('MUY_GRANDE')
    expect(solicitar).not.toHaveBeenCalled()
    expect(await app.catalogo.listarCategorias()).toHaveLength(
      CATEGORIAS_INICIALES_ESPERADAS.length,
    )
    expect((await app.tienda.consultable.estadoDelSistema()).dispositivoId).toBe(dispositivoId)
  })

  it('RN-AL-09: el resumen del día no vuelve a salir el mismo día, sí al día siguiente', async () => {
    nuevaApp()
    await abrirApp(app, { aplicarTamanoDeLetra })
    await app.alertas.cerrarResumenDelDia()

    expect((await abrirApp(app, { aplicarTamanoDeLetra })).resumenDelDia).toBeNull()

    app.reloj.fijar(instanteLocal('2026-10-16 08:00'))
    expect((await abrirApp(app, { aplicarTamanoDeLetra })).resumenDelDia).not.toBeNull()
  })
})

describe('abrirApp con la letra de la UI', () => {
  it('RN-UX-01: por defecto aplica la letra en <html> y en la copia rápida de localStorage', async () => {
    const app = crearAplicacionDePrueba({ ahora: HOY })
    await app.tienda.actualizarConfiguracion({ tamanoDeLetra: 'NORMAL' })

    await abrirApp(app)

    expect(document.documentElement.dataset.letra).toBe('NORMAL')
    expect(localStorage.getItem('pi.letra')).toBe('NORMAL')
    await app.cerrar()
  })
})

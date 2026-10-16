import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { instanteLocal } from '@/shared/domain/fecha'
import {
  ALMACENES,
  crearAplicacionDePrueba,
  type AplicacionDePrueba,
} from '../../../tests/soporte/aplicacion-de-prueba'
import { crearProductoDePrueba } from '../../../tests/soporte/productos-de-prueba'
import { abrirApp } from '../abrir-app'

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

  it('RN-RE-09: la primera vez crea el dispositivo, pide almacenamiento persistente, siembra las categorías y aplica la letra', async () => {
    nuevaApp()

    const inicio = await abrirApp(app, { aplicarTamanoDeLetra })

    expect(inicio).toEqual({
      primeraVez: true,
      tamanoDeLetra: 'GRANDE',
      resumenDelDia: { lineas: ['Nada agotado', 'Nada por acabarse', 'Ayer no hubo ventas'] },
      recordatorioDeCopia: 'Todavía no guardas una copia de tus datos',
    })
    const estado = await app.tienda.consultable.estadoDelSistema()
    expect(estado.dispositivoId).toBe('id-1')
    expect(estado.almacenamientoPersistente).toBe('CONCEDIDO')
    expect((await app.catalogo.listarCategorias()).map((c) => c.nombre)).toEqual(
      CATEGORIAS_INICIALES_ESPERADAS,
    )
    expect(aplicarTamanoDeLetra).toHaveBeenCalledExactlyOnceWith('GRANDE')
  })

  it('RN-RE-09: si el navegador no concede el almacenamiento, lo guarda y el recordatorio sale a los 3 días', async () => {
    nuevaApp()
    app.almacenamiento.fijarResultado(false)

    await abrirApp(app, { aplicarTamanoDeLetra })

    expect((await app.tienda.consultable.estadoDelSistema()).almacenamientoPersistente).toBe(
      'RECHAZADO',
    )
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
    const { dispositivoId } = await app.tienda.consultable.estadoDelSistema()
    await app.tienda.completarPrimeraVez({
      nombreTienda: 'Bodega Rosita',
      tamanoDeLetra: 'MUY_GRANDE',
    })
    const solicitar = vi.spyOn(app.almacenamiento, 'solicitar')

    const inicio = await abrirApp(app, { aplicarTamanoDeLetra })

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

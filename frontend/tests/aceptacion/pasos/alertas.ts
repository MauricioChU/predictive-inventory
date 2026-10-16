import { createPinia } from 'pinia'
import { expect } from 'vitest'
import { useEstadoGlobal } from '@/app/estado-global'
import { RUTA_PARA_COMPRAR } from '@/modules/alertas'
import type { EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import { sumarDias } from '@/shared/domain/fecha'
import { PRESENTACION_DE_ESTADO, type EstadoVisual } from '@/shared/ui/presentacion-estado'
import type { Mundo } from './mundo'
import { accion, afirmacion, preparacion, type Pasos } from './registro'

/** Adónde lleva tocar una notificación, por el nombre de la pantalla (M5: rutas del plan 13). */
const RUTAS_DE_PANTALLA: Record<string, string> = { 'Para comprar': RUTA_PARA_COMPRAR }

/**
 * "El estado guardado / el último aviso de X fue Y" (RN-AL-02/03/04). Es el dato que guarda
 * Alertas (`RepositorioDeAvisos`, sin registro = NORMAL). Con los `.feature` actuales el flujo
 * real ya lo deja así (crear el producto con ese stock avisó ese estado), y el paso solo lo
 * comprueba. Si algún día no coincidiera, EXCEPCIÓN documentada: se fija en el repositorio,
 * porque el paso habla justamente de ese dato guardado.
 */
async function fijarEstadoAvisado(m: Mundo, nombre: string, estado: string): Promise<void> {
  const productoId = await m.idDe(nombre)
  const repositorio = m.app.infraestructura.repositorios.avisos
  const guardado =
    (await repositorio.todos()).find((r) => r.productoId === productoId)?.ultimoEstadoAvisado ??
    'NORMAL'
  if (guardado === estado) return
  await m.app.infraestructura.uow.ejecutar(() =>
    repositorio.guardar({ productoId, ultimoEstadoAvisado: estado as EstadoDeStock }),
  )
}

/** Pasos de Alertas (03-alertas, RN-AL). */
export function pasosDeAlertas(pasos: Pasos): void {
  afirmacion(
    pasos,
    'el estado de {string} es {string}',
    async (m: Mundo, nombre: string, estado: string) => {
      const situacion = await m.app.analisis.consultable.situacion(await m.idDe(nombre))
      expect(situacion?.estado).toBe(estado)
    },
  )

  preparacion(pasos, 'el estado guardado de {string} es {string}', fijarEstadoAvisado)
  preparacion(pasos, 'el último aviso de {string} fue {string}', fijarEstadoAvisado)

  afirmacion(pasos, '{string} no tiene estado de stock', async (m: Mundo, nombre: string) => {
    expect(await m.app.analisis.consultable.situacion(await m.idDe(nombre))).toBeNull()
  })

  afirmacion(pasos, 'no hay avisos', async (m: Mundo) => {
    expect(m.app.notificador.mostradas).toEqual([])
    expect((await m.app.alertas.resumenDeAtencion()).contador).toBe(0)
  })

  // RN-AL-07, EXCEPCIÓN a "solo casos de uso": los productos de la tabla ya avisaron uno por
  // uno al crearse; el escenario dice que no hay avisos anteriores, así que se borra lo que
  // guarda Alertas (cada producto vuelve a "sin aviso") y el registro del doble de notificador.
  preparacion(pasos, 'ningún producto tiene avisos anteriores', async (m: Mundo) => {
    const { uow, repositorios } = m.app.infraestructura
    await uow.ejecutar(async () => {
      for (const aviso of await repositorios.avisos.todos()) {
        await repositorios.avisos.eliminar(aviso.productoId)
      }
    })
    m.app.notificador.mostradas.length = 0
  })

  afirmacion(pasos, 'se envía la notificación {string}', (m: Mundo, texto: string) => {
    const notificacion = m.app.notificador.mostradas.find((n) => n.texto === texto)
    expect(
      notificacion,
      `Se enviaron: ${JSON.stringify(m.app.notificador.mostradas.map((n) => n.texto))}`,
    ).toBeDefined()
    m.ultimaNotificacion = notificacion ?? null
  })

  afirmacion(pasos, 'se enviaron {string} notificaciones en total', (m: Mundo, total: string) => {
    expect(m.app.notificador.mostradas).toHaveLength(Number(total))
  })

  afirmacion(pasos, 'no se envía ninguna notificación del sistema', (m: Mundo) => {
    expect(m.app.notificador.mostradas).toEqual([])
  })

  afirmacion(pasos, 'Inicio muestra {string}', async (m: Mundo, texto: string) => {
    expect(await m.lineasDeInicio()).toContain(texto)
  })

  // RN-AL-06b: el número sale del estado global (el mismo store que alimenta a
  // BarraNavegacion.contadorControl), conectado a la aplicación como en main.ts.
  afirmacion(
    pasos,
    'el botón {string} muestra el número {string}',
    async (m: Mundo, boton: string, numero: string) => {
      expect(boton).toBe('Control')
      const estado = useEstadoGlobal(createPinia())
      const desconectar = estado.conectar(m.app, {
        primeraVez: false,
        tamanoDeLetra: 'GRANDE',
        resumenDelDia: null,
        recordatorioDeCopia: null,
      })
      try {
        await estado.refrescarAtencion()
        expect(estado.contadorDeAtencion).toBe(Number(numero))
      } finally {
        desconectar()
      }
    },
  )

  // RN-AL-05: la presentación única que usa InsigniaEstado (shared/ui/presentacion-estado).
  afirmacion(
    pasos,
    'el estado {string} se muestra con color {string}, ícono {string} y texto {string}',
    (_m: Mundo, estado: string, color: string, icono: string, texto: string) => {
      const presentacion = PRESENTACION_DE_ESTADO[estado as EstadoVisual]
      expect({
        color: presentacion.color,
        icono: presentacion.icono,
        texto: presentacion.texto,
      }).toEqual({ color, icono, texto })
    },
  )

  afirmacion(pasos, 'al tocar la notificación se abre {string}', (m: Mundo, pantalla: string) => {
    const ruta = RUTAS_DE_PANTALLA[pantalla]
    if (!ruta) throw new Error(`El paso no conoce la ruta de "${pantalla}"`)
    expect(m.ultimaNotificacion?.url).toBe(ruta)
  })

  // RN-AL-08: lo que pidió la última acción ("abro la app", "toco 'Sí, avísame'").
  afirmacion(pasos, 'se pide permiso de notificaciones', (m: Mundo) => {
    expect(m.app.notificador.solicitudes - m.solicitudesDePermisoAntes).toBe(1)
  })

  afirmacion(pasos, 'no se pide permiso de notificaciones', (m: Mundo) => {
    expect(m.app.notificador.solicitudes - m.solicitudesDePermisoAntes).toBe(0)
  })

  // RN-AL-09 (M13): la ganancia de ayer es de la tienda, no de un producto; se fabrica con
  // una venta real de ayer de un producto auxiliar (costo 0, precio = la ganancia).
  preparacion(pasos, 'ayer la ganancia neta fue {string}', async (m: Mundo, monto: string) => {
    await m.historia.ventaDeLaTienda(sumarDias(m.dia, -1), monto, monto)
  })

  afirmacion(
    pasos,
    'se muestra el resumen del día con {string}, {string} y {string}',
    (m: Mundo, primera: string, segunda: string, tercera: string) => {
      expect(m.inicio?.resumenDelDia?.lineas).toEqual([primera, segunda, tercera])
    },
  )

  accion(pasos, 'cierro el resumen', async (m: Mundo) => {
    await m.app.alertas.cerrarResumenDelDia()
  })

  afirmacion(pasos, 'no se muestra el resumen del día', (m: Mundo) => {
    expect(m.inicio).not.toBeNull()
    expect(m.inicio?.resumenDelDia).toBeNull()
  })
}

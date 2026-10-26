import { createPinia } from 'pinia'
import { expect } from 'vitest'
import { useEstadoGlobal } from '@/app/estado-global'
import { RUTA_AGOTADOS, RUTA_DE_CONTROL, RUTA_SE_ACABAN } from '@/modules/alertas'
import { sumarDias } from '@/shared/domain/fecha'
import { PRESENTACION_DE_ESTADO, type EstadoVisual } from '@/shared/ui/presentacion-estado'
import type { Mundo } from './mundo'
import { accion, afirmacion, preparacion, type Pasos } from './registro'

/** Adónde lleva tocar una notificación, por el nombre de la pantalla (M5: rutas del plan 13). */
const RUTAS_DE_PANTALLA: Record<string, string> = {
  'Productos filtrado por Se acaban': RUTA_SE_ACABAN,
  'Productos filtrado por Agotados': RUTA_AGOTADOS,
  Control: RUTA_DE_CONTROL,
}

/**
 * "El estado guardado / el último aviso de X fue Y" (RN-AL-02/03/04): el dato que guarda
 * Alertas (`RepositorioDeAvisos`, sin registro = NORMAL). No se escribe: el flujo real ya tiene
 * que haberlo dejado así (crear el producto con ese stock avisó ese estado), y se comprueba.
 */
async function exigirEstadoAvisado(m: Mundo, nombre: string, estado: string): Promise<void> {
  const productoId = await m.idDe(nombre)
  const registro = (await m.app.infraestructura.repositorios.avisos.todos()).find(
    (r) => r.productoId === productoId,
  )
  expect(registro?.ultimoEstadoAvisado ?? 'NORMAL', `Estado avisado de ${nombre}`).toBe(estado)
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

  preparacion(pasos, 'el estado guardado de {string} es {string}', exigirEstadoAvisado)
  preparacion(pasos, 'el último aviso de {string} fue {string}', exigirEstadoAvisado)

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

  // RN-AL-03/07: lo que envió la ÚLTIMA acción (no lo que ya se había enviado antes).
  afirmacion(pasos, 'se envía la notificación {string}', (m: Mundo, texto: string) => {
    const enviadas = m.app.notificador.mostradas.slice(m.notificacionesAntes)
    const notificacion = enviadas.find((n) => n.texto === texto)
    expect(
      notificacion,
      `La última acción envió: ${JSON.stringify(enviadas.map((n) => n.texto))}`,
    ).toBeDefined()
    m.ultimaNotificacion = notificacion ?? null
  })

  afirmacion(pasos, 'se enviaron {string} notificaciones en total', (m: Mundo, total: string) => {
    expect(m.app.notificador.mostradas).toHaveLength(Number(total))
  })

  afirmacion(pasos, 'no se envía ninguna notificación del sistema', (m: Mundo) => {
    expect(m.app.notificador.mostradas.slice(m.notificacionesAntes)).toEqual([])
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

  // RN-AL-06a: Inicio avisa por separado de lo agotado y de lo que queda poco; cada aviso solo
  // aparece si hay algo de eso y abre Productos ya filtrado (RN-CAT-16).
  afirmacion(
    pasos,
    'el botón del aviso de Inicio abre {string}',
    async (m: Mundo, pantalla: string) => {
      expect(
        (await m.app.alertas.resumenDeAtencion()).contador,
        'No hay aviso en Inicio',
      ).toBeGreaterThan(0)
      expect(RUTAS_DE_PANTALLA[pantalla]).toBe(RUTA_AGOTADOS)
      expect((await m.app.alertas.resumenDeAtencion()).agotados, 'No hay agotados').toBeGreaterThan(
        0,
      )
    },
  )

  // RN-AL-10 / RN-AL-11 (plan 18, 19): el pago del local, en la tarjeta Alquiler del local.
  afirmacion(
    pasos,
    'la tarjeta Alquiler del local muestra {string}',
    async (m: Mundo, frase: string) => {
      expect((await m.app.alertas.recordatorioDelLocal())?.texto).toBe(frase)
    },
  )

  afirmacion(
    pasos,
    'la tarjeta Alquiler del local no muestra el recordatorio',
    async (m: Mundo) => {
      expect(await m.app.alertas.recordatorioDelLocal()).toBeNull()
    },
  )

  accion(pasos, 'pasa un día', (m: Mundo) => {
    m.app.reloj.avanzarSegundos(24 * 60 * 60)
    m.dia = sumarDias(m.dia, 1)
  })

  afirmacion(pasos, 'no se envía la notificación del local', (m: Mundo) => {
    const enviadas = m.app.notificador.mostradas.slice(m.notificacionesAntes)
    expect(enviadas.filter((n) => n.url === RUTA_DE_CONTROL)).toEqual([])
  })
}

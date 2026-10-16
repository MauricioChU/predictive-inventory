import { expect, vi } from 'vitest'
import { diaDe, diasEntre, sumarSegundos } from '@/shared/domain/fecha'
import type { Mundo } from './mundo'
import { accion, preparacion, type Pasos } from './registro'

/** Pasos de contexto: la fecha, la configuración de la tienda y el estado del celular. */
export function pasosDeContexto(pasos: Pasos): void {
  // "Hoy" no espera ni materializa nada: es el primer paso de todos los escenarios.
  pasos.paso('(que )hoy es {string}', (m: Mundo, texto: string) => {
    m.fijarHoy(texto)
  })

  preparacion(pasos, 'pasa al día {string}', (m: Mundo, texto: string) => {
    m.fijarHoy(texto)
  })

  accion(pasos, 'pasan {string} segundos', (m: Mundo, segundos: string) => {
    m.app.reloj.avanzarSegundos(Number(segundos))
  })

  preparacion(
    pasos,
    '(que )el nombre de la tienda es {string}',
    async (m: Mundo, nombre: string) => {
      await m.app.tienda.actualizarConfiguracion({ nombreTienda: nombre })
    },
  )

  preparacion(
    pasos,
    'la configuración tiene {string} días entre compras y {string} días de anticipación',
    async (m: Mundo, entreCompras: string, anticipacion: string) => {
      await m.app.tienda.actualizarConfiguracion({
        diasEntreCompras: Number(entreCompras),
        diasAnticipacion: Number(anticipacion),
      })
    },
  )

  // RN-AL-06c / RN-AL-08: el usuario ya contestó "Sí, avísame" y el navegador lo concedió
  // (la composición guarda `notificacionesActivas`, M1).
  preparacion(pasos, '(que )las notificaciones del sistema están permitidas', async (m: Mundo) => {
    m.app.notificador.permiso = true
    expect(await m.app.alertas.solicitarPermiso()).toBe(true)
    expect(await m.app.alertas.notificacionesPermitidas()).toBe(true)
  })

  // El permiso del navegador ya no está (se rechazó o se revocó).
  preparacion(
    pasos,
    '(que )las notificaciones del sistema no están permitidas',
    async (m: Mundo) => {
      m.app.notificador.permiso = false
      expect(await m.app.alertas.notificacionesPermitidas()).toBe(false)
    },
  )

  // Es el estado de una instalación nueva: se comprueba en vez de escribirlo.
  preparacion(pasos, '(que )es la primera vez que se abre la app', async (m: Mundo) => {
    const estado = await m.app.tienda.consultable.estadoDelSistema()
    expect(estado.primeraVezCompletada).toBe(false)
    expect(estado.almacenamientoPersistente).toBe('DESCONOCIDO')
  })

  // RN-RE-09: el navegador ya contestó el pedido de almacenamiento persistente.
  preparacion(pasos, '(que )el almacenamiento persistente está concedido', async (m: Mundo) => {
    m.app.almacenamiento.fijarResultado(true)
    await m.app.respaldo.solicitarAlmacenamientoSiHaceFalta()
    const estado = await m.app.tienda.consultable.estadoDelSistema()
    expect(estado.almacenamientoPersistente).toBe('CONCEDIDO')
  })

  preparacion(pasos, '(que )el almacenamiento persistente fue rechazado', async (m: Mundo) => {
    m.app.almacenamiento.fijarResultado(false)
    await m.app.respaldo.solicitarAlmacenamientoSiHaceFalta()
    const estado = await m.app.tienda.consultable.estadoDelSistema()
    expect(estado.almacenamientoPersistente).toBe('RECHAZADO')
  })

  preparacion(pasos, '(que )la última copia fue nunca', async (m: Mundo) => {
    expect((await m.app.tienda.consultable.estadoDelSistema()).ultimoRespaldoEn).toBeNull()
  })

  // RN-RE-06: la copia se guardó de verdad hace n días (guardar y marcarla como guardada,
  // como Ajustes → Guardar copia), con el reloj de prueba en ese día.
  preparacion(
    pasos,
    '(que )la última copia fue hace {int} días',
    async (m: Mundo, dias: number) => {
      const ahora = m.app.reloj.ahora()
      await m.enElPasado(sumarSegundos(ahora, -dias * 86_400), async () => {
        await m.app.respaldo.guardarCopia()
        await m.app.respaldo.marcarCopiaGuardada()
      })
      const { ultimoRespaldoEn } = await m.app.tienda.consultable.estadoDelSistema()
      expect(ultimoRespaldoEn && diasEntre(diaDe(ultimoRespaldoEn), m.dia)).toBe(dias)
    },
  )

  // RN-AN-15 (E13): la aplicación es local; sin red, cualquier fetch fallaría. El paso que
  // mira la Torre de control comprueba además que nadie lo intentó. La garantía de la PWA sin
  // conexión (Service Worker) la cubre el E2E offline.
  preparacion(pasos, '(que )no hay conexión a internet', (m: Mundo) => {
    m.sinRed = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch: sin conexión'))
  })

  accion(pasos, 'abro la app', async (m: Mundo) => {
    await m.abrirLaApp()
  })

  // Sin pantallas todavía (plan 14): queda anotada para el botón que se toque en ella.
  accion(pasos, 'abro la pantalla {string}', (m: Mundo, pantalla: string) => {
    m.pantalla = pantalla
  })
}

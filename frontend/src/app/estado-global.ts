import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ResumenDeAtencion, ResumenDelDia } from '@/modules/alertas'
import type { TamanoDeLetra } from '@/shared/contratos/configuracion'
import { aplicarTamanoDeLetra } from '@/shared/ui/preferencias/tamano-de-letra'
import type { InicioDeLaApp } from './abrir-app'
import type { Aplicacion } from './composicion'

/**
 * Corre `tarea` de a una: si la piden mientras corre, vuelve a correr UNA vez más al terminar
 * (varios eventos seguidos se juntan en una sola lectura), también si la que corría falló. La
 * promesa resuelve cuando ya no queda nada pendiente y nunca rechaza (cada error se registra).
 */
function deAUna(nombre: string, tarea: () => Promise<void>): () => Promise<void> {
  let enCurso: Promise<void> | null = null
  let otraVez = false
  return () => {
    if (enCurso) {
      otraVez = true
      return enCurso
    }
    enCurso = (async () => {
      do {
        otraVez = false
        try {
          await tarea()
        } catch (error) {
          console.error(`No se pudo actualizar ${nombre}:`, error)
        }
      } while (otraVez)
      enCurso = null
    })()
    return enCurso
  }
}

/**
 * Estado que comparte toda la app: el contador de atención del botón Control
 * (`BarraNavegacion.contadorControl`, RN-AL-06b), el tamaño de letra de la configuración, si
 * falta la primera vez, el resumen del día y el recordatorio de copia.
 *
 * El contador sale de cada re-evaluación de Alertas (`alertas.alCalcularLaAtencion`, RN-SIS-09):
 * después de una operación, avisos y contador usan UN solo cálculo de situaciones, y una ráfaga
 * de operaciones, una sola re-evaluación. Alertas re-evalúa tras cada evento relevante (RN-AL-02)
 * y tras revisar datos o restaurar una copia, así que el contador termina siempre con el último
 * estado. La letra se recarga con `ConfiguracionActualizada` y `alCambiarEnBloque`. Los
 * manejadores son "dispara y olvida": encolan y vuelven, porque quien publica espera a sus
 * manejadores antes de ofrecer Deshacer (ADR-0002).
 */
export const useEstadoGlobal = defineStore('estado-global', () => {
  const contadorDeAtencion = ref(0)
  const tamanoDeLetra = ref<TamanoDeLetra>('GRANDE')
  const primeraVez = ref(false)
  const resumenDelDia = ref<ResumenDelDia | null>(null)
  const recordatorioDeCopia = ref<string | null>(null)

  let aplicacion: Aplicacion | null = null
  let cancelaciones: (() => void)[] = []

  function conectada(): Aplicacion {
    if (!aplicacion) throw new Error('El estado global todavía no se conectó a la aplicación')
    return aplicacion
  }

  /** Resúmenes que entregó Alertas: una lectura propia no pisa uno que llegó mientras leía. */
  let entregas = 0

  /** RN-AL-06b: agotados + por acabarse, de la última re-evaluación de Alertas. */
  function alCalcularLaAtencion(resumen: ResumenDeAtencion): void {
    entregas += 1
    contadorDeAtencion.value = resumen.contador
  }

  /**
   * RN-AL-06b: la lectura propia (al conectar, o si alguien la pide). Si mientras tanto llegó un
   * resumen de Alertas, ese manda: cualquier cambio posterior a esta lectura trae otro.
   */
  const refrescarAtencion = deAUna('el contador de atención', async () => {
    const antes = entregas
    const { contador } = await conectada().alertas.resumenDeAtencion()
    if (entregas === antes) contadorDeAtencion.value = contador
  })

  /** La letra (con su copia rápida en localStorage) y si falta la primera vez. */
  const recargarConfiguracion = deAUna('la configuración', async () => {
    const app = conectada()
    const configuracion = await app.tienda.obtenerConfiguracion()
    const estado = await app.tienda.consultable.estadoDelSistema()
    tamanoDeLetra.value = configuracion.tamanoDeLetra
    aplicarTamanoDeLetra(configuracion.tamanoDeLetra)
    primeraVez.value = !estado.primeraVezCompletada
  })

  const refrescarRecordatorioDeCopia = deAUna('el recordatorio de copia', async () => {
    recordatorioDeCopia.value = await conectada().respaldo.recordatorioDeCopia()
  })

  function desconectar(): void {
    for (const cancelar of cancelaciones) cancelar()
    cancelaciones = []
    aplicacion = null
  }

  /** Lo llama main.ts después de `abrirApp`. Devuelve la función para desconectar. */
  function conectar(app: Aplicacion, inicio: InicioDeLaApp): () => void {
    desconectar()
    aplicacion = app
    tamanoDeLetra.value = inicio.tamanoDeLetra
    primeraVez.value = inicio.primeraVez
    resumenDelDia.value = inicio.resumenDelDia
    recordatorioDeCopia.value = inicio.recordatorioDeCopia

    cancelaciones = [
      app.alertas.alCalcularLaAtencion(alCalcularLaAtencion),
      app.bus.suscribir('ConfiguracionActualizada', (): void => {
        void recargarConfiguracion()
      }),
      // Tras restaurar una copia cambian la configuración (letra) y los estados de stock; el
      // contador llega con la re-evaluación que la composición pide en ese momento.
      app.alCambiarEnBloque(() => {
        void recargarConfiguracion()
      }),
    ]
    void refrescarAtencion()
    return desconectar
  }

  /** RN-AL-09: cerrar la tarjeta; no vuelve hasta el día siguiente. */
  async function cerrarResumenDelDia(): Promise<void> {
    await conectada().alertas.cerrarResumenDelDia()
    resumenDelDia.value = null
  }

  return {
    contadorDeAtencion,
    tamanoDeLetra,
    primeraVez,
    resumenDelDia,
    recordatorioDeCopia,
    conectar,
    desconectar,
    refrescarAtencion,
    recargarConfiguracion,
    refrescarRecordatorioDeCopia,
    cerrarResumenDelDia,
  }
})

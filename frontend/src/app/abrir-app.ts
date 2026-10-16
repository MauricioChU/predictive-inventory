import type { ResumenDelDia } from '@/modules/alertas'
import type { TamanoDeLetra } from '@/shared/contratos/configuracion'
import { aplicarTamanoDeLetra } from '@/shared/ui/preferencias/tamano-de-letra'
import type { Aplicacion } from './composicion'

/** Lo que Inicio necesita saber al abrir la app. */
export interface InicioDeLaApp {
  /** La primera vez todavía no se completó (bienvenida, nombre y letra). */
  primeraVez: boolean
  /** El de la configuración de la tienda (ya aplicado). */
  tamanoDeLetra: TamanoDeLetra
  /** RN-AL-09: `null` si ya se mostró hoy. */
  resumenDelDia: ResumenDelDia | null
  /** RN-RE-06: `null` si todavía no toca recordar. */
  recordatorioDeCopia: string | null
}

export interface OpcionesDeApertura {
  /** Por defecto, la de la UI: `data-letra` en <html> y la copia rápida en localStorage. */
  aplicarTamanoDeLetra?: (tamano: TamanoDeLetra) => void
}

/**
 * Un paso que no es imprescindible para abrir: si falla, se registra y la app abre igual (con
 * `siFalla` en su lugar). Ruling de la Ola 3: un problema en algo accesorio no deja a la
 * persona fuera de sus datos.
 */
async function sinDetenerse<T>(que: string, paso: () => Promise<T>, siFalla: T): Promise<T> {
  try {
    return await paso()
  } catch (error) {
    console.error(`No se pudo ${que}:`, error)
    return siFalla
  }
}

/**
 * Lo que pasa cada vez que se abre la app. IMPRESCINDIBLE (si falla, el error llega a quien
 * arranca y se muestra la pantalla sin datos): el estado del sistema (la primera vez crea el
 * `dispositivoId`) y la configuración, con su tamaño de letra (la fuente de verdad; la copia de
 * localStorage solo evita el parpadeo). ACCESORIO (si falla, se registra y se sigue): sembrar las
 * categorías iniciales, el resumen del día, el recordatorio de copia y la evaluación de avisos
 * (RN-AL-02: la predicción cambia con los días). La evaluación se encola y no se espera (la cola
 * de Alertas registra su error); el almacenamiento persistente se pide DESPUÉS de montar
 * (`pedirAlmacenamientoPersistente`).
 */
export async function abrirApp(
  aplicacion: Aplicacion,
  opciones: OpcionesDeApertura = {},
): Promise<InicioDeLaApp> {
  const aplicarLetra = opciones.aplicarTamanoDeLetra ?? aplicarTamanoDeLetra

  const estado = await aplicacion.tienda.consultable.estadoDelSistema()
  const { tamanoDeLetra } = await aplicacion.tienda.obtenerConfiguracion()
  aplicarLetra(tamanoDeLetra)

  await sinDetenerse(
    'sembrar las categorías iniciales',
    () => aplicacion.catalogo.sembrarCategoriasIniciales(),
    undefined,
  )
  void aplicacion.alertas.evaluarAvisos()

  return {
    primeraVez: !estado.primeraVezCompletada,
    tamanoDeLetra,
    resumenDelDia: await sinDetenerse(
      'preparar el resumen del día',
      () => aplicacion.alertas.resumenDelDia(),
      null,
    ),
    recordatorioDeCopia: await sinDetenerse(
      'preparar el recordatorio de copia',
      () => aplicacion.respaldo.recordatorioDeCopia(),
      null,
    ),
  }
}

/**
 * RN-RE-09: pide al navegador almacenamiento persistente si todavía no se sabe la respuesta.
 * Se llama DESPUÉS de montar y sin esperarlo: el navegador puede preguntarle a la persona o no
 * contestar nunca. Nunca rechaza (el error se registra).
 */
export async function pedirAlmacenamientoPersistente(aplicacion: Aplicacion): Promise<void> {
  await sinDetenerse(
    'pedir el almacenamiento persistente',
    () => aplicacion.respaldo.solicitarAlmacenamientoSiHaceFalta(),
    undefined,
  )
}

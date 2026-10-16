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
 * Lo que pasa cada vez que se abre la app, en orden: el estado del sistema (la primera vez crea
 * el `dispositivoId`), el pedido de almacenamiento persistente si todavía no se sabe la
 * respuesta (RN-RE-09), las categorías iniciales si no hay ninguna, el tamaño de letra de la
 * configuración (la fuente de verdad; la copia de localStorage solo evita el parpadeo) y una
 * evaluación de avisos (RN-AL-02: la predicción cambia con los días aunque no haya ventas). La
 * evaluación se encola y no se espera: Inicio no tarda por ella (`esperarTareasPendientes`).
 */
export async function abrirApp(
  aplicacion: Aplicacion,
  opciones: OpcionesDeApertura = {},
): Promise<InicioDeLaApp> {
  const aplicarLetra = opciones.aplicarTamanoDeLetra ?? aplicarTamanoDeLetra

  const estado = await aplicacion.tienda.consultable.estadoDelSistema()
  await aplicacion.respaldo.solicitarAlmacenamientoSiHaceFalta()
  await aplicacion.catalogo.sembrarCategoriasIniciales()

  const { tamanoDeLetra } = await aplicacion.tienda.obtenerConfiguracion()
  aplicarLetra(tamanoDeLetra)

  void aplicacion.alertas.evaluarAvisos()

  return {
    primeraVez: !estado.primeraVezCompletada,
    tamanoDeLetra,
    resumenDelDia: await aplicacion.alertas.resumenDelDia(),
    recordatorioDeCopia: await aplicacion.respaldo.recordatorioDeCopia(),
  }
}

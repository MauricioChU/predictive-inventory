import { abrirApp, type InicioDeLaApp } from './abrir-app'
import { crearAplicacion, type Aplicacion } from './composicion'
import type { InfraestructuraDelNavegador } from './infraestructura-navegador'

export interface PasosDeArranque {
  crearInfraestructura(): InfraestructuraDelNavegador
  /** Monta la interfaz con la aplicación ya abierta. */
  montar(aplicacion: Aplicacion, inicio: InicioDeLaApp): void
  /** La pantalla de error amable: no se pudieron abrir los datos (p. ej. ventana privada). */
  mostrarError(error: unknown): void
}

/**
 * El arranque de main.ts, en orden: infraestructura → abrir la base → aplicación → `abrirApp`
 * → montar. Si algo falla ANTES de montar (IndexedDB no disponible o bloqueado, sin espacio),
 * muestra la pantalla de error en vez de una app que no puede guardar nada. Lo que falle al
 * montar no es un problema de datos y no se disfraza como tal.
 */
export async function arrancar(pasos: PasosDeArranque): Promise<void> {
  let aplicacion: Aplicacion
  let inicio: InicioDeLaApp
  try {
    const infraestructura = pasos.crearInfraestructura()
    await infraestructura.abrir()
    aplicacion = crearAplicacion(infraestructura)
    inicio = await abrirApp(aplicacion)
  } catch (error) {
    pasos.mostrarError(error)
    return
  }
  pasos.montar(aplicacion, inicio)
}

import { abrirApp, pedirAlmacenamientoPersistente, type InicioDeLaApp } from './abrir-app'
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
 * → montar → pedir almacenamiento persistente (sin esperarlo: el navegador puede preguntar o no
 * contestar nunca, RN-RE-09). Si falla lo imprescindible ANTES de montar (abrir la base, el
 * estado del sistema o la configuración: IndexedDB no disponible o bloqueado, sin espacio),
 * muestra la pantalla sin datos en vez de una app que no puede guardar nada; lo accesorio no
 * detiene el arranque (`abrirApp`). Lo que falle al montar no es un problema de datos y no se
 * disfraza como tal.
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
  void pedirAlmacenamientoPersistente(aplicacion)
}

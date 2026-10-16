import type { InicioDeLaApp } from './abrir-app'
import type { Aplicacion } from './composicion'
import type { MotivoSinDatos } from './motivo-sin-datos'

/** Cómo se monta cada pantalla en #app; cada una devuelve cómo desmontarla. */
export interface PantallasDeLaApp {
  /** La app, con su estado global conectado: desmontarla también lo desconecta del bus. */
  montarApp(aplicacion: Aplicacion, inicio: InicioDeLaApp): () => void
  montarSinDatos(motivo: MotivoSinDatos): () => void
}

export interface Montaje {
  /** El arranque terminó: monta la app (salvo que la base ya se haya actualizado). */
  montarApp(aplicacion: Aplicacion, inicio: InicioDeLaApp): void
  /** El arranque falló: la pantalla sin datos (salvo que la base ya se haya actualizado). */
  mostrarError(motivo: MotivoSinDatos): void
  /**
   * M2: otra pestaña abrió una versión más nueva de la base y esta conexión se cerró. Desmonta
   * lo que haya (la app con su estado global) y muestra "La app se actualizó", que ya no se
   * reemplaza: ni el arranque que termine después ni su error (la base está cerrada).
   */
  seActualizoLaBase(): void
}

/** Lo que hay montado en #app y las reglas para reemplazarlo (main.ts pone las pantallas). */
export function crearMontaje(pantallas: PantallasDeLaApp): Montaje {
  let desmontar: (() => void) | null = null
  let seActualizo = false

  function reemplazarPor(montar: () => () => void): void {
    desmontar?.()
    desmontar = montar()
  }

  return {
    montarApp(aplicacion, inicio) {
      if (seActualizo) return
      reemplazarPor(() => pantallas.montarApp(aplicacion, inicio))
    },
    mostrarError(motivo) {
      if (seActualizo) return
      reemplazarPor(() => pantallas.montarSinDatos(motivo))
    },
    seActualizoLaBase() {
      if (seActualizo) return
      seActualizo = true
      reemplazarPor(() => pantallas.montarSinDatos('actualizada'))
    },
  }
}

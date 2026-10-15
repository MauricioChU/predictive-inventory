import type { ContextoAvisoDeshacer } from './aviso-deshacer'

export interface GanchosDePrueba {
  /** Muestra el aviso Deshacer global (con un "deshacer" que no hace nada). */
  mostrarAvisoDeshacer: (mensaje?: string, segundos?: number) => void
}

declare global {
  interface Window {
    __pruebas?: GanchosDePrueba
  }
}

/**
 * m11 (ronda 4): todavía ninguna pantalla real muestra el aviso Deshacer (llegan en las olas
 * siguientes), pero su geometría en celular y PC se debe verificar con Playwright. Se exponen
 * SOLO en desarrollo o cuando el navegador está automatizado (`navigator.webdriver`, que
 * Playwright activa) — así la misma prueba corre contra `npm run dev` y contra el build de
 * producción en CI (`npm run preview`). Para una persona usando la app no existe. Devuelve la
 * función que los retira.
 */
export function exponerGanchosDePrueba(aviso: ContextoAvisoDeshacer): () => void {
  if (!(import.meta.env.DEV || navigator.webdriver)) return () => {}
  window.__pruebas = {
    mostrarAvisoDeshacer(mensaje = 'Venta registrada', segundos = 10) {
      aviso.mostrar({ mensaje, segundos, alDeshacer: () => {} })
    },
  }
  return () => {
    delete window.__pruebas
  }
}

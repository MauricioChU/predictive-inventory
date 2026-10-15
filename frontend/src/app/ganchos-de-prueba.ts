import { createApp } from 'vue'
import type { ContextoAvisoDeshacer } from './aviso-deshacer'

export interface BarraDePrueba {
  etiqueta: string
  valor: number
  textoValor: string
  destacada?: boolean
}

export interface GanchosDePrueba {
  /** Muestra el aviso Deshacer global (con un "deshacer" que no hace nada), con los mismos
   * 10 s de siempre (RN-OP-18): el gancho no puede cambiar el tiempo. */
  mostrarAvisoDeshacer: (mensaje?: string) => void
  /** Monta un GraficoBarras al final de #contenido, para medir su geometría (todavía no hay
   * pantallas reales con gráfico). Se carga aparte: no pesa en la app normal. */
  mostrarGrafico: (titulo: string, barras: BarraDePrueba[]) => Promise<void>
}

declare global {
  interface Window {
    __pruebas?: GanchosDePrueba
  }
}

/**
 * m11 (ronda 4): todavía ninguna pantalla real muestra el aviso Deshacer ni un gráfico (llegan
 * en las olas siguientes), pero su geometría en celular y PC se debe verificar con Playwright.
 * Se exponen SOLO en desarrollo o cuando el navegador está automatizado (`navigator.webdriver`,
 * que Playwright activa) — así la misma prueba corre contra `npm run dev` y contra el build de
 * producción en CI (`npm run preview`). Para una persona usando la app no existe. Devuelve la
 * función que los retira.
 */
export function exponerGanchosDePrueba(aviso: ContextoAvisoDeshacer): () => void {
  if (!(import.meta.env.DEV || navigator.webdriver)) return () => {}
  window.__pruebas = {
    mostrarAvisoDeshacer(mensaje = 'Venta registrada') {
      aviso.mostrar({ mensaje, alDeshacer: () => {} })
    },
    async mostrarGrafico(titulo, barras) {
      const { default: GraficoBarras } = await import('@/shared/ui/componentes/GraficoBarras.vue')
      const contenido = document.getElementById('contenido')
      if (!contenido) throw new Error('Falta #contenido')
      const lugar = document.createElement('div')
      contenido.append(lugar)
      createApp(GraficoBarras, { titulo, barras }).mount(lugar)
    },
  }
  return () => {
    delete window.__pruebas
  }
}

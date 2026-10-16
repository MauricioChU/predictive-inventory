import { createApp, type Component } from 'vue'
import type { ContextoAvisoDeshacer } from './aviso-deshacer'

/**
 * Páginas de catálogo de los kits de componentes (src/shared/ui/__catalogo__), solo para las
 * E2E: cada kit agrega la suya con su nombre. Import dinámico: no pesan en la app normal.
 */
const CATALOGOS: Record<string, () => Promise<{ default: Component }>> = {
  // ── Kit B (feat/ui-kit-paneles) ──────────────────────────────────────────
  paneles: () => import('@/shared/ui/__catalogo__/CatalogoKitPaneles.vue'),
  // ── fin Kit B ─────────────────────────────────────────────────────────────
}

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
  /** Monta al final de #contenido la página de catálogo de un kit ("paneles", …) para medir
   * sus componentes y auditarlos con axe antes de que existan las pantallas reales. */
  mostrarCatalogo: (nombre: string) => Promise<void>
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
    async mostrarCatalogo(nombre) {
      const cargar = CATALOGOS[nombre]
      if (!cargar) throw new Error(`No hay un catálogo "${nombre}"`)
      const { default: catalogo } = await cargar()
      const contenido = document.getElementById('contenido')
      if (!contenido) throw new Error('Falta #contenido')
      const lugar = document.createElement('div')
      contenido.append(lugar)
      createApp(catalogo).mount(lugar)
    },
  }
  return () => {
    delete window.__pruebas
  }
}

import { createApp, type Component } from 'vue'
import type { ContextoAvisoDeshacer } from './aviso-deshacer'

// ── Catálogos de los kits de componentes (plan 09b) ─────────────────────────────────────────
// Páginas solo para pruebas (src/shared/ui/__catalogo__/) que las E2E montan con
// `window.__pruebas.mostrarCatalogo(kit)`. Cada kit agrega SOLO su entrada en este objeto.
const CATALOGOS_DE_KITS = {
  // Kit A — feat/ui-kit-productos
  productos: () => import('@/shared/ui/__catalogo__/CatalogoKitProductos.vue'),
} satisfies Record<string, () => Promise<{ default: Component }>>

export type KitDeCatalogo = keyof typeof CATALOGOS_DE_KITS
// ── fin de los catálogos de kits ────────────────────────────────────────────────────────────

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
  /** Plan 09b: monta el catálogo de un kit de componentes al final de #contenido. */
  mostrarCatalogo: (kit: KitDeCatalogo) => Promise<void>
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
    async mostrarCatalogo(kit) {
      const cargar = CATALOGOS_DE_KITS[kit] as (() => Promise<{ default: Component }>) | undefined
      if (!cargar) throw new Error(`No hay catálogo para el kit "${kit}"`)
      const { default: Catalogo } = await cargar()
      const contenido = document.getElementById('contenido')
      if (!contenido) throw new Error('Falta #contenido')
      const lugar = document.createElement('div')
      contenido.append(lugar)
      createApp(Catalogo).mount(lugar)
    },
  }
  return () => {
    delete window.__pruebas
  }
}

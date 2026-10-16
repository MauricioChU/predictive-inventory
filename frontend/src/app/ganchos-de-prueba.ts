/**
 * GANCHOS DE PRUEBA EN EL BUILD DE PRODUCCIÓN (para las E2E de Playwright).
 *
 * Existen solo si `import.meta.env.DEV` (servidor de desarrollo) o `navigator.webdriver` (un
 * navegador automatizado, como Playwright contra `npm run preview` en CI). Para una persona
 * usando la app no existen:
 * - `window.__pruebas`: muestra el aviso Deshacer, monta un GraficoBarras y monta los catálogos
 *   de los kits de componentes para medir su geometría (LayoutApp los expone y los retira al
 *   desmontar).
 * - `window.__aplicacion`: la aplicación real (los seis módulos), para preparar datos y
 *   completar operaciones por los casos de uso mientras no existan las pantallas (main.ts).
 * No dan acceso a nada que el código de la página no tenga ya (los datos son locales).
 */
import { createApp, type App, type Component } from 'vue'
import type { ContextoAvisoDeshacer } from './aviso-deshacer'
import type { Aplicacion } from './composicion'

// ── Catálogos de los kits de componentes (plan 09b) ──
// Páginas solo para pruebas (src/shared/ui/__catalogo__/) que las E2E montan con
// `window.__pruebas.mostrarCatalogo(kit)`. Cada kit agrega SOLO su entrada en este objeto.
const CATALOGOS_DE_KITS = {
  paneles: () => import('@/shared/ui/__catalogo__/CatalogoKitPaneles.vue'),
} satisfies Record<string, () => Promise<{ default: Component }>>
export type KitDeCatalogo = keyof typeof CATALOGOS_DE_KITS

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
  /** Monta al final de #contenido la página de catálogo de un kit para medir sus componentes
   * y auditarlos con axe antes de que existan las pantallas reales. */
  mostrarCatalogo: (kit: KitDeCatalogo) => Promise<void>
}

declare global {
  interface Window {
    __pruebas?: GanchosDePrueba
    /** La aplicación real (solo en desarrollo o con el navegador automatizado). */
    __aplicacion?: Aplicacion
  }
}

interface Montada {
  app: App
  lugar: HTMLElement
}

function hayPruebas(): boolean {
  return import.meta.env.DEV || navigator.webdriver
}

/**
 * m11 (ronda 4): todavía ninguna pantalla real muestra el aviso Deshacer ni un gráfico (llegan
 * en las olas siguientes), pero su geometría en celular y PC se debe verificar con Playwright.
 * Se exponen SOLO en desarrollo o cuando el navegador está automatizado (`navigator.webdriver`,
 * que Playwright activa) — así la misma prueba corre contra `npm run dev` y contra el build de
 * producción en CI (`npm run preview`). Para una persona usando la app no existe. Devuelve la
 * función que los retira (y desmonta lo que montaron).
 */
export function exponerGanchosDePrueba(aviso: ContextoAvisoDeshacer): () => void {
  if (!hayPruebas()) return () => {}
  const montadas: Montada[] = []
  const prefijosUsados = new Map<string, number>()

  /**
   * Cada gráfico o catálogo es OTRA app de Vue, con su propio contador de useId: sin un prefijo
   * propio sus ids ("v-0", …) repetirían los de la app de verdad y un aria-labelledby apuntaría
   * al elemento equivocado. Si el mismo prefijo se monta dos veces, el segundo lleva "-2".
   * Se guarda cada app para desmontarla (y retirar su lugar) al limpiar.
   */
  function montarAlFinal(componente: Component, props: Record<string, unknown>, prefijo: string) {
    const contenido = document.getElementById('contenido')
    if (!contenido) throw new Error('Falta #contenido')
    const veces = (prefijosUsados.get(prefijo) ?? 0) + 1
    prefijosUsados.set(prefijo, veces)
    const lugar = document.createElement('div')
    contenido.append(lugar)
    const app = createApp(componente, props)
    app.config.idPrefix = veces === 1 ? prefijo : `${prefijo}-${veces}`
    app.mount(lugar)
    montadas.push({ app, lugar })
  }

  window.__pruebas = {
    mostrarAvisoDeshacer(mensaje = 'Venta registrada') {
      aviso.mostrar({ mensaje, alDeshacer: () => {} })
    },
    async mostrarGrafico(titulo, barras) {
      const { default: GraficoBarras } = await import('@/shared/ui/componentes/GraficoBarras.vue')
      montarAlFinal(GraficoBarras, { titulo, barras }, 'grafico')
    },
    async mostrarCatalogo(kit) {
      // Object.hasOwn: un nombre heredado de Object.prototype ("toString") no es un catálogo.
      if (!Object.hasOwn(CATALOGOS_DE_KITS, kit)) {
        throw new Error(`No hay catálogo para el kit "${kit}"`)
      }
      const { default: catalogo } = await CATALOGOS_DE_KITS[kit]()
      montarAlFinal(catalogo, {}, `catalogo-${kit}`)
    },
  }
  return () => {
    for (const { app, lugar } of montadas.splice(0)) {
      app.unmount()
      lugar.remove()
    }
    delete window.__pruebas
  }
}

/**
 * Ola 3: las E2E preparan datos y completan operaciones (p. ej. la venta sin conexión de
 * RN-SIS-08) por los casos de uso reales, mientras no existan las pantallas. Mismas
 * condiciones que los ganchos de arriba; devuelve la función que la retira.
 */
export function exponerAplicacionParaPruebas(aplicacion: Aplicacion): () => void {
  if (!hayPruebas()) return () => {}
  window.__aplicacion = aplicacion
  return () => {
    delete window.__aplicacion
  }
}

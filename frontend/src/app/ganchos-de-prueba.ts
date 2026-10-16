/**
 * GANCHOS DE PRUEBA EN EL BUILD DE PRODUCCIÓN (para las E2E de Playwright).
 *
 * Existen solo si `import.meta.env.DEV` (servidor de desarrollo) o `navigator.webdriver` (un
 * navegador automatizado, como Playwright contra `npm run preview` en CI). Para una persona
 * usando la app no existen:
 * - `window.__pruebas`: muestra el aviso Deshacer y monta un GraficoBarras para medir su
 *   geometría (LayoutApp los expone y los retira al desmontar).
 * - `window.__aplicacion`: la aplicación real (los seis módulos), para preparar datos y
 *   completar operaciones por los casos de uso mientras no existan las pantallas (main.ts).
 * No dan acceso a nada que el código de la página no tenga ya (los datos son locales).
 */
import { createApp } from 'vue'
import type { ContextoAvisoDeshacer } from './aviso-deshacer'
import type { Aplicacion } from './composicion'

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
    /** La aplicación real (solo en desarrollo o con el navegador automatizado). */
    __aplicacion?: Aplicacion
  }
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
 * función que los retira.
 */
export function exponerGanchosDePrueba(aviso: ContextoAvisoDeshacer): () => void {
  if (!hayPruebas()) return () => {}
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

// Plan 16, ítem 5: la guía de palabras (06-experiencia-de-uso, «Guía de palabras»). Ninguna
// pantalla dice lo que la guía manda evitar, ni deja ver nombres técnicos.
import { expect, type Page } from '@playwright/test'

/** «Evitar» de la guía (y lo que se le parece), más fugas técnicas de la programación. */
export const PALABRAS_QUE_EVITAR: readonly { palabra: RegExp; usar: string }[] = [
  { palabra: /\bmermas?\b/i, usar: 'Se dañó · Se derramó · Se venció (o "pérdida")' },
  { palabra: /\bingresos?\b|registrar (la )?entrada|entrada de mercader/i, usar: 'Llegó mercadería' },
  { palabra: /ajustes? de (inventario|stock)/i, usar: 'Contar stock' },
  { palabra: /stock cr[ií]tico|\bumbral\b/i, usar: 'Queda poco · Agotado · Bien' },
  { palabra: /\bcobertura\b/i, usar: 'Se acaba en ~4 días · ¿Necesito comprar?' },
  { palabra: /\bbackups?\b|exportar (a )?json/i, usar: 'Guardar copia' },
  { palabra: /\brevert(ir|ido|ida|imos)?\b|\brollback\b/i, usar: 'Deshacer · Anular' },
  { palabra: /\bundefined\b|\bnull\b|\bNaN\b|\[object |\bInfinity\b/, usar: '(un valor sin mostrar)' },
]

interface VentanaConTextos {
  __textosVistos?: Set<string>
}

/**
 * Debe llamarse antes de abrir la app: desde ese momento anota cada texto que la app pone en
 * pantalla (y lo que lee el lector de pantalla: aria-label, title, placeholder, alt,
 * aria-valuetext), aunque dure un instante (un aviso, una pantalla de ✓).
 */
export async function anotarTextosVistos(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Se guarda en sessionStorage: sigue anotando aunque la prueba vuelva a abrir la app.
    const CLAVE = 'pruebas.textos-vistos'
    let guardados: string[] = []
    try {
      guardados = JSON.parse(sessionStorage.getItem(CLAVE) ?? '[]') as string[]
    } catch {
      guardados = []
    }
    const vistos = new Set<string>(guardados)
    let hayNuevos = false
    const guardar = () => {
      if (!hayNuevos) return
      hayNuevos = false
      sessionStorage.setItem(CLAVE, JSON.stringify([...vistos]))
    }
    window.addEventListener('pagehide', guardar)
    const ATRIBUTOS = ['aria-label', 'title', 'placeholder', 'alt', 'aria-valuetext']
    const anotar = (texto: string | null | undefined) => {
      const limpio = (texto ?? '').replace(/\s+/g, ' ').trim()
      if (limpio && !vistos.has(limpio)) {
        vistos.add(limpio)
        hayNuevos = true
      }
    }
    const recorrer = (nodo: Node) => {
      if (nodo.nodeType === Node.TEXT_NODE) {
        if (nodo.parentElement?.closest('script, style')) return
        anotar(nodo.textContent)
        return
      }
      if (!(nodo instanceof Element)) return
      if (nodo.matches('script, style')) return
      for (const atributo of ATRIBUTOS) anotar(nodo.getAttribute(atributo))
      for (const hijo of Array.from(nodo.childNodes)) recorrer(hijo)
    }
    new MutationObserver((cambios) => {
      for (const cambio of cambios) {
        if (cambio.type === 'characterData') anotar(cambio.target.textContent)
        else if (cambio.type === 'attributes' && cambio.target instanceof Element)
          anotar(cambio.target.getAttribute(cambio.attributeName ?? ''))
        else cambio.addedNodes.forEach(recorrer)
      }
      guardar()
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATRIBUTOS,
    })
    Object.defineProperty(window, '__textosVistos', { value: vistos })
    document.addEventListener('DOMContentLoaded', () => recorrer(document.documentElement))
  })
}

/** Lo que se vio desde `anotarTextosVistos` (más el título de la pestaña actual). */
export async function textosVistos(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    document.title,
    ...((window as VentanaConTextos).__textosVistos ?? []),
  ])
}

/** Falla con cada texto visto que usa una palabra de la columna «Evitar». */
export async function esperarSinPalabrasQueEvitar(page: Page): Promise<void> {
  const textos = await textosVistos(page)
  expect(textos.length, 'se anotaron los textos de las pantallas').toBeGreaterThan(10)
  const encontradas = textos.flatMap((texto) =>
    PALABRAS_QUE_EVITAR.filter(({ palabra }) => palabra.test(texto)).map(
      ({ usar }) => `"${texto}" → usar: ${usar}`,
    ),
  )
  expect(encontradas, 'ninguna pantalla usa palabras que la guía manda evitar').toEqual([])
}

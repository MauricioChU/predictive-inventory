import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

import { esperarVistaQuieta } from './navegacion'

export { esperarVistaQuieta, usarLetra, type Letra } from './navegacion'

/** RN-UX-09 / RN-SIS-06.
 *
 * Ronda 2 (hallazgo S1): un overflow:hidden en algún ancestro puede esconder visualmente un
 * desborde (recorta contenido) sin que scrollWidth del documento lo delate — scrollWidth
 * seguía midiendo el ancho del viewport mientras un enlace de la barra quedaba tapado. Por eso
 * además de ese chequeo, se verifica la geometría real: ningún elemento de <main> o de la
 * barra de navegación debe salir del viewport, y <main> tampoco debe tener su propio
 * desplazamiento horizontal interno.
 */
export async function esperarSinDesplazamientoHorizontal(page: Page): Promise<void> {
  await esperarVistaQuieta(page)
  const { scroll, cliente } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    cliente: document.documentElement.clientWidth,
  }))
  expect(scroll, 'la página no debe desplazarse a los lados').toBeLessThanOrEqual(cliente)

  const resultado = await page.evaluate(() => {
    const anchoVentana = document.documentElement.clientWidth
    const main = document.getElementById('contenido')
    const nav = document.querySelector('nav')
    const elementos = [
      ...(main ? Array.from(main.querySelectorAll('*')) : []),
      ...(nav ? Array.from(nav.querySelectorAll('*')) : []),
    ]
    // Lo que está dentro de .solo-lector (p. ej. la tabla de datos de GraficoBarras) no se
    // dibuja: va recortado a 1 px para que solo lo lea un lector de pantalla. Su caja de layout
    // puede ser ancha, pero no se ve ni desplaza la página, así que no cuenta aquí.
    const fueraDeVista = elementos
      .filter((el) => !el.closest('.solo-lector'))
      // Dentro de una región que se desplaza de lado (GraficoColumnas) el contenido puede ser más
      // ancho que la pantalla a propósito: lo que debe caber es la región misma.
      .filter((el) => !el.parentElement?.closest('[data-desplaza-de-lado]'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .some((r) => r.left < -1 || r.right > anchoVentana + 1)
    const mainDesborda = main ? main.scrollWidth > main.clientWidth + 1 : false
    return { fueraDeVista, mainDesborda }
  })
  expect(
    resultado.fueraDeVista,
    'ningún elemento de <main> o de la navegación debe salir del viewport',
  ).toBe(false)
  expect(
    resultado.mainDesborda,
    '<main> no debe tener su propio desplazamiento horizontal interno',
  ).toBe(false)
}

/** RN-SIS-07 */
export async function esperarSinViolacionesGraves(page: Page): Promise<void> {
  // Lo que está apareciendo (semitransparente) se mide ya quieto: si no, el contraste da mal.
  // Dos cuadros antes: Vue arranca las transiciones de entrada un cuadro después de montar.
  await page.evaluate(async () => {
    await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)))
    await Promise.allSettled(document.getAnimations().map((a) => a.finished))
  })
  const resultado = await new AxeBuilder({ page }).analyze()
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

/** Lo que se anotó de cada elemento al que llegó el foco con Tab. */
interface Enfocado {
  que: string
  zona: 'salto' | 'contenido' | 'dialogo' | 'navegacion' | 'pie' | 'otro'
  /** Posición en el documento (para saber cuándo dio la vuelta). */
  orden: number
  /**
   * Si va después, en el código, del enfocado anterior (null si no hay anterior o ya no está en
   * la página). Se compara al momento: no le afecta que la pantalla agregue cosas mientras tanto.
   */
  despuesDelAnterior: boolean | null
  arriba: number
  abajo: number
  izquierda: number
  derecha: number
  visibleEnPantalla: boolean
}

/**
 * RN-UX-15 / WCAG 2.4.3: recorre la pantalla con Tab (hasta `pasos` veces o hasta dar la
 * vuelta) y verifica que el orden de foco es el lógico:
 * - con un diálogo abierto, el foco no sale de él;
 * - si no, primero "Saltar al contenido", después la pantalla en el orden del código (nada con
 *   tabindex positivo que salte), y la navegación al final, entera y en el orden de RN-UX-12
 *   (abajo en celular; a la izquierda desde 1024 px);
 * - dentro de la pantalla nunca vuelve hacia arriba a la izquierda (se lee de arriba abajo y,
 *   en columnas, de la izquierda a la derecha);
 * - cada elemento enfocado tiene tamaño y se ve al menos la mitad (WCAG 2.4.11: nada pegado
 *   encima lo tapa, aunque en un celular en horizontal no entre entero).
 */
export async function esperarOrdenDeFocoLogico(page: Page, pasos = 80): Promise<void> {
  const conDialogo = (await page.locator('dialog[open]').count()) > 0
  if (!conDialogo) {
    // Se empieza desde el principio del documento (blur() no alcanza: Chromium sigue desde
    // donde estaba el foco): un punto de partida que no se puede enfocar con Tab.
    await page.evaluate(() => {
      const inicio = document.createElement('span')
      inicio.id = 'inicio-del-recorrido-con-tab'
      inicio.tabIndex = -1
      document.body.prepend(inicio)
      inicio.focus()
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }
  await page.evaluate(() => {
    delete (window as Window & { __focoAnterior?: Element }).__focoAnterior
  })
  const enfocados: Enfocado[] = []
  for (let i = 0; i < pasos; i += 1) {
    await page.keyboard.press('Tab')
    const actual = await page.evaluate((): Enfocado | null => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const memoria = window as Window & { __focoAnterior?: Element }
      const anterior = memoria.__focoAnterior
      const despuesDelAnterior =
        anterior && anterior.isConnected && anterior !== el
          ? Boolean(anterior.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
          : null
      memoria.__focoAnterior = el
      // WCAG 2.4.11: qué parte del elemento se ve de verdad (dentro de la ventana y sin nada
      // pegado encima, como la barra del total o la navegación). Se miran 11 puntos a lo alto.
      const fraccionALaVista = (elemento: Element, r: DOMRect) => {
        const x = Math.min(Math.max(r.left + r.width / 2, 0), document.documentElement.clientWidth - 1)
        let vistos = 0
        for (let i = 0; i <= 10; i += 1) {
          const y = r.top + 1 + ((r.height - 2) * i) / 10
          if (y < 0 || y >= window.innerHeight) continue
          const encima = document.elementFromPoint(x, y)
          if (encima && (elemento === encima || elemento.contains(encima))) vistos += 1
        }
        return vistos / 11
      }
      const todos = Array.from(document.querySelectorAll('*'))
      const caja = el.getBoundingClientRect()
      // Posición en la página: además del scroll de la ventana, lo que se desplazó cada
      // contenedor que se desplaza por dentro (la hoja del panel de venta abierta).
      let desplazado = window.scrollY
      for (let padre = el.parentElement; padre; padre = padre.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(padre).overflowY)) desplazado += padre.scrollTop
      }
      const zona = el.matches('.saltar-al-contenido')
        ? 'salto'
        : el.closest('dialog[open]')
          ? 'dialogo'
          : el.closest('#contenido')
            ? 'contenido'
            : el.closest('nav')
              ? 'navegacion'
              : el.closest('.pie')
                ? 'pie'
                : 'otro'
      return {
        que: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`,
        zona,
        orden: todos.indexOf(el),
        despuesDelAnterior,
        arriba: caja.top + desplazado,
        abajo: caja.bottom + desplazado,
        izquierda: caja.left,
        derecha: caja.right,
        visibleEnPantalla: caja.width > 0 && caja.height > 0 && fraccionALaVista(el, caja) >= 0.5,
      }
    })
    if (!actual) continue
    const primero = enfocados[0]
    if (primero && actual.orden === primero.orden) break // dio la vuelta
    enfocados.push(actual)
  }
  await page.evaluate(() => document.getElementById('inicio-del-recorrido-con-tab')?.remove())
  expect(enfocados.length, 'el foco llega a algo con Tab').toBeGreaterThan(0)
  const fueraDeVista = enfocados.filter((e) => !e.visibleEnPantalla).map((e) => e.que)
  expect(fueraDeVista, 'todo lo enfocado se ve (al menos la mitad)').toEqual([])

  if (conDialogo) {
    const fuera = enfocados.filter((e) => e.zona !== 'dialogo').map((e) => e.que)
    expect(fuera, 'con un diálogo abierto el foco no sale de él').toEqual([])
    return
  }

  expect(enfocados[0]!.zona, 'lo primero es "Saltar al contenido"').toBe('salto')
  const haciaAtras = enfocados.filter((e) => e.despuesDelAnterior === false).map((e) => e.que)
  expect(haciaAtras, 'el foco sigue el orden del código').toEqual([])

  const navegacion = enfocados.filter((e) => e.zona === 'navegacion')
  // RN-UX-16: durante la primera vez no hay navegación (ni nada a lo que el foco pueda salir).
  if ((await page.locator('nav').count()) === 0) {
    expect(navegacion.map((e) => e.que), 'sin navegación, el foco no sale de la pantalla').toEqual([])
  } else {
    expect(
      navegacion.map((e) => e.que.replace(/^a "(Inicio|Vender|Recibir|Productos|Control).*$/, '$1')),
      'la navegación entera y en orden',
    ).toEqual(['Inicio', 'Vender', 'Recibir', 'Productos', 'Control'])
    const ultimaDeLaPantalla = enfocados.findLastIndex((e) => e.zona === 'contenido')
    const primeraDeLaNavegacion = enfocados.findIndex((e) => e.zona === 'navegacion')
    expect(primeraDeLaNavegacion, 'la navegación va después de la pantalla').toBeGreaterThan(
      ultimaDeLaPantalla,
    )
  }

  const pantalla = enfocados.filter((e) => e.zona === 'contenido')
  const saltosHaciaAtras: string[] = []
  for (let i = 1; i < pantalla.length; i += 1) {
    const antes = pantalla[i - 1]!
    const ahora = pantalla[i]!
    const subio = ahora.abajo <= antes.arriba + 1
    const fueALaIzquierda = ahora.derecha <= antes.izquierda + 1
    if (subio && fueALaIzquierda) saltosHaciaAtras.push(`${antes.que} → ${ahora.que}`)
  }
  expect(saltosHaciaAtras, 'el foco no vuelve hacia arriba a la izquierda').toEqual([])
}

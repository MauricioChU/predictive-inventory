import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
  usarLetra,
} from './utilidades/calidad'
import {
  agregarContenidoLargo,
  caja,
  esperarAvisoTodaviaVisible,
  mostrarAvisoDeshacer,
} from './utilidades/escenarios'
import { abrir } from './utilidades/navegacion'

const ALTO = 800
/** Por debajo de 1024 px la navegación es una barra abajo; desde ahí, una columna lateral. */
const CELULAR = [320, 360]
const PC = [1024, 1280]
const POSICIONES = ['arriba', 'medio', 'final'] as const

async function desplazarA(page: Page, posicion: (typeof POSICIONES)[number]): Promise<void> {
  await page.evaluate((donde) => {
    const total = document.documentElement.scrollHeight
    const destino = { arriba: 0, medio: total / 2, final: total }[donde]
    window.scrollTo({ top: destino, behavior: 'instant' })
  }, posicion)
}

async function abrirPaginaLarga(page: Page, ancho: number, conAviso: boolean): Promise<void> {
  await usarLetra(page, 'MUY_GRANDE')
  await page.setViewportSize({ width: ancho, height: ALTO })
  await abrir(page, './productos')
  await agregarContenidoLargo(page)
  if (conAviso) await mostrarAvisoDeshacer(page)
}

/** Columna lateral a todo el alto (de 0 al fondo de la ventana). */
async function esperarColumnaLateralCompleta(page: Page, posicion: string): Promise<void> {
  const nav = await caja(page, 'nav')
  expect(Math.abs(nav.top), `${posicion}: la columna lateral empieza arriba`).toBeLessThanOrEqual(1)
  expect(Math.abs(nav.bottom - ALTO), `${posicion}: y llega al fondo`).toBeLessThanOrEqual(1)
}

// m11 (ronda 4): página larga. Se inyecta contenido alto en #contenido y se verifica la
// navegación arriba, en medio y al final del desplazamiento; al final, el último elemento queda
// entero sobre lo que está pegado abajo (el pie en celular, el aviso Deshacer en PC).
test.describe('m11: página larga — la navegación queda en su lugar y no tapa el final', () => {
  for (const ancho of CELULAR) {
    for (const conAviso of [false, true]) {
      test(`celular ${ancho}px, letra Muy grande${conAviso ? ', con aviso Deshacer' : ''}`, async ({
        page,
      }) => {
        await abrirPaginaLarga(page, ancho, conAviso)
        for (const posicion of POSICIONES) {
          await desplazarA(page, posicion)
          const nav = await caja(page, 'nav')
          expect(
            Math.abs(nav.bottom - ALTO),
            `${posicion}: la barra va pegada al fondo`,
          ).toBeLessThanOrEqual(1)
        }
        const ultimo = await caja(page, '#ultimo')
        const pie = await caja(page, '.pie')
        expect(ultimo.bottom, 'el último elemento queda sobre el pie').toBeLessThanOrEqual(
          pie.top + 1,
        )
        await esperarSinDesplazamientoHorizontal(page)
        await expect(page.locator('.aviso-deshacer')).toHaveCount(conAviso ? 1 : 0)
      })
    }
  }

  for (const ancho of PC) {
    test(`PC ${ancho}px, letra Muy grande`, async ({ page }) => {
      await abrirPaginaLarga(page, ancho, false)
      for (const posicion of POSICIONES) {
        await desplazarA(page, posicion)
        await esperarColumnaLateralCompleta(page, posicion)
      }
      const ultimo = await caja(page, '#ultimo')
      expect(ultimo.bottom, 'el último elemento queda dentro de la ventana').toBeLessThanOrEqual(
        ALTO + 1,
      )
      await esperarSinDesplazamientoHorizontal(page)
    })

    // Minor 4 (ronda 5): el aviso queda pegado al fondo de la ventana arriba, en medio y al final.
    test(`PC ${ancho}px, letra Muy grande, con aviso Deshacer`, async ({ page }) => {
      await abrirPaginaLarga(page, ancho, true)
      for (const posicion of POSICIONES) {
        await desplazarA(page, posicion)
        await esperarColumnaLateralCompleta(page, posicion)
        const zona = await caja(page, '.zona-aviso-deshacer')
        expect(
          Math.abs(zona.bottom - ALTO),
          `${posicion}: el aviso va pegado al fondo de la ventana`,
        ).toBeLessThanOrEqual(1)
      }
      const ultimo = await caja(page, '#ultimo')
      const zona = await caja(page, '.zona-aviso-deshacer')
      expect(ultimo.bottom, 'el último elemento queda sobre el aviso').toBeLessThanOrEqual(
        zona.top + 1,
      )
      await esperarSinDesplazamientoHorizontal(page)
      await esperarAvisoTodaviaVisible(page)
    })
  }
})

const MENSAJE_LARGO =
  'Venta registrada de 14 productos: detergente, lejía, jabón, esponjas, bolsas, suavizante, ' +
  'limpiavidrios, ambientador, cera, guantes, escobas, recogedores, trapos y baldes. Total S/ 1 234.56.'
const MENSAJES = [
  ['normal', 'Venta registrada'],
  ['larguísimo', MENSAJE_LARGO],
] as const

async function abrirConAviso(page: Page, ancho: number, mensaje: string): Promise<void> {
  await usarLetra(page, 'MUY_GRANDE')
  await page.setViewportSize({ width: ancho, height: ALTO })
  await abrir(page, './')
  await page.evaluate(() => document.fonts.ready)
  await mostrarAvisoDeshacer(page, mensaje)
}

/** Lo común a celular y PC: dentro de la ventana, ≤ 40 % del alto, botón ≥ 48 px entero dentro
 * del aviso, mensaje legible (no una letra por línea) y los cinco enlaces enteros a la vista. */
async function esperarAvisoBienArmado(page: Page, ancho: number): Promise<void> {
  const zona = await caja(page, '.zona-aviso-deshacer')
  const aviso = await caja(page, '.aviso-deshacer')
  const mensaje = await caja(page, '.aviso-deshacer .mensaje')
  const boton = await caja(page, '.aviso-deshacer button')

  expect(zona.top).toBeGreaterThanOrEqual(-1)
  expect(zona.bottom).toBeLessThanOrEqual(ALTO + 1)
  expect(zona.left).toBeGreaterThanOrEqual(-1)
  expect(zona.right).toBeLessThanOrEqual(ancho + 1)
  expect(zona.height, 'el aviso no ocupa más del 40 % del alto').toBeLessThanOrEqual(0.4 * ALTO + 1)

  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeVisible()
  expect(boton.height).toBeGreaterThanOrEqual(48)
  expect(boton.width).toBeGreaterThanOrEqual(48)
  expect(boton.left).toBeGreaterThanOrEqual(aviso.left - 1)
  expect(boton.right).toBeLessThanOrEqual(aviso.right + 1)
  expect(boton.bottom).toBeLessThanOrEqual(aviso.bottom + 1)
  const contenidoCabe = await page
    .locator('.aviso-deshacer button')
    .evaluate((b) => b.scrollWidth <= b.clientWidth + 1)
  expect(contenidoCabe, 'el contenido del botón no se sale de él').toBe(true)

  expect(
    mensaje.width,
    'el mensaje usa al menos la mitad del ancho del aviso',
  ).toBeGreaterThanOrEqual(aviso.width / 2)

  const enlaces = await page.locator('nav .enlace').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }),
  )
  expect(enlaces).toHaveLength(5)
  for (const enlace of enlaces) {
    expect(enlace.top).toBeGreaterThanOrEqual(-1)
    expect(enlace.bottom).toBeLessThanOrEqual(ALTO + 1)
    expect(enlace.left).toBeGreaterThanOrEqual(-1)
    expect(enlace.right).toBeLessThanOrEqual(ancho + 1)
  }
  await esperarSinDesplazamientoHorizontal(page)
  await esperarAvisoTodaviaVisible(page)
}

// N1 + N5 + m11 (ronda 4): el aviso Deshacer en celular (encima de la barra) y en PC (en la
// columna de contenido, nunca dentro de la barra lateral).
test.describe('N1/N5: aviso Deshacer legible, con botón grande y sin tapar la navegación', () => {
  for (const ancho of CELULAR) {
    for (const [nombre, mensaje] of MENSAJES) {
      test(`celular ${ancho}px, letra Muy grande, mensaje ${nombre}`, async ({ page }) => {
        await abrirConAviso(page, ancho, mensaje)
        await esperarAvisoBienArmado(page, ancho)
        const zona = await caja(page, '.zona-aviso-deshacer')
        const nav = await caja(page, 'nav')
        expect(zona.bottom, 'el aviso va encima de la barra, sin taparla').toBeLessThanOrEqual(
          nav.top + 1,
        )
      })
    }
  }

  for (const ancho of PC) {
    for (const [nombre, mensaje] of MENSAJES) {
      test(`PC ${ancho}px, letra Muy grande, mensaje ${nombre}`, async ({ page }) => {
        await abrirConAviso(page, ancho, mensaje)
        await esperarAvisoBienArmado(page, ancho)
        const zona = await caja(page, '.zona-aviso-deshacer')
        const nav = await caja(page, 'nav')
        expect(zona.left, 'el aviso va en la columna de contenido').toBeGreaterThanOrEqual(
          nav.right - 1,
        )
        expect(Math.abs(zona.bottom - ALTO), 'pegado al fondo de la ventana').toBeLessThanOrEqual(1)
      })
    }
  }
})

test('RN-SIS-07: sin violaciones graves de accesibilidad con el aviso Deshacer visible', async ({
  page,
}) => {
  await abrir(page, './')
  await mostrarAvisoDeshacer(page)
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeVisible()
  await esperarSinViolacionesGraves(page)
  await esperarAvisoTodaviaVisible(page)
})

/** Recorre con Tab y devuelve los elementos de #contenido que quedaron debajo de `selectorPegado`. */
async function recorrerConTab(page: Page, selectorPegado: string, pasos = 25) {
  const tapados: string[] = []
  let revisados = 0
  for (let i = 0; i < pasos; i += 1) {
    await page.keyboard.press('Tab')
    const medida = await page.evaluate((sel) => {
      const activo = document.activeElement
      if (!activo?.closest('#contenido')) return null
      const pegado = document.querySelector(sel)
      return {
        texto: activo.textContent?.trim() ?? '',
        abajo: activo.getBoundingClientRect().bottom,
        limite: pegado ? pegado.getBoundingClientRect().top : window.innerHeight,
      }
    }, selectorPegado)
    if (!medida) continue
    revisados += 1
    if (medida.abajo > medida.limite + 1)
      tapados.push(`${medida.texto} (${medida.abajo} > ${medida.limite})`)
  }
  return { revisados, tapados }
}

// m5 (ronda 4, WCAG 2.4.11): al recorrer con Tab, ningún elemento enfocado queda debajo de lo
// que está pegado abajo (pie con aviso y barra en celular; el aviso en PC).
test.describe('m5: el foco por teclado nunca queda tapado por lo que está pegado abajo', () => {
  for (const [ancho, selectorPegado] of [
    [360, '.pie'],
    [1280, '.zona-aviso-deshacer'],
  ] as const) {
    test(`${ancho}px, letra Muy grande, con aviso Deshacer`, async ({ page }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: ALTO })
      await abrir(page, './productos')
      await agregarContenidoLargo(page, 30, true)
      await mostrarAvisoDeshacer(page)
      await page.locator('#contenido h1').focus()

      const { revisados, tapados } = await recorrerConTab(page, selectorPegado)
      expect(revisados, 'se recorrieron enlaces del contenido').toBeGreaterThan(10)
      expect(tapados, 'elementos enfocados que quedaron tapados').toEqual([])
      await esperarAvisoTodaviaVisible(page)
    })
  }
})

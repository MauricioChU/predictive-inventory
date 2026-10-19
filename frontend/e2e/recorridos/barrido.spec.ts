// Plan 16, ítem 3 (RN-UX-09, RN-UX-02, RN-UX-15, RN-SIS-06/07): todas las pantallas de la app,
// rutas hijas y diálogos principales incluidos, en cada tamaño y con letra Muy grande.
import process from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import {
  esperarOrdenDeFocoLogico,
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
  usarLetra,
} from '../utilidades/calidad'
import { palabrasPartidas } from '../utilidades/control'
import { abrir } from '../utilidades/navegacion'
import { tocablesChicos } from '../utilidades/operaciones'
import {
  mostrarPantalla,
  PANTALLAS_DE_LA_PRIMERA_VEZ,
  PANTALLAS_VACIAS,
  pantallasDeLaTienda,
  prepararTiendaEnUso,
  type Pantalla,
} from '../utilidades/pantallas-de-la-app'
import { abrirTiendaLista } from '../utilidades/tienda'

interface Tamano {
  nombre: string
  ancho: number
  alto: number
  /** Además, el orden de foco con Tab (una vez por disposición: celular y PC). */
  foco?: boolean
  /** axe-core (lo más lento): por defecto una vez por pantalla; con BARRIDO_COMPLETO, siempre. */
  axe?: boolean
}

/**
 * Celular: 320 y 360 px de ancho y el celular en horizontal. PC: 768 (tablet), 1280 y 1920 px.
 * Por defecto, en TODAS las pantallas y diálogos: el celular en horizontal y 320 px (el más
 * angosto, con letra Muy grande) y 1920 px, con el orden de foco en horizontal y a 1920 px
 * (navegación abajo y lateral). axe-core, que es lo más lento y casi no depende del ancho, corre
 * una vez por pantalla (a 1920 px). Con BARRIDO_COMPLETO=1 suma 360, 768 y 1280 px, con axe en
 * cada tamaño (unos 3 minutos más).
 */
const COMPLETO = Boolean(process.env.BARRIDO_COMPLETO)
const TAMANOS: Record<string, readonly Tamano[]> = {
  celular: [
    { nombre: 'celular en horizontal', ancho: 740, alto: 360, foco: true, axe: COMPLETO },
    { nombre: '320 px', ancho: 320, alto: 640, axe: COMPLETO },
    ...(COMPLETO ? [{ nombre: '360 px', ancho: 360, alto: 740, foco: true, axe: true }] : []),
  ],
  pc: [
    { nombre: '1920 px', ancho: 1920, alto: 1080, foco: true, axe: true },
    ...(COMPLETO
      ? [
          { nombre: '768 px', ancho: 768, alto: 1024, axe: true },
          { nombre: '1280 px', ancho: 1280, alto: 800, foco: true, axe: true },
        ]
      : []),
  ],
}

/** Lo que nunca se parte a media palabra: todo lo que se lee (montos con espacios duros). */
async function esperarSinPalabrasPartidas(page: Page): Promise<void> {
  const partidas = [...(await palabrasPartidas(page.locator('#contenido')))]
  // RN-UX-16: durante la primera vez no hay navegación.
  if ((await page.locator('nav').count()) > 0) {
    partidas.push(...(await palabrasPartidas(page.locator('nav'))))
  }
  for (const dialogo of await page.locator('dialog[open]').all()) {
    partidas.push(...(await palabrasPartidas(dialogo)))
  }
  expect(partidas, 'ninguna palabra ni monto partido entre dos líneas').toEqual([])
}

/** Espera a que la disposición se acomode al tamaño nuevo (alto-observado, fuentes). */
async function cambiarTamano(page: Page, tamano: Tamano): Promise<void> {
  await page.setViewportSize({ width: tamano.ancho, height: tamano.alto })
  await page.evaluate(
    () =>
      new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo()))),
  )
  await page.evaluate(() => document.fonts.ready)
}

/** Todas las verificaciones de calidad, en el tamaño en que está la pantalla ahora. */
async function esperarPantallaDeCalidad(page: Page, donde: string, tamano: Tamano): Promise<void> {
  await esperarSinDesplazamientoHorizontal(page)
  expect(await tocablesChicos(page), `${donde}: tocables de buen tamaño`).toEqual([])
  await esperarSinPalabrasPartidas(page)
  if (tamano.axe) await esperarSinViolacionesGraves(page)
  if (tamano.foco) await esperarOrdenDeFocoLogico(page)
}

/** Cada pantalla se abre una vez y se revisa en cada tamaño (cada uno es un paso del informe). */
async function esperarPantallasDeCalidad(
  page: Page,
  pantallas: readonly Pantalla[],
  tamanos: readonly Tamano[],
): Promise<void> {
  for (const pantalla of pantallas) {
    await cambiarTamano(page, tamanos[0]!)
    await mostrarPantalla(page, pantalla)
    for (const tamano of tamanos) {
      const donde = `${pantalla.nombre}, ${tamano.nombre}`

      await test.step(donde, async () => {
        await cambiarTamano(page, tamano)
        await esperarPantallaDeCalidad(page, donde, tamano)
      })
    }
  }
}

test.describe('Barrido de todas las pantallas con letra Muy grande', () => {
  test('la primera vez (sin navegación, RN-UX-16)', async ({ page }, testInfo) => {
    test.setTimeout(150_000)
    const tamanos = TAMANOS[testInfo.project.name]!
    await usarLetra(page, 'MUY_GRANDE')
    await esperarPantallasDeCalidad(page, PANTALLAS_DE_LA_PRIMERA_VEZ, tamanos)
  })

  test('los estados vacíos', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const tamanos = TAMANOS[testInfo.project.name]!
    await usarLetra(page, 'MUY_GRANDE')
    await abrirTiendaLista(page, './')
    await esperarPantallasDeCalidad(page, PANTALLAS_VACIAS, tamanos)
  })

  test('la tienda en uso (ocho semanas de ventas)', async ({ page }, testInfo) => {
    test.setTimeout(300_000)
    const tamanos = TAMANOS[testInfo.project.name]!
    await usarLetra(page, 'MUY_GRANDE')
    const ids = await prepararTiendaEnUso(page)
    await abrir(page, './')
    await esperarPantallasDeCalidad(page, pantallasDeLaTienda(ids), tamanos)
  })
})

test.describe('Hallazgos del barrido', () => {
  test('320 px, letra Muy grande: la categoría elegida (en negrita) no parte su palabra más larga', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'Es el ancho más chico de celular')
    await usarLetra(page, 'MUY_GRANDE')
    await page.setViewportSize({ width: 320, height: 640 })
    await abrir(page, './productos/nuevo')
    await page.evaluate(() => document.fonts.ready)
    const categorias = page.getByRole('radiogroup', { name: 'Categoría' })
    for (const nombre of ['Lejías y desinfectantes', 'Ambientadores e insecticidas', 'Carbón y combustibles']) {
      await categorias.getByRole('radio', { name: nombre }).click()
      await expect(categorias.getByRole('radio', { name: nombre })).toBeChecked()
      expect(await palabrasPartidas(categorias), nombre).toEqual([])
    }
  })
})

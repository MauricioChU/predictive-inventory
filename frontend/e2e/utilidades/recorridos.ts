// Plan 16 (`feat/e2e-calidad`): lo que la persona hace con los dedos, paso a paso, para los
// recorridos completos de e2e/recorridos/. Nada pasa por `window.__aplicacion`: cada acción es
// un toque o un texto escrito en la pantalla real.
import process from 'node:process'
import { expect, type Locator, type Page, type Worker } from '@playwright/test'
import { FOTO_PNG } from './productos'
import { enLima } from './historia-de-demostracion'
import { abrir } from './navegacion'

export const h1 = (page: Page) => page.getByRole('heading', { level: 1 })

/** U+00A0: las cifras van con espacios que no cortan ("12 unid."). Se comparan como se leen. */
export function comoSeLee(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]'))
}

/** El texto entero, tal como se lee (espacios normales o duros, saltos de línea). */
export function exactoComoSeLee(texto: string): RegExp {
  const partes = texto
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^\\s*${partes.join('\\s+')}\\s*$`)
}

/** Espera (web-first) que el elemento diga exactamente `texto`, como se lee en pantalla. */
export async function esperarTexto(locator: Locator, texto: string): Promise<void> {
  await expect(locator).toHaveText(exactoComoSeLee(texto), { useInnerText: true })
}

/** El día de hoy en la tienda (America/Lima, UTC−5), "2026-10-16". */
export function hoyEnLima(): string {
  return new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10)
}

/**
 * Fija el reloj de la página en hoy a las 10:00 de Lima (y deja que siga corriendo): todo el
 * recorrido cae en el mismo día de la tienda aunque la prueba corra cerca de medianoche.
 * Llamar antes del primer `abrir`.
 */
export async function empezarElDia(page: Page): Promise<void> {
  await page.clock.install({ time: enLima(hoyEnLima(), '10:00') })
}

export type LetraDePantalla = 'Normal' | 'Grande' | 'Muy grande'

/** Primera vez por la pantalla: bienvenida → nombre → letra → "¿Cómo quieres cargar…?". */
export async function hacerPrimeraVezHastaCargar(
  page: Page,
  nombre = 'Bodega Rosita',
  letra: LetraDePantalla = 'Grande',
): Promise<void> {
  await abrir(page, './')
  await expect(h1(page)).toHaveText('Te damos la bienvenida')
  await page.getByRole('button', { name: 'Empezar' }).click()
  await expect(h1(page)).toHaveText('¿Cómo se llama tu tienda?')
  await page.getByLabel('Nombre de la tienda').fill(nombre)
  await page.getByRole('button', { name: 'Seguir' }).click()
  await expect(h1(page)).toHaveText('¿Qué tamaño de letra prefieres?')
  await page.getByRole('radio', { name: letra, exact: true }).click()
  await page.getByRole('button', { name: 'Seguir' }).click()
  await expect(h1(page)).toHaveText('¿Cómo quieres cargar tus productos?')
}

/** La primera vez completa, dejando los productos para después: termina en Inicio. */
export async function hacerPrimeraVez(page: Page, nombre = 'Bodega Rosita'): Promise<void> {
  await hacerPrimeraVezHastaCargar(page, nombre)
  await page.getByRole('button', { name: 'Dejar para después' }).click()
  await expect(h1(page)).toHaveText(new RegExp(`^Hola, ${nombre}`))
}

export interface ProductoPorPantalla {
  nombre: string
  categoria?: string
  compra: string
  venta: string
  minimo?: string
  stock: string
  conFoto?: boolean
}

/**
 * Llena "Producto nuevo" (ya abierto) y lo guarda: termina en "Producto guardado".
 * Con `conFoto`, elige una foto de la galería (el otro campo abre la cámara).
 */
export async function llenarProductoNuevo(page: Page, p: ProductoPorPantalla): Promise<void> {
  await expect(h1(page)).toHaveText('Producto nuevo')
  await page.getByLabel('Nombre del producto').fill(p.nombre)
  if (p.conFoto) {
    const foto = page.getByRole('group', { name: 'Foto del producto' })
    await foto
      .locator('input[type="file"]:not([capture])')
      .setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: FOTO_PNG })
    await expect(foto.getByRole('img', { name: p.nombre })).toBeVisible()
  }
  await page.getByRole('radio', { name: p.categoria ?? 'Otros', exact: true }).click()
  await page.getByLabel('Precio de compra por unidad (S/)').fill(p.compra)
  await page.getByLabel('Precio de venta por unidad (S/)').fill(p.venta)
  await page.getByLabel('¿Cuántos tienes ahora?').fill(p.stock)
  if (p.minimo !== undefined) await page.getByLabel('Stock mínimo').fill(p.minimo)
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(h1(page)).toHaveText('Producto guardado')
}

/** Desde la navegación: Productos → "Agregar producto" (o "Agregar el primero") → guardar. */
export async function crearProductoPorPantalla(page: Page, p: ProductoPorPantalla): Promise<void> {
  await irA(page, 'Productos')
  await page.getByRole('button', { name: /^Agregar (el primero|producto)$/ }).click()
  await llenarProductoNuevo(page, p)
}

/** Un destino de la navegación fija (RN-UX-12). */
export async function irA(
  page: Page,
  destino: 'Inicio' | 'Vender' | 'Recibir' | 'Productos' | 'Control',
): Promise<void> {
  await page
    .getByRole('navigation')
    .getByRole('link', { name: new RegExp(`^${destino}`) })
    .click()
  await expect(page.locator('[data-app-montada] #contenido h1')).toBeVisible()
}

export const lineaDelCarrito = (page: Page, nombre: string) =>
  page.locator('.lista-del-carrito').getByRole('group', { name: nombre })

/** En Vender o Recibir: busca y toca el producto; queda en el carrito. */
export async function agregarAlCarrito(page: Page, buscado: string, nombre: string): Promise<void> {
  await page.getByLabel('Buscar producto').fill(buscado)
  await page
    .getByRole('list', { name: 'Resultados' })
    .getByRole('button', { name: new RegExp(`^${nombre}`) })
    .click()
  await expect(lineaDelCarrito(page, nombre)).toBeVisible()
}

export interface LineaDeVenta {
  buscado: string
  nombre: string
  cantidad: number
}

/**
 * Una venta entera desde Vender: agrega las líneas, cambia la cantidad con "+", Cobrar, paga con
 * un billete (o "Exacto") y confirma. Con `vueltoEsperado`, antes de confirmar verifica el
 * mensaje del vuelto ("Vuelto S/ 3.00"). Termina en "Venta registrada".
 */
export async function venderPorPantalla(
  page: Page,
  lineas: readonly LineaDeVenta[],
  billete: 'S/ 10' | 'S/ 20' | 'S/ 50' | 'S/ 100' | 'Exacto',
  totalEsperado: string,
  vueltoEsperado?: string,
): Promise<void> {
  await expect(h1(page)).toHaveText('Vender')
  for (const linea of lineas) {
    await agregarAlCarrito(page, linea.buscado, linea.nombre)
    for (let i = 1; i < linea.cantidad; i += 1) {
      await lineaDelCarrito(page, linea.nombre)
        .getByRole('button', { name: 'Agregar uno' })
        .click()
    }
    await expect(lineaDelCarrito(page, linea.nombre).getByLabel(/^Cantidad/)).toHaveValue(
      String(linea.cantidad),
    )
  }
  await expect(page.locator('.barra-de-total .total')).toHaveText(comoSeLee(totalEsperado))
  await page.getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('button', { name: billete, exact: true }).click()
  if (vueltoEsperado !== undefined) {
    await esperarTexto(page.locator('.selector-de-billetes .mensaje'), vueltoEsperado)
  }
  await page.getByRole('button', { name: 'Confirmar venta' }).click()
  await expect(h1(page)).toHaveText('Venta registrada')
}

/** El ✓ de una venta: "Nueva venta" vuelve a Vender vacío. */
export async function nuevaVenta(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Nueva venta' }).click()
  await expect(h1(page)).toHaveText('Vender')
  await expect(page.locator('.lista-del-carrito .fila-de-carrito')).toHaveCount(0)
}

/** Abre el detalle de un producto desde la lista de Productos (buscándolo). */
export async function abrirProducto(page: Page, buscado: string, nombre: string): Promise<void> {
  await irA(page, 'Productos')
  await page.getByLabel('Buscar producto').fill(buscado)
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click()
  await expect(h1(page)).toHaveText(nombre)
}

/**
 * El Service Worker de la app (build de producción). Si Playwright todavía no lo vio, se espera a
 * que la página tenga uno listo y a que aparezca; si no hay, devuelve undefined.
 */
async function trabajadorDeLaApp(page: Page): Promise<Worker | undefined> {
  const contexto = page.context()
  const [visto] = contexto.serviceWorkers()
  if (visto) return visto
  const aparece = contexto.waitForEvent('serviceworker', { timeout: 10_000 }).catch(() => undefined)
  const hayUno = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return false
    const registro = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<undefined>((listo) => setTimeout(() => listo(undefined), 5_000)),
    ])
    return registro !== undefined
  })
  const [yaEsta] = contexto.serviceWorkers()
  return yaEsta ?? (hayUno ? await aparece : undefined)
}

/**
 * Toca una notificación con la app abierta (spec 03 · RN-AL-07).
 * - Build de producción (CI, preview): corre `abrirPantalla` de public/sw-notificaciones.js
 *   dentro del Service Worker de verdad (lo que hace su manejador de `notificationclick`, sin el
 *   evento en sí): busca la ventana de la app, la "enfoca" (eso se simula) y le manda la
 *   pantalla. Si no hay Service Worker, la prueba FALLA (nunca cae al mensaje simulado).
 * - Desarrollo (sin Service Worker): se le manda a la ventana el mismo mensaje que mandaría él.
 */
export async function tocarNotificacion(page: Page, url: string): Promise<void> {
  const trabajador = process.env.CI ? await trabajadorDeLaApp(page) : page.context().serviceWorkers()[0]
  if (process.env.CI && !trabajador) {
    throw new Error('Build de producción sin Service Worker: no se puede tocar la notificación')
  }
  if (trabajador) {
    await trabajador.evaluate(async (datos) => {
      const alcance = globalThis as unknown as {
        abrirPantalla(d: { url: string }): Promise<void>
        WindowClient: { prototype: { focus(): Promise<unknown> } }
      }
      // Fuera de un toque de verdad el navegador no deja enfocar la ventana: solo eso se
      // simula; buscar la ventana de la app y mandarle la pantalla es el código real.
      const { prototype } = alcance.WindowClient
      const enfocar = prototype.focus
      prototype.focus = async function (this: unknown) {
        return this
      }
      try {
        await alcance.abrirPantalla(datos)
      } finally {
        prototype.focus = enfocar
      }
    }, { url })
    return
  }
  await page.evaluate((ruta) => {
    const alcance = new URL('/predictive-inventory/', location.origin)
    const destino = new URL(ruta.replace(/^\/+/, ''), alcance).href
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', { data: { tipo: 'abrir-ruta', url: destino } }),
    )
  }, url)
}

/** La dirección que abre una notificación con la app cerrada (`clients.openWindow`). */
export function direccionDeLaNotificacion(url: string): string {
  return `./${url.replace(/^\/+/, '')}`
}

/**
 * El texto de un elemento como se lee (espacios duros como espacios, sin dobles). Solo para
 * guardar lo que se ve y compararlo después (p. ej. antes y después de restaurar una copia);
 * para verificar un texto, `esperarTexto` (web-first).
 */
export async function textoVisible(page: Page, selector: string): Promise<string> {
  const texto = await page.locator(selector).innerText()
  return texto.replace(/\s+/g, ' ').trim()
}

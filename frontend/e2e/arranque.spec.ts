import process from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { esperarSinViolacionesGraves } from './utilidades/calidad'
import { abrir } from './utilidades/navegacion'

/** Lo que estas pruebas usan de la aplicación real (window.__aplicacion, ganchos de prueba). */
interface AplicacionEnLaPagina {
  catalogo: {
    listarCategorias(): Promise<{ id: string; nombre: string }[]>
    crearProducto(datos: Record<string, unknown>): Promise<{ tipo: string; valor?: { productoId: string } }>
  }
  inventario: {
    registrarVenta(datos: { lineas: { productoId: string; cantidad: string }[] }): Promise<unknown>
    consultable: { stockDe(productoId: string): Promise<{ milesimas: number }> }
  }
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionEnLaPagina }

/** Lo guardado de verdad en IndexedDB (otra conexión a la base de la app). */
async function leerBaseLocal(page: Page): Promise<{ categorias: number; dispositivoId?: string }> {
  return page.evaluate(
    () =>
      new Promise((resolver, rechazar) => {
        const pedido = indexedDB.open('predictive-inventory')
        pedido.onerror = () => rechazar(pedido.error)
        pedido.onsuccess = () => {
          const db = pedido.result
          const transaccion = db.transaction(['categorias', 'configuracion'], 'readonly')
          const categorias = transaccion.objectStore('categorias').count()
          const sistema = transaccion.objectStore('configuracion').get('sistema')
          transaccion.oncomplete = () => {
            db.close()
            resolver({
              categorias: categorias.result,
              dispositivoId: (sistema.result as { dispositivoId?: string } | undefined)?.dispositivoId,
            })
          }
        }
      }),
  )
}

/** Crea un producto por el caso de uso real de Catálogo; devuelve su id. */
async function crearProducto(page: Page, stockInicial: string): Promise<string> {
  return page.evaluate(async (stock) => {
    const aplicacion = (window as VentanaConAplicacion).__aplicacion
    if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
    const [categoria] = await aplicacion.catalogo.listarCategorias()
    const respuesta = await aplicacion.catalogo.crearProducto({
      nombre: 'Lejía 1 L',
      categoriaId: categoria!.id,
      unidad: 'UNIDAD',
      precioCompra: '2.40',
      precioVenta: '3.50',
      stockMinimo: '3',
      stockInicial: stock,
    })
    if (!respuesta.valor) throw new Error(`No se creó el producto: ${JSON.stringify(respuesta)}`)
    return respuesta.valor.productoId
  }, stockInicial)
}

const enlaceControl = (page: Page) => page.getByRole('link', { name: /^Control/ })

test.describe('Ola 3: la app arranca con los datos guardados en el celular', () => {
  test('siembra las categorías, crea el dispositivo y el botón Control muestra el contador real', async ({
    page,
  }) => {
    await abrir(page, './')

    const base = await leerBaseLocal(page)
    expect(base.categorias, 'las 10 categorías iniciales quedaron en IndexedDB').toBe(10)
    expect(base.dispositivoId, 'el estado del sistema tiene su dispositivo').toBeTruthy()
    // Contador real: 0 (la barra no muestra número ni texto de atención).
    await expect(enlaceControl(page)).toHaveAccessibleName('Control')
    await expect(page.locator('nav .insignia')).toHaveCount(0)

    // Un producto agotado (stock 0): el evento refresca el contador sin recargar.
    await crearProducto(page, '0')
    await expect(page.locator('nav .insignia')).toHaveText('1')
    await expect(enlaceControl(page)).toHaveAccessibleName('Control 1 producto necesita atención')

    // Al volver a abrir, los datos siguen ahí y el contador sale de ellos.
    await abrir(page, './')
    await expect(page.locator('nav .insignia')).toHaveText('1')
    expect((await leerBaseLocal(page)).dispositivoId).toBe(base.dispositivoId)
  })

  test('la navegación sigue funcionando con la aplicación montada', async ({ page }) => {
    await abrir(page, './')
    for (const destino of ['Vender', 'Recibir', 'Productos', 'Control', 'Inicio']) {
      await page.getByRole('link', { name: new RegExp(`^${destino}`) }).click()
      // Plan 12 (RN-UX-12): "Recibir" abre la pantalla titulada "Llegó mercadería".
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        destino === 'Recibir' ? 'Llegó mercadería' : destino,
      )
    }
  })

  test('RN-UX-07: si el navegador no deja abrir los datos, muestra qué pasó y qué hacer', async ({
    page,
  }) => {
    // Como una ventana privada que no deja usar IndexedDB.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined })
    })
    await page.goto('./')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No pudimos abrir tus datos')
    await expect(page.getByText('ábrela en una ventana normal')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Intentar de nuevo' })).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)
    await expect(page.getByText('Abriendo tus datos…')).toHaveCount(0)
    await esperarSinViolacionesGraves(page)
  })

  test('M1: mientras la base no termina de abrir, se anuncia "Abriendo tus datos…"', async ({
    page,
  }) => {
    // Una apertura de IndexedDB que nunca termina: la app no llega a montar.
    await page.addInitScript(() => {
      const real = window.indexedDB
      const lenta = new Proxy(real, {
        get(objetivo, propiedad) {
          if (propiedad === 'open') return () => ({})
          const valor = Reflect.get(objetivo, propiedad) as unknown
          return typeof valor === 'function' ? valor.bind(objetivo) : valor
        },
      })
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => lenta })
    })
    await page.goto('./')

    await expect(page.getByRole('status').filter({ hasText: 'Abriendo tus datos…' })).toBeVisible()
    await expect(page.locator('[data-app-montada]')).toHaveCount(0)
  })

  test('M2: si otra pestaña actualiza la base, esta lo dice y ofrece volver a abrir la app', async ({
    page,
    context,
  }) => {
    await abrir(page, './')
    // Otra pestaña con una versión más nueva de la app (una versión de la base más alta).
    const otra = await context.newPage()
    await abrir(otra, './')
    await otra.evaluate(
      () =>
        new Promise<void>((resolver, rechazar) => {
          const pedido = indexedDB.open('predictive-inventory', 1000)
          pedido.onsuccess = () => {
            pedido.result.close()
            resolver()
          }
          pedido.onerror = () => rechazar(pedido.error)
        }),
    )

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('La app se actualizó')
    await expect(page.getByRole('button', { name: 'Toca para volver a abrirla' })).toBeVisible()
    await expect(page.locator('[data-app-montada]')).toHaveCount(0)
    await esperarSinViolacionesGraves(page)
  })
})

test.describe('RN-SIS-08: sin conexión después de la primera carga (build de producción)', () => {
  test.skip(!process.env.CI, 'El Service Worker solo existe en el build de producción (npm run preview)')

  test('el Service Worker atiende la app y carga el aviso de notificaciones', async ({ page, request }) => {
    await abrir(page, './')
    const alcance = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
    expect(new URL(alcance).pathname).toBe('/predictive-inventory/')

    const sw = await (await request.get('./sw.js')).text()
    expect(sw, 'workbox importa el manejador de notificationclick').toContain('sw-notificaciones.js')
    const manejador = await request.get('./sw-notificaciones.js')
    expect(manejador.ok()).toBe(true)
    expect(await manejador.text()).toContain('notificationclick')
  })

  test('abre sin conexión, con todos sus recursos, y completa una venta', async ({ page, context }) => {
    await abrir(page, './')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    const lejia = await crearProducto(page, '10')

    await context.setOffline(true)
    const fallidos: string[] = []
    page.on('requestfailed', (pedido) => fallidos.push(pedido.url()))
    await page.reload()
    await expect(page.locator('#contenido h1')).toBeVisible()
    await abrir(page, './vender')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vender')

    const stock = await page.evaluate(async (productoId) => {
      const aplicacion = (window as VentanaConAplicacion).__aplicacion
      if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
      await aplicacion.inventario.registrarVenta({ lineas: [{ productoId, cantidad: '2' }] })
      return (await aplicacion.inventario.consultable.stockDe(productoId)).milesimas
    }, lejia)

    expect(stock).toBe(8000)
    expect(fallidos, 'ningún recurso falló sin conexión').toEqual([])
  })
})

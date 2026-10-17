// Plan 14 (`feat/ui-inicio-ajustes`): ayudantes de las E2E de Inicio, Primera vez y Ajustes.
import { expect, type Page } from '@playwright/test'
import { abrir } from './navegacion'

/** Lo que estas pruebas usan de `window.__aplicacion` (src/app/ganchos-de-prueba.ts). */
interface AplicacionE2E {
  tienda: {
    obtenerConfiguracion(): Promise<{
      nombreTienda: string
      tamanoDeLetra: string
      notificacionesActivas: boolean
    }>
    completarPrimeraVez(datos: { nombreTienda: string; tamanoDeLetra: string }): Promise<void>
  }
  catalogo: {
    listarCategorias(): Promise<{ id: string; nombre: string }[]>
    crearProducto(datos: Record<string, unknown>): Promise<{ tipo: string; valor?: { productoId: string } }>
    buscarProductos(filtro: { texto: string }): Promise<{ nombre: string }[]>
  }
  inventario: {
    registrarVenta(datos: { lineas: { productoId: string; cantidad: string }[] }): Promise<unknown>
    consultable: { stockDe(productoId: string): Promise<{ milesimas: number }> }
  }
  alertas: { notificacionesPermitidas(): Promise<boolean> }
  esperarTareasPendientes(): Promise<void>
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionE2E }

export const NOMBRE_DE_LA_TIENDA = 'Bodega Rosita'

/**
 * La tienda como en el uso diario: la primera vez (nombre y letra) ya está hecha, por el caso de
 * uso real. Después abre `ruta` (Inicio ya no lleva a la bienvenida).
 */
export async function abrirTiendaLista(
  page: Page,
  ruta = './',
  nombreTienda = NOMBRE_DE_LA_TIENDA,
): Promise<void> {
  await abrir(page, './ajustes')
  await page.evaluate(async (nombre) => {
    const app = (window as VentanaConAplicacion).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    const { tamanoDeLetra } = await app.tienda.obtenerConfiguracion()
    await app.tienda.completarPrimeraVez({ nombreTienda: nombre, tamanoDeLetra })
  }, nombreTienda)
  await abrir(page, ruta)
}

/** Crea un producto por el caso de uso real de Catálogo (categoría "Otros"); devuelve su id. */
export async function crearProducto(
  page: Page,
  producto: { nombre: string; compra: string; venta: string; minimo?: string; stock: string },
): Promise<string> {
  return page.evaluate(async (datos) => {
    const app = (window as VentanaConAplicacion).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    const categorias = await app.catalogo.listarCategorias()
    const otros = categorias.find((c) => c.nombre === 'Otros') ?? categorias[0]
    const respuesta = await app.catalogo.crearProducto({
      nombre: datos.nombre,
      categoriaId: otros!.id,
      unidad: 'UNIDAD',
      precioCompra: datos.compra,
      precioVenta: datos.venta,
      stockMinimo: datos.minimo ?? '0',
      stockInicial: datos.stock,
      confirmado: true,
    })
    if (!respuesta.valor) throw new Error(`No se creó el producto: ${JSON.stringify(respuesta)}`)
    await app.esperarTareasPendientes()
    return respuesta.valor.productoId
  }, producto)
}

export async function vender(page: Page, productoId: string, cantidad: string): Promise<void> {
  await page.evaluate(
    async ({ id, cuanto }) => {
      const app = (window as VentanaConAplicacion).__aplicacion
      if (!app) throw new Error('La app no expuso window.__aplicacion')
      await app.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: cuanto }] })
      await app.esperarTareasPendientes()
    },
    { id: productoId, cuanto: cantidad },
  )
}

/** Stock en milésimas. */
export async function stockDe(page: Page, productoId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const app = (window as VentanaConAplicacion).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    return (await app.inventario.consultable.stockDe(id)).milesimas
  }, productoId)
}

export async function nombresDelCatalogo(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const app = (window as VentanaConAplicacion).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    return (await app.catalogo.buscarProductos({ texto: '' })).map((p) => p.nombre).sort()
  })
}

export async function configuracionYAvisos(
  page: Page,
): Promise<{ notificacionesActivas: boolean; permitidas: boolean; tamanoDeLetra: string }> {
  return page.evaluate(async () => {
    const app = (window as VentanaConAplicacion).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    const configuracion = await app.tienda.obtenerConfiguracion()
    return {
      notificacionesActivas: configuracion.notificacionesActivas,
      tamanoDeLetra: configuracion.tamanoDeLetra,
      permitidas: await app.alertas.notificacionesPermitidas(),
    }
  })
}

/** Sin menú de compartir (Web Share): la app descarga los archivos, que la prueba recibe. */
export async function sinMenuDeCompartir(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined })
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined })
  })
}

/**
 * Un navegador cuyas notificaciones la persona acepta al primer pedido (el diálogo real del
 * navegador no se puede tocar desde la prueba, y el Chromium sin ventana las tiene bloqueadas).
 * `data-pedidos-de-permiso` en <html> cuenta cuántas veces se pidió el permiso (RN-AL-08).
 */
export async function notificacionesQueSeAceptan(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let permiso: NotificationPermission = 'default'
    let pedidos = 0
    class NotificacionDePrueba {
      static get permission(): NotificationPermission {
        return permiso
      }
      static async requestPermission(): Promise<NotificationPermission> {
        pedidos += 1
        document.documentElement.dataset.pedidosDePermiso = String(pedidos)
        permiso = 'granted'
        return permiso
      }
    }
    Object.defineProperty(window, 'Notification', { configurable: true, value: NotificacionDePrueba })
  })
}

/** RN-UX-02: lo tocable de la pantalla mide al menos 48 × 48 px y los botones principales 56 px de alto. */
export async function esperarObjetivosTactiles(page: Page): Promise<void> {
  const { chicos, principales } = await page.evaluate(() => {
    const visibles = (selector: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .map((el) => ({ el, caja: el.getBoundingClientRect() }))
        .filter(({ caja }) => caja.width > 0 && caja.height > 0)
    const nombre = (el: HTMLElement) => `${el.tagName.toLowerCase()} "${el.textContent?.trim() ?? ''}"`
    return {
      chicos: visibles('#contenido :is(button, a, input, select, [role="radio"])')
        .filter(({ caja }) => caja.width < 47.5 || caja.height < 47.5)
        .map(({ el, caja }) => `${nombre(el)} ${Math.round(caja.width)}×${Math.round(caja.height)}`),
      principales: visibles('#contenido .boton-principal')
        .filter(({ caja }) => caja.height < 55.5)
        .map(({ el, caja }) => `${nombre(el)} alto ${Math.round(caja.height)}`),
    }
  })
  expect(chicos, 'todo lo tocable mide al menos 48 × 48 px').toEqual([])
  expect(principales, 'los botones principales miden al menos 56 px de alto').toEqual([])
}

/**
 * El encabezado se lee entero: "Volver" en una sola línea (no una letra por renglón al lado de un
 * título largo) y el título con sus palabras completas.
 */
export async function esperarEncabezadoLegible(page: Page): Promise<void> {
  const { volver, titulo } = await page.evaluate(() => {
    const lineas = (el: Element | null) => {
      if (!el) return 0
      const rango = document.createRange()
      rango.selectNodeContents(el)
      return new Set(Array.from(rango.getClientRects(), (r) => Math.round(r.top))).size
    }
    const partidas = (el: Element | null) => {
      const texto = el?.firstChild
      if (!el || !texto?.textContent) return [] as string[]
      const palabras: string[] = []
      let inicio = 0
      for (const palabra of texto.textContent.split(' ')) {
        const rango = document.createRange()
        rango.setStart(texto, inicio)
        rango.setEnd(texto, inicio + palabra.length)
        if (new Set(Array.from(rango.getClientRects(), (r) => Math.round(r.top))).size > 1) palabras.push(palabra)
        inicio += palabra.length + 1
      }
      return palabras
    }
    return {
      volver: lineas(document.querySelector('#contenido .encabezado-pagina .volver span')),
      titulo: partidas(document.querySelector('#contenido .encabezado-pagina h1')),
    }
  })
  expect(volver, '"Volver" en una sola línea').toBeLessThanOrEqual(1)
  expect(titulo, 'ninguna palabra del título se parte').toEqual([])
}

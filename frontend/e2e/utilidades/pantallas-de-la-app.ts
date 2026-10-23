// Plan 16, ítems 3 y 5: TODAS las pantallas de la app (rutas hijas y diálogos principales
// incluidos), cada una con lo que puede llegar a mostrar, para el barrido de calidad y la
// auditoría de textos. Los datos se preparan con la historia de demostración (casos de uso
// reales y el reloj de Playwright, ver historia-de-demostracion.ts).
import { expect, type Page } from '@playwright/test'
import { prepararHistoriaDeDemostracion, type IdsDeDemostracion } from './historia-de-demostracion'
import { abrir, esperarQueTermineLaAnimacion } from './navegacion'
import { agregarAlCarrito, cerrarDetalleDeVenta, lineaDelCarrito } from './recorridos'
import { crearProducto } from './tienda'

export interface Pantalla {
  /** Cómo se llama en el informe de la prueba. */
  nombre: string
  ruta: string
  /** Lo que se toca después de abrir la ruta para llegar a ese estado (un diálogo, un paso). */
  preparar?: (page: Page) => Promise<void>
}

/** La primera vez, con la app recién instalada (sin datos). */
export const PANTALLAS_DE_LA_PRIMERA_VEZ: readonly Pantalla[] = [
  { nombre: 'Bienvenida', ruta: './' },
  { nombre: 'Primera vez: nombre', ruta: './bienvenida?paso=nombre' },
  {
    nombre: 'Primera vez: nombre sin escribir (error)',
    ruta: './bienvenida?paso=nombre',
    preparar: async (page) => {
      await page.getByRole('button', { name: 'Seguir' }).click()
      await expect(page.getByRole('alert').first()).toBeVisible()
    },
  },
  { nombre: 'Primera vez: letra', ruta: './bienvenida?paso=letra' },
  { nombre: 'Primera vez: cargar productos', ruta: './bienvenida?paso=productos' },
  { nombre: 'Primera vez: contar (sin productos)', ruta: './bienvenida?paso=contar' },
  { nombre: 'Primera vez: restaurar copia (desde la bienvenida)', ruta: './ajustes/restaurar?desde=primera-vez' },
  { nombre: 'Primera vez: producto nuevo', ruta: './productos/nuevo?desde=primera-vez' },
  { nombre: 'Primera vez: importar productos', ruta: './ajustes/importar?desde=primera-vez' },
  {
    // Con un producto cargado: "Contar ahora" y "Terminar" (RN-UX-16). Es la última: deja un producto cargado,
    // así que los estados vacíos se revisan en otro perfil (otra prueba).
    nombre: 'Primera vez: contar (con productos)',
    ruta: './bienvenida?paso=contar',
    preparar: async (page) => {
      await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', stock: '10' })
      await abrir(page, './bienvenida?paso=contar')
      await expect(page.getByRole('button', { name: 'Contar ahora' })).toBeVisible()
    },
  },
]

/** Con la primera vez hecha y todavía sin productos: los estados vacíos (RN-UX-10). */
export const PANTALLAS_VACIAS: readonly Pantalla[] = [
  { nombre: 'Inicio sin productos', ruta: './' },
  { nombre: 'Productos sin productos', ruta: './productos' },
  { nombre: 'Vender sin productos', ruta: './vender' },
  { nombre: 'Historial vacío', ruta: './historial' },
  { nombre: 'Control sin datos', ruta: './control' },
  { nombre: 'Para comprar vacío', ruta: './control/para-comprar' },
  { nombre: 'Contar todo sin productos', ruta: './contar' },
  { nombre: 'Producto que no existe', ruta: './productos/no-existe' },
  { nombre: 'Operación que no existe', ruta: './historial/no-existe' },
]

const dialogo = (page: Page) => page.getByRole('dialog')

/** Una copia real de la tienda (para el diálogo de Restaurar copia). */
async function copiaDeLaTienda(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const app = (
      window as Window & {
        __aplicacion?: { respaldo: { guardarCopia(): Promise<{ contenido: Blob }> } }
      }
    ).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    return (await app.respaldo.guardarCopia()).contenido.text()
  })
}

/** Las pantallas con la tienda en uso (después de `prepararTiendaEnUso`). */
export function pantallasDeLaTienda(ids: IdsDeDemostracion): Pantalla[] {
  const lejia = ids['Lejía Tradicional 1 L']!
  const cera = ids['Cera roja 1 L']!
  const bolsas = ids['Bolsas de basura x10']!
  return [
    { nombre: 'Inicio', ruta: './' },
    { nombre: 'Primera vez: cargar productos', ruta: './bienvenida?paso=productos' },
    { nombre: 'Primera vez: contar', ruta: './bienvenida?paso=contar' },
    // Vender
    {
      // Celular: el panel de venta abierto (líneas, "quedan" y ¿Cuándo fue?); en PC, el carrito.
      nombre: 'Vender con carrito',
      ruta: './vender',
      preparar: async (page) => {
        await page.locator('.accesos-rapidos').getByRole('button', { name: 'Lejía Tradicional 1 L' }).click()
        await agregarAlCarrito(page, 'carbon', 'Carbón')
      },
    },
    {
      // Celular: el panel de venta compacto (RN-OP-22); en PC, el carrito de la derecha.
      nombre: 'Vender: panel compacto',
      ruta: './vender',
      preparar: async (page) => {
        await agregarAlCarrito(page, 'jabon', 'Jabón Bolívar')
        await cerrarDetalleDeVenta(page)
      },
    },
    {
      nombre: 'Vender: venta registrada (con Deshacer)',
      ruta: './vender',
      preparar: async (page) => {
        await agregarAlCarrito(page, 'jabon', 'Jabón Bolívar')
        await page.getByRole('button', { name: 'Confirmar venta' }).click()
        await expect(page.locator('.pantalla-exito .deshacer')).toBeVisible()
      },
    },
    // Recibir
    {
      nombre: 'Llegó mercadería con costo nuevo',
      ruta: './recibir',
      preparar: async (page) => {
        await agregarAlCarrito(page, 'lejia', 'Lejía Tradicional 1 L')
        const linea = lineaDelCarrito(page, 'Lejía Tradicional 1 L')
        await linea.getByRole('button', { name: 'Cambiar costo de Lejía Tradicional 1 L' }).click()
        await linea.getByLabel('Nuevo costo en S/').fill('2.60')
        await linea.getByRole('button', { name: 'Guardar costo' }).click()
      },
    },
    {
      nombre: 'Diálogo: ¿actualizar el precio de compra?',
      ruta: './recibir',
      preparar: async (page) => {
        await agregarAlCarrito(page, 'lejia', 'Lejía Tradicional 1 L')
        const linea = lineaDelCarrito(page, 'Lejía Tradicional 1 L')
        await linea.getByRole('button', { name: 'Cambiar costo de Lejía Tradicional 1 L' }).click()
        await linea.getByLabel('Nuevo costo en S/').fill('2.60')
        await linea.getByRole('button', { name: 'Guardar costo' }).click()
        await page.getByRole('button', { name: 'Registrar llegada' }).click()
        await expect(dialogo(page)).toBeVisible()
      },
    },
    {
      nombre: 'Diálogo: sobrecompra (RN-OP-20)',
      ruta: './recibir',
      preparar: async (page) => {
        await agregarAlCarrito(page, 'escoba', 'Escoba de paja')
        await page.getByRole('button', { name: 'Registrar llegada' }).click()
        await expect(dialogo(page)).toContainText('No se vende hace')
      },
    },
    { nombre: 'Llegó mercadería desde Para comprar', ruta: './recibir?desde=para-comprar' },
    // Productos
    {
      nombre: 'Productos (buscando, con la hoja de filtros abierta)',
      ruta: './productos',
      preparar: async (page) => {
        await page.getByLabel('Buscar producto').fill('l')
        await page.getByRole('button', { name: /^Filtros/ }).click()
        await esperarQueTermineLaAnimacion(page)
      },
    },
    {
      nombre: 'Productos: hoja de producto nuevo',
      ruta: './productos',
      preparar: async (page) => {
        await page.getByRole('button', { name: 'Agregar producto' }).click()
        await expect(page.getByRole('heading', { name: 'Producto nuevo' })).toBeVisible()
        await esperarQueTermineLaAnimacion(page)
      },
    },
    { nombre: 'Detalle de producto (con tendencia)', ruta: `./productos/${lejia}` },
    { nombre: 'Detalle de producto con pérdida en el precio', ruta: `./productos/${cera}` },
    { nombre: 'Detalle de producto agotado', ruta: `./productos/${bolsas}` },
    {
      nombre: 'Diálogo: ¿archivar este producto?',
      ruta: `./productos/${lejia}`,
      preparar: async (page) => {
        await page.getByRole('button', { name: 'Archivar producto' }).click()
        await expect(dialogo(page)).toBeVisible()
      },
    },
    {
      nombre: 'Producto nuevo (con errores)',
      ruta: './productos/nuevo',
      preparar: async (page) => {
        await page.getByRole('button', { name: 'Guardar producto' }).click()
        await expect(page.getByText('Escribe el nombre del producto')).toBeVisible()
      },
    },
    { nombre: 'Editar producto', ruta: `./productos/${lejia}/editar` },
    {
      nombre: 'Diálogo: ¿guardar con este precio?',
      ruta: `./productos/${lejia}/editar`,
      preparar: async (page) => {
        await page.getByLabel('Precio de venta por unidad (S/)').fill('2.00')
        await page.getByRole('button', { name: 'Guardar cambios' }).click()
        await expect(dialogo(page)).toBeVisible()
      },
    },
    {
      nombre: 'Categorías (cambiando un nombre)',
      ruta: './productos/categorias',
      preparar: async (page) => {
        await page.getByRole('button', { name: 'Cambiar nombre de Bolsas' }).click()
        await expect(page.getByLabel('Nuevo nombre para Bolsas')).toBeFocused()
      },
    },
    {
      nombre: 'Registrar pérdida (con errores)',
      ruta: `./productos/${lejia}/merma`,
      preparar: async (page) => {
        await page.getByRole('radio', { name: 'Otro' }).click()
        await page.getByRole('button', { name: 'Guardar' }).click()
        await expect(page.getByRole('alert').first()).toBeVisible()
      },
    },
    { nombre: 'Contar stock', ruta: `./productos/${lejia}/contar` },
    { nombre: 'Contar todo', ruta: './contar' },
    {
      nombre: 'Contar todo: un producto',
      ruta: './contar',
      preparar: async (page) => {
        await page.getByRole('button', { name: /^(Empezar a contar|Seguir contando)$/ }).click()
        await expect(page.getByRole('progressbar', { name: 'Avance del conteo' })).toBeVisible()
      },
    },
    // Historial
    { nombre: 'Historial', ruta: './historial' },
    {
      nombre: 'Inicio: hoja Movimientos',
      ruta: './',
      preparar: async (page) => {
        await page.getByRole('button', { name: /^Movimientos/ }).click()
        await expect(page.getByRole('heading', { name: 'Movimientos', level: 2 })).toBeVisible()
        // La hoja sube despacio: se revisa ya quieta, no a mitad de la animación.
        await page.waitForFunction(() => document.querySelector('.hoja')?.getAnimations().every((a) => a.playState === 'finished'))
        await expect(page.locator('.hoja .operacion').first()).toBeVisible()
      },
    },
    {
      nombre: 'Detalle de una venta',
      ruta: './historial',
      preparar: async (page) => {
        await page.getByRole('link', { name: /^Venta/ }).first().click()
        await expect(page.getByRole('button', { name: 'Anular' })).toBeVisible()
      },
    },
    {
      nombre: 'Diálogo: ¿anular esta venta?',
      ruta: './historial',
      preparar: async (page) => {
        await page.getByRole('link', { name: /^Venta/ }).first().click()
        await page.getByRole('button', { name: 'Anular' }).click()
        await expect(dialogo(page)).toBeVisible()
      },
    },
    // Control
    { nombre: 'Control', ruta: './control' },
    { nombre: 'Para comprar', ruta: './control/para-comprar' },
    {
      nombre: '¿Necesito comprar? (con respuesta)',
      ruta: './control/necesito-comprar',
      preparar: async (page) => {
        await page.getByLabel('¿Qué producto quieres comprar?').fill('escoba')
        await page.getByRole('button', { name: /Escoba de paja/ }).click()
        await expect(page.locator('.respuesta-grande')).toBeVisible()
      },
    },
    // Ajustes
    { nombre: 'Ajustes', ruta: './ajustes' },
    { nombre: 'Datos de la tienda', ruta: './ajustes/tienda' },
    { nombre: 'Alquiler del local', ruta: './control/alquiler' },
    {
      nombre: 'Alquiler del local: dos veces al mes (con errores)',
      ruta: './control/alquiler',
      preparar: async (page) => {
        await page.getByRole('radio', { name: 'Dos veces al mes' }).click()
        await page.getByRole('button', { name: 'Guardar' }).click()
        await expect(page.getByRole('alert').first()).toBeVisible()
      },
    },
    { nombre: 'Avisos en tu celular', ruta: './ajustes/avisos' },
    { nombre: 'Guardar copia', ruta: './ajustes/copia' },
    { nombre: 'Restaurar copia', ruta: './ajustes/restaurar' },
    {
      nombre: 'Diálogo: ¿restaurar la copia?',
      ruta: './ajustes/restaurar',
      preparar: async (page) => {
        const copia = await copiaDeLaTienda(page)
        const selector = page.waitForEvent('filechooser')
        await page.getByRole('button', { name: 'Elegir la copia' }).click()
        await (await selector).setFiles({
          name: 'respaldo-bodega-rosita.json',
          mimeType: 'application/json',
          buffer: Buffer.from(copia),
        })
        await page.getByRole('button', { name: 'Restaurar esta copia' }).click()
        await expect(dialogo(page)).toBeVisible()
      },
    },
    { nombre: 'Importar productos', ruta: './ajustes/importar' },
  ]
}

/**
 * La tienda en uso: ocho semanas de demostración (todas las secciones de Control con datos,
 * agotados, por acabarse, parados y un precio con pérdida). Deja el reloj en "hoy".
 */
export async function prepararTiendaEnUso(page: Page): Promise<IdsDeDemostracion> {
  return prepararHistoriaDeDemostracion(page)
}

/** Abre la pantalla y la deja en el estado que se quiere revisar. */
export async function mostrarPantalla(page: Page, pantalla: Pantalla): Promise<void> {
  await abrir(page, pantalla.ruta)
  await pantalla.preparar?.(page)
  await page.evaluate(() => document.fonts.ready)
}

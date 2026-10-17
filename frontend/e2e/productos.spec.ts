import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
  usarLetra,
} from './utilidades/calidad'
import { caja } from './utilidades/escenarios'
import { abrir } from './utilidades/navegacion'
import { crearConHistoria, crearProductos, FOTO_PNG, objetivosChicos } from './utilidades/productos'

/**
 * Plan 11 (Productos): los flujos críticos en celular y PC (RN-SIS-05) y las verificaciones de
 * cada pantalla nueva (RN-UX-09, RN-SIS-06/07, RN-UX-02).
 */

const LEJIAS = [
  {
    nombre: 'Lejía Tradicional 1 L',
    categoria: 'Lejías y desinfectantes',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
    stockInicial: '12',
  },
  {
    nombre: 'Lejía Tradicional 2 L',
    categoria: 'Lejías y desinfectantes',
    compra: '4.30',
    venta: '6.20',
    minimo: '3',
    stockInicial: '2',
  },
  {
    nombre: 'Carbón vegetal',
    categoria: 'Carbón y combustibles',
    unidad: 'KILO' as const,
    compra: '2.75',
    venta: '4.00',
    minimo: '3',
    stockInicial: '10.5',
  },
]

/** Las cifras van con espacios que no cortan ("12 unid."): se comparan como se leen. */
function comoSeLee(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]'))
}

async function nombresEnLaLista(page: Page): Promise<string[]> {
  return page
    .getByRole('list', { name: 'Productos' })
    .locator('.tarjeta-de-producto .nombre')
    .allTextContents()
}

test.describe('Productos: flujos críticos', () => {
  test('crear un producto con stock inicial y foto', async ({ page }) => {
    await abrir(page, './productos')
    await expect(page.getByText('Aún no tienes productos')).toBeVisible()
    await page.getByRole('button', { name: 'Agregar el primero' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Producto nuevo' })).toBeVisible()

    await page.getByLabel('Nombre del producto').fill('Lejía Tradicional 1 L')
    // La foto de la galería (el otro input abre la cámara de atrás: capture="environment").
    const foto = page.getByRole('group', { name: 'Foto del producto' })
    await expect(foto.locator('input[capture="environment"]')).toHaveCount(1)
    await foto
      .locator('input[type="file"]:not([capture])')
      .setInputFiles({ name: 'lejia.png', mimeType: 'image/png', buffer: FOTO_PNG })
    await expect(foto.getByRole('img', { name: 'Lejía Tradicional 1 L' })).toBeVisible()
    await page.getByRole('radio', { name: 'Lejías y desinfectantes' }).click()
    await page.getByLabel('Precio de compra por unidad (S/)').fill('2.40')
    await page.getByLabel('Precio de venta por unidad (S/)').fill('3.50')
    await expect(page.getByText(comoSeLee('Ganas S/ 1.10 por cada unidad'))).toBeVisible()
    await page.getByLabel('¿Cuántos tienes ahora?').fill('12')
    await page.getByRole('button', { name: 'Guardar producto' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Producto guardado' })).toBeVisible()
    await expect(
      page.getByText(comoSeLee('Lejía Tradicional 1 L ya está en tu lista con 12 unid.')),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Ver producto' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Lejía Tradicional 1 L' }),
    ).toBeVisible()
    await expect(page.getByText(comoSeLee('Tienes 12 unid.'))).toBeVisible()
    // RN-CAT-14: la foto quedó guardada (reducida por el procesador real del navegador).
    await expect(page.getByRole('img', { name: 'Lejía Tradicional 1 L' })).toHaveAttribute(
      'src',
      /^blob:/,
    )
    await expect(page.getByText(comoSeLee('Stock inicial'))).toBeVisible()

    // Y aparece en la lista, con su stock.
    await page.getByRole('link', { name: 'Productos' }).click()
    await expect(page.getByRole('list', { name: 'Productos' })).toContainText(comoSeLee('12 unid.'))
  })

  test('buscar sin tildes y en cualquier orden', async ({ page }) => {
    await abrir(page, './productos')
    await crearProductos(page, LEJIAS)
    await abrir(page, './productos')

    const buscador = page.getByLabel('Buscar producto')
    await buscador.fill('lejia')
    await expect
      .poll(() => nombresEnLaLista(page))
      .toEqual(['Lejía Tradicional 1 L', 'Lejía Tradicional 2 L'])
    await expect(page.getByRole('status').filter({ hasText: '2 productos' })).toBeAttached()

    await buscador.fill('CARBON')
    await expect.poll(() => nombresEnLaLista(page)).toEqual(['Carbón vegetal'])

    await buscador.fill('2 l lejia')
    await expect.poll(() => nombresEnLaLista(page)).toEqual(['Lejía Tradicional 2 L'])

    // "Queda poco" combina con la búsqueda; "Borrar" vuelve a mostrar todo.
    await page.getByRole('button', { name: 'Borrar' }).click()
    await page.getByRole('radio', { name: 'Queda poco' }).click()
    await expect.poll(() => nombresEnLaLista(page)).toEqual(['Lejía Tradicional 2 L'])
  })

  test('archivar un producto con stock confirma el retiro (RN-CAT-11)', async ({ page }) => {
    await abrir(page, './productos')
    const { Escoba: id } = await crearProductos(page, [
      { nombre: 'Escoba', compra: '6.00', venta: '9.00', minimo: '2', stockInicial: '4' },
    ])
    // Directo por su dirección, como la abre una notificación (M5).
    await abrir(page, `./productos/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Escoba' })).toBeVisible()

    await page.getByRole('button', { name: 'Archivar producto' }).click()
    const dialogo = page.getByRole('dialog', { name: '¿Archivar este producto?' })
    await expect(dialogo).toContainText('Aún quedan 4 unid. ¿Las retiramos del stock?')
    await dialogo.getByRole('button', { name: 'Sí, retirar y archivar' }).click()

    await expect(dialogo).toBeHidden()
    // RN-UX-11: la única confirmación (sin Deshacer) va junto a las acciones, con el foco y a
    // la vista; arriba queda el aviso de que está archivado.
    const resultado = page.locator('.resultado')
    await expect(resultado).toContainText('Producto archivado')
    await expect(resultado).toContainText(comoSeLee('Retiramos 4 unid. del stock.'))
    await expect(resultado).toBeFocused()
    await expect(resultado).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Reactivar producto' })).toBeInViewport()
    await expect(page.locator('.aviso-deshacer')).toHaveCount(0)
    await expect(page.getByText('Este producto no aparece en Vender', { exact: false })).toBeVisible()
    await expect(page.getByText(comoSeLee('Producto retirado'))).toBeVisible()

    // Ya no está entre los activos; sí en Archivados.
    await page.getByRole('link', { name: 'Productos' }).click()
    await expect(page.getByText('Aún no tienes productos')).toHaveCount(0)
    await page.getByRole('radio', { name: 'Archivados' }).click()
    await expect.poll(() => nombresEnLaLista(page)).toEqual(['Escoba'])
  })

  test('editar el precio con pérdida pide confirmar (RN-CAT-05)', async ({ page }) => {
    await abrir(page, './productos')
    await crearProductos(page, [LEJIAS[0]!])
    await abrir(page, './productos')
    await page.getByRole('button', { name: /^Lejía Tradicional 1 L/ }).click()

    await page.getByRole('button', { name: 'Editar producto' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Editar producto' })).toBeVisible()
    const venta = page.getByLabel('Precio de venta por unidad (S/)')
    await expect(venta).toHaveValue('3.50')
    await venta.fill('2.00')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    const dialogo = page.getByRole('dialog', { name: '¿Guardar con este precio?' })
    await expect(dialogo).toContainText('Vas a perder S/ 0.40 por cada unidad')
    await dialogo.getByRole('button', { name: 'Sí, guardar así' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Cambios guardados' })).toBeVisible()
    await page.getByRole('button', { name: 'Ver producto' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Lejía Tradicional 1 L' }),
    ).toBeVisible()
    await expect(page.getByText(comoSeLee('S/ 2.00'))).toBeVisible()
    await expect(page.getByText('Con este precio pierdes dinero')).toBeVisible()
    // "Volver" desde el detalle no vuelve a la edición (no quedó dos veces en el historial).
    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Productos' })).toBeVisible()
  })

  test('un producto que no existe: "No encontramos ese producto" con un camino de vuelta', async ({
    page,
  }) => {
    await abrir(page, './productos/no-existe')
    await expect(
      page.getByRole('heading', { level: 1, name: 'No encontramos ese producto' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Ver mis productos' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Productos' })).toBeVisible()
  })
})

/** Cada pantalla de Productos, con datos (para que se vea todo lo que puede mostrar). */
async function pantallas(
  page: Page,
  ahora: number,
): Promise<{ ruta: string; preparar?: () => Promise<void> }[]> {
  await abrir(page, './productos')
  const ids = await crearProductos(page, [
    ...LEJIAS,
    {
      nombre: 'Detergente en polvo Bolívar Active Care aroma lavanda 2.6 kg',
      categoria: 'Detergentes y jabones',
      compra: '18.50',
      venta: '17.90',
      minimo: '2',
      stockInicial: '0',
    },
    { nombre: 'Escoba', compra: '6', venta: '9', archivado: true },
  ])
  // Con ventas en las últimas semanas: tendencia (GraficoBarras), cobertura y venta diaria.
  const jabon = await crearConHistoria(
    page,
    {
      nombre: 'Jabón Bolívar 190 g',
      categoria: 'Detergentes y jabones',
      compra: '1.80',
      venta: '2.50',
      minimo: '4',
      stockInicial: '80',
    },
    40,
    [
      { haceDias: 35, cantidad: '6' },
      { haceDias: 20, cantidad: '12' },
      { haceDias: 9, cantidad: '4' },
      { haceDias: 2, cantidad: '9' },
    ],
    ahora,
  )
  const lejia = ids['Lejía Tradicional 1 L']!
  const detergente = ids['Detergente en polvo Bolívar Active Care aroma lavanda 2.6 kg']!
  return [
    {
      ruta: './productos',
      preparar: async () => {
        await page.getByLabel('Buscar producto').fill('l')
        await page.getByRole('button', { name: /^Categoría:/ }).click()
      },
    },
    { ruta: `./productos/${jabon}` },
    { ruta: `./productos/${lejia}` },
    { ruta: `./productos/${detergente}` },
    { ruta: `./productos/${ids.Escoba}` },
    {
      ruta: './productos/nuevo',
      preparar: async () => {
        // Con los errores a la vista (junto a cada campo).
        await page.getByRole('button', { name: 'Guardar producto' }).click()
        await expect(page.getByText('Escribe el nombre del producto')).toBeVisible()
      },
    },
    { ruta: `./productos/${lejia}/editar` },
    {
      ruta: './productos/categorias',
      preparar: async () => {
        await page.getByRole('button', { name: 'Eliminar Lejías y desinfectantes' }).click()
        await expect(
          page.getByText('La categoría tiene productos.', { exact: false }),
        ).toBeVisible()
      },
    },
    {
      ruta: './productos/categorias',
      preparar: async () => {
        await page.getByRole('button', { name: 'Cambiar nombre de Bolsas' }).click()
        await expect(page.getByLabel('Nuevo nombre para Bolsas')).toBeFocused()
      },
    },
  ]
}

for (const ancho of [320, 360, 768, 1280]) {
  test(`pantallas de Productos a ${ancho}px con letra Muy grande: sin scroll horizontal, sin violaciones graves y tocables de buen tamaño`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const ahora = Date.now()
    await page.clock.install({ time: ahora })
    await usarLetra(page, 'MUY_GRANDE')
    await page.setViewportSize({ width: ancho, height: 800 })
    for (const [indice, { ruta, preparar }] of (await pantallas(page, ahora)).entries()) {
      await test.step(`${indice + 1}. ${ruta}`, async () => {
        await abrir(page, ruta)
        await page.evaluate(() => document.fonts.ready)
        await preparar?.()
        await esperarSinDesplazamientoHorizontal(page)
        await esperarSinViolacionesGraves(page)
        expect(await objetivosChicos(page), ruta).toEqual({ chicos: [], principalesBajos: [] })
      })
    }
  })
}

// Con nombres de producto largos (plan 11; el arreglo de EncabezadoPagina llegó con PR #9).
test('un título largo pasa debajo de "Volver" sin aplastarlo ni partir palabras (320 px, letra Muy grande)', async ({
  page,
}) => {
  await usarLetra(page, 'MUY_GRANDE')
  await page.setViewportSize({ width: 320, height: 800 })
  await abrir(page, './productos')
  const { 'Jabón Bolívar 190 g': id } = await crearProductos(page, [
    { nombre: 'Jabón Bolívar 190 g', compra: '1.80', venta: '2.50' },
  ])
  for (const ruta of [`./productos/${id}`, `./productos/${id}/editar`, './productos/categorias']) {
    await abrir(page, ruta)
    await page.evaluate(() => document.fonts.ready)
    const medida = await page.evaluate(() => {
      const volver = document.querySelector('.encabezado-pagina .volver span')!
      const titulo = document.querySelector('.encabezado-pagina h1')!
      const lineas = (el: Element) =>
        el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)
      // Palabras del título partidas entre dos líneas (un Range por palabra).
      const nodo = titulo.firstChild!
      const texto = nodo.textContent ?? ''
      let inicio = 0
      const partidas = texto.split(' ').filter((palabra) => {
        const rango = document.createRange()
        rango.setStart(nodo, inicio)
        rango.setEnd(nodo, inicio + palabra.length)
        inicio += palabra.length + 1
        const tops = [...rango.getClientRects()].filter((r) => r.width > 0).map((r) => r.top)
        return new Set(tops.map(Math.round)).size > 1
      })
      return { lineasVolver: lineas(volver), partidas }
    })
    expect(medida.lineasVolver, ruta).toBeLessThan(1.5)
    expect(medida.partidas, ruta).toEqual([])
  }
})

test('celular: "Guardar producto" va fijo abajo y nunca tapa el campo con el foco (06, responsive)', async ({
  page,
}) => {
  await usarLetra(page, 'MUY_GRANDE')
  await page.setViewportSize({ width: 360, height: 800 })
  await abrir(page, './productos/nuevo')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  const boton = await caja(page, '.formulario-de-producto .accion-principal')
  const pie = await caja(page, '.pie')
  expect(Math.abs(boton.bottom - pie.top), 'pegado justo encima de la navegación').toBeLessThanOrEqual(1)

  // WCAG 2.4.11: al enfocar campos más abajo, el navegador los deja por encima del botón.
  for (const etiqueta of ['Precio de compra por unidad (S/)', 'Stock mínimo']) {
    await page.getByLabel(etiqueta).focus()
    const campo = await page.getByLabel(etiqueta).boundingBox()
    const fijo = await caja(page, '.formulario-de-producto .accion-principal')
    expect(campo!.y + campo!.height, etiqueta).toBeLessThanOrEqual(fijo.top + 1)
  }
})


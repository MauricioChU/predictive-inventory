// Plan 14 (`feat/ui-inicio-ajustes`): Inicio, Primera vez, Ajustes, copia, importación y avisos.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import writeXlsxFile from 'write-excel-file/node'
import { esperarSinDesplazamientoHorizontal, esperarSinViolacionesGraves, usarLetra } from './utilidades/calidad'
import { abrir } from './utilidades/navegacion'
import {
  abrirTiendaLista,
  configuracionYAvisos,
  crearProducto,
  esperarEncabezadoLegible,
  esperarObjetivosTactiles,
  nombresDelCatalogo,
  notificacionesQueSeAceptan,
  sinMenuDeCompartir,
  stockDe,
  vender,
} from './utilidades/tienda'

const ENCABEZADOS = ['nombre', 'categoría', 'unidad', 'precio de compra', 'precio de venta', 'stock mínimo', 'stock inicial']

/** Un .xlsx real (como el que sale de la plantilla) con estas filas debajo de los encabezados. */
async function excelDeProductos(filas: string[][]): Promise<Buffer> {
  return writeXlsxFile([ENCABEZADOS, ...filas].map((fila) => fila.map((valor) => ({ value: valor, type: String })))).toBuffer()
}

/** Elige un archivo con el botón de la pantalla (que abre el selector del celular). */
async function elegirArchivo(page: Page, boton: string, archivo: { name: string; mimeType: string; buffer: Buffer }) {
  const selector = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: boton }).click()
  await (await selector).setFiles(archivo)
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1 })

test.describe('RN-SIS-05: primera vez', () => {
  test('completa por Excel: bienvenida → nombre → letra → importar → Terminar → Inicio', async ({ page }) => {
    await notificacionesQueSeAceptan(page)
    await abrir(page, './')
    await expect(h1(page)).toHaveText('Te damos la bienvenida')

    await page.getByRole('button', { name: 'Empezar' }).click()
    await expect(h1(page)).toHaveText('¿Cómo se llama tu tienda?')
    await page.getByLabel('Nombre de la tienda').fill('Bodega Rosita')
    await page.getByRole('button', { name: 'Seguir' }).click()

    await expect(h1(page)).toHaveText('¿Qué tamaño de letra prefieres?')
    await page.getByRole('radio', { name: 'Muy grande' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-letra', 'MUY_GRANDE')
    await page.getByRole('button', { name: 'Seguir' }).click()

    await expect(h1(page)).toHaveText('¿Cómo quieres cargar tus productos?')
    await page.getByRole('button', { name: 'Desde Excel' }).click()
    await expect(h1(page)).toHaveText('Importar productos')
    await elegirArchivo(page, 'Elegir el Excel', {
      name: 'mis-productos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await excelDeProductos([
        ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
        ['Lejía 1 L', 'Lejías', 'unid', '2.40', '3.50', '3', '10'],
      ]),
    })
    await expect(page.getByText('2 productos listos para cargar')).toBeVisible()
    await page.getByRole('button', { name: 'Cargar 2 productos' }).click()
    await expect(h1(page)).toHaveText('Se cargaron 2 productos')

    await page.getByRole('button', { name: 'Seguir' }).click()
    await expect(h1(page)).toHaveText('Ahora contemos lo que tienes')
    await page.getByRole('button', { name: 'Terminar' }).click()

    await expect(h1(page)).toHaveText(/^BODEGA ROSITA/)
    expect(await nombresDelCatalogo(page)).toEqual(['Jabón Bolívar', 'Lejía 1 L'])
    // RN-AL-08: en toda la primera vez nunca se pidió el permiso de notificaciones.
    await expect(page.locator('html')).not.toHaveAttribute('data-pedidos-de-permiso', /.*/)

    // Al volver a abrir la app: ya no hay bienvenida y la letra elegida sigue.
    await abrir(page, './')
    await expect(h1(page)).toHaveText(/^BODEGA ROSITA/)
    await expect(page.locator('html')).toHaveAttribute('data-letra', 'MUY_GRANDE')
  })

  test('"Volver" y el botón atrás del celular recorren los pasos en el mismo orden', async ({ page }) => {
    await abrir(page, './')
    await page.getByRole('button', { name: 'Empezar' }).click()
    await page.getByLabel('Nombre de la tienda').fill('Bodega Rosita')
    await page.getByRole('button', { name: 'Seguir' }).click()
    await expect(h1(page)).toHaveText('¿Qué tamaño de letra prefieres?')

    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(h1(page)).toHaveText('¿Cómo se llama tu tienda?')
    await page.goBack()
    await expect(h1(page)).toHaveText('Te damos la bienvenida')
  })

  test('"Uno por uno" abre Producto nuevo (plan 11)', async ({ page }) => {
    // RN-UX-16: con la primera vez pendiente, la bienvenida y Producto nuevo se pueden abrir.
    await abrir(page, './bienvenida?paso=productos')
    await page.getByRole('button', { name: 'Uno por uno' }).click()
    // Contrato de rutas: Producto nuevo ofrece "Seguir" → primera-vez?paso=contar.
    await expect(page).toHaveURL(/\/productos\/nuevo\?desde=primera-vez$/)
    await expect(h1(page)).toHaveText('Producto nuevo')
  })
})

test.describe('RN-SIS-05: guardar y restaurar una copia', () => {
  test('la copia sale del celular, apaga el recordatorio y restaurarla devuelve los datos', async ({ page }, testInfo) => {
    await sinMenuDeCompartir(page)
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', stock: '10' })
    await abrir(page, './ajustes')

    // RN-RE-06: el recordatorio vive en Ajustes, en el enlace Guardar copia (ya no en Inicio).
    const enlaceDeCopia = page.getByRole('link', { name: /^Guardar copia/ })
    await expect(enlaceDeCopia).toContainText('Todavía no guardas una copia de tus datos')
    await enlaceDeCopia.click()
    await expect(h1(page)).toHaveText('Guardar copia')
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Guardar copia ahora' }).click()
    const archivo = await descarga
    expect(archivo.suggestedFilename()).toMatch(/^respaldo-bodega-rosita-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
    const ruta = testInfo.outputPath(archivo.suggestedFilename())
    await archivo.saveAs(ruta)
    await expect(h1(page)).toHaveText('Copia guardada')
    await page.getByRole('button', { name: 'Volver al inicio' }).click()
    await expect(h1(page)).toHaveText(/^BODEGA ROSITA/)
    await expect(page.getByText('guardas una copia')).toHaveCount(0)
    await page.getByRole('link', { name: 'Ajustes' }).click()
    await expect(page.getByRole('link', { name: /^Guardar copia/ })).toContainText('Tu última copia es del')
    await abrir(page, './')

    await vender(page, lejia, '5')
    expect(await stockDe(page, lejia)).toBe(5000)

    // RN-RE-03: resumen y dos confirmaciones.
    await page.getByRole('link', { name: 'Ajustes' }).click()
    await page.getByRole('link', { name: /Restaurar copia/ }).click()
    await expect(h1(page)).toHaveText('Restaurar copia')
    await elegirArchivo(page, 'Elegir la copia', {
      name: archivo.suggestedFilename(),
      mimeType: 'application/json',
      buffer: readFileSync(ruta),
    })
    await expect(page.getByText(/^1 producto, 1 movimiento, del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}$/)).toBeVisible()
    await page.getByRole('button', { name: 'Restaurar esta copia' }).click()
    await expect(page.getByRole('dialog')).toContainText('Se reemplazarán todos los datos de este celular')
    await page.getByRole('button', { name: 'Sí, continuar' }).click()
    await expect(page.getByRole('dialog')).toContainText('Esto no se puede deshacer')
    await page.getByRole('button', { name: 'Sí, restaurar' }).click()

    await expect(h1(page)).toHaveText('Copia restaurada')
    expect(await stockDe(page, lejia)).toBe(10_000)
  })

  test('RN-RE-03: un archivo que no es una copia no cambia nada', async ({ page }) => {
    await abrirTiendaLista(page, './ajustes/restaurar')
    await elegirArchivo(page, 'Elegir la copia', {
      name: 'notas.json',
      mimeType: 'application/json',
      buffer: Buffer.from('esto no es una copia'),
    })
    await expect(page.getByRole('alert')).toContainText('Este archivo no es una copia válida de la app')
    await expect(page.getByRole('button', { name: 'Restaurar esta copia' })).toHaveCount(0)
  })
})

test.describe('RN-RE-07: importar productos desde Excel', () => {
  test('la vista previa explica los problemas en lenguaje simple y carga solo las filas válidas', async ({ page }) => {
    await sinMenuDeCompartir(page)
    await abrirTiendaLista(page, './ajustes')
    await page.getByRole('link', { name: /Importar productos/ }).click()
    await expect(h1(page)).toHaveText('Importar productos')

    const plantilla = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar la plantilla' }).click()
    expect((await plantilla).suggestedFilename()).toBe('plantilla-de-productos.xlsx')

    await elegirArchivo(page, 'Elegir el Excel', {
      name: 'productos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await excelDeProductos([
        ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
        ['Ambientador Glade', 'Ambientadores', 'unid', '6.50', '9.00', '2', '6'],
        ['Cera roja', 'Limpiadores', 'L', '8.00', '', '1', ''],
        ['Bolsas chicas', 'Bolsas', 'unid', '0.05', '0.10', '1.5', '100'],
      ]),
    })
    await expect(page.getByText('2 productos listos para cargar')).toBeVisible()
    await expect(page.getByText('2 filas con problema')).toBeVisible()
    await expect(page.getByText('Fila 4: falta el precio de venta')).toBeVisible()
    await expect(page.getByText('Fila 5: Bolsas chicas se cuenta por unidades enteras')).toBeVisible()
    expect(await nombresDelCatalogo(page)).toEqual([])

    await page.getByRole('button', { name: 'Cargar 2 productos' }).click()
    await expect(h1(page)).toHaveText('Se cargaron 2 productos')
    expect(await nombresDelCatalogo(page)).toEqual(['Ambientador Glade', 'Jabón Bolívar'])
  })
})

test.describe('RN-UX-01: tamaño de letra', () => {
  test('cambiarlo en Ajustes escala toda la app y queda guardado', async ({ page }) => {
    await abrirTiendaLista(page, './ajustes')
    const medidas = () =>
      page.evaluate(() => {
        const px = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).fontSize) : 0)
        return {
          raiz: px(document.documentElement),
          titulo: px(document.querySelector('#contenido h1')),
          seccion: px(document.querySelector('#contenido h2')),
          opcion: px(document.querySelector('#contenido [role="radio"]')),
        }
      })
    const antes = await medidas()
    expect(antes.raiz).toBe(20)

    await page.getByRole('radio', { name: 'Muy grande' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-letra', 'MUY_GRANDE')
    const despues = await medidas()
    expect(despues.raiz).toBe(24)
    expect(despues.titulo / antes.titulo).toBeCloseTo(1.2, 2)
    expect(despues.seccion / antes.seccion).toBeCloseTo(1.2, 2)
    expect(despues.opcion / antes.opcion).toBeCloseTo(1.2, 2)

    // Otra pantalla, otro componente: también escala.
    await page.getByRole('link', { name: 'Inicio' }).click()
    const vender = page.getByRole('button', { name: 'Vender' })
    await expect(vender).toBeVisible()
    expect(await vender.evaluate((b) => parseFloat(getComputedStyle(b).fontSize))).toBeCloseTo(1.125 * 24, 1)

    // Al volver a abrir la app, sigue igual (sale de la configuración de la tienda).
    await page.reload()
    await expect(h1(page)).toHaveText(/^BODEGA ROSITA/)
    await expect(page.locator('html')).toHaveAttribute('data-letra', 'MUY_GRANDE')
    expect((await configuracionYAvisos(page)).tamanoDeLetra).toBe('MUY_GRANDE')
  })
})

test.describe('M1 / RN-AL-08: avisos en tu celular', () => {
  test('"Sí, avísame" pide el permiso y activa las notificaciones; desactivarlas en Ajustes las apaga', async ({
    page,
  }) => {
    await notificacionesQueSeAceptan(page)
    await abrirTiendaLista(page, './ajustes')
    await expect(page.getByText('Los avisos en tu celular están desactivados')).toBeVisible()

    await page.getByRole('button', { name: 'Activar avisos' }).click()
    await expect(h1(page)).toHaveText('Avisos en tu celular')
    await page.getByRole('button', { name: 'Sí, avísame' }).click()
    await expect(h1(page)).toHaveText('Listo, te avisaremos')
    await expect(page.locator('html')).toHaveAttribute('data-pedidos-de-permiso', '1')
    expect(await configuracionYAvisos(page)).toMatchObject({ notificacionesActivas: true, permitidas: true })

    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(page.getByText('Los avisos en tu celular están activados')).toBeVisible()
    await page.getByRole('button', { name: 'Desactivar avisos' }).click()
    await expect(page.getByText('Los avisos en tu celular están desactivados')).toBeVisible()
    expect(await configuracionYAvisos(page)).toMatchObject({ notificacionesActivas: false, permitidas: false })
  })
})

test.describe('Inicio', () => {
  test('cifras de hoy y lo que se acaba; sin resumen, recordatorios ni instalación (plan 19)', async ({ page }) => {
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3', stock: '10' })
    await crearProducto(page, { nombre: 'Carbón', compra: '2.75', venta: '4.00', stock: '0' })
    await vender(page, lejia, '2')
    await abrir(page, './')

    const cifra = page.locator('.cifras-de-hoy')
    await expect(cifra).toContainText('Total vendido')
    await expect(cifra).toContainText('S/ 7.00')
    await expect(cifra).toContainText('Ganancia real')
    await expect(cifra).toContainText('S/ 2.20')
    await expect(page.getByText('1 producto se acaba')).toBeVisible()
    await expect(page.getByText('1 agotado')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ver productos' })).toBeVisible()

    for (const texto of ['Resumen del día', 'guardas una copia', 'pagas el local', 'Instala la app en tu celular']) {
      await expect(page.getByText(texto)).toHaveCount(0)
    }
  })
})

/** Inicio en celular con todo lo que puede mostrar: cifras de hoy y el aviso de lo que se acaba. */
async function abrirInicioCompleto(page: Page, letra: 'GRANDE' | 'MUY_GRANDE', ancho: number, alto: number) {
  await usarLetra(page, letra)
  await page.setViewportSize({ width: ancho, height: alto })
  await abrirTiendaLista(page, './ajustes')
  await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3', stock: '2' })
  await crearProducto(page, { nombre: 'Carbón', compra: '2.75', venta: '4.00', stock: '0' })
  await abrir(page, './')
  await expect(page.getByText('2 productos se acaban')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test.describe('Inicio en celular: la acción principal, a la vista', () => {
  for (const [ancho, alto] of [
    [320, 700],
    [360, 740],
  ] as const) {
    for (const letra of ['MUY_GRANDE', 'GRANDE'] as const) {
      test(`${ancho}×${alto}, letra ${letra}: al final de Inicio, "Vender" queda entero sobre la navegación`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== 'celular', 'La barra de abajo y la columna única son de celular')
        await abrirInicioCompleto(page, letra, ancho, alto)
        // Con todo lo que Inicio puede mostrar el contenido es más alto que la pantalla: fluye.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

        const vender = await page.getByRole('button', { name: 'Vender' }).boundingBox()
        const navegacion = await page.getByRole('navigation').boundingBox()
        expect(vender, '"Vender" tiene caja').not.toBeNull()
        expect(vender!.y, '"Vender" no empieza arriba de la pantalla').toBeGreaterThanOrEqual(0)
        expect(vender!.y + vender!.height, '"Vender" termina sobre la navegación').toBeLessThanOrEqual(
          navegacion!.y + 1,
        )
      })
    }
  }

  test('360×740 Grande: Inicio entra en una sola pantalla y el aviso es una fila de una línea', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'La barra de abajo y la columna única son de celular')
    await abrirInicioCompleto(page, 'GRANDE', 360, 740)
    expect(await page.evaluate(() => document.documentElement.scrollHeight), 'sin desplazar').toBeLessThanOrEqual(740)
    const fila = page.locator('.fila-de-aviso')
    await expect(fila).toContainText('2 productos se acaban')
    await expect(fila).not.toContainText('agotado')
    expect((await fila.boundingBox())!.height, 'una sola línea').toBeLessThan(60)
    await expect(page.getByRole('button', { name: /^Movimientos/ })).toBeVisible()
  })

  test('360×740 Grande, con ventas: Inicio entra en una pantalla y "Total vendido" es mucho más grande que "Ganancia real"', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'La barra de abajo y la columna única son de celular')
    await usarLetra(page, 'GRANDE')
    await page.setViewportSize({ width: 360, height: 740 })
    await abrirTiendaLista(page, './ajustes')
    const lejia = await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3', stock: '2' })
    await vender(page, lejia, '1')
    await abrir(page, './')
    await expect(page.getByText('1 producto se acaba')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollHeight), 'sin desplazar').toBeLessThanOrEqual(740)
    const tamano = (texto: string) =>
      page.locator('.cifras-de-hoy .valor', { hasText: texto }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(await tamano('S/ 3.50')).toBeGreaterThanOrEqual(1.6 * (await tamano('S/ 1.10')))
  })

  test('Movimientos abre una hoja con filtros de fecha, deja lo de atrás inerte y devuelve el foco', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', stock: '10' })
    await vender(page, lejia, '1')
    await abrir(page, './')

    const boton = page.getByRole('button', { name: /^Movimientos/ })
    await boton.click()
    const titulo = page.getByRole('heading', { name: 'Movimientos', level: 2 })
    await expect(titulo).toBeFocused()
    await expect(page.locator('.vista-inicio > .cuerpo')).toHaveAttribute('inert', '')
    await expect(page.getByRole('radio', { name: 'Hoy' })).toBeVisible()
    await expect(page.getByText('Mostrar', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Volver' })).toHaveCount(0)
    // Hoy: la venta y el stock inicial; Ayer: nada.
    await page.getByRole('radio', { name: 'Hoy' }).click()
    await expect(page.locator('.hoja .operacion .tipo').first()).toHaveText('Venta')
    await page.getByRole('radio', { name: 'Ayer' }).click()
    await expect(page.getByText('No hay movimientos en estos días')).toBeVisible()
    await page.getByRole('radio', { name: '30 días' }).click()
    await expect(page.locator('.hoja .operacion .tipo').first()).toHaveText('Venta')

    // Elegir día: un día futuro no busca nada y avisa.
    await page.getByRole('radio', { name: 'Elegir día' }).click()
    await page.getByLabel('¿Qué día?').fill('2099-01-01')
    await expect(page.getByText('Elige un día que ya pasó, o hoy.')).toBeVisible()
    await expect(page.locator('.hoja .operacion')).toHaveCount(0)
    await page.getByRole('radio', { name: '30 días' }).click()
    await expect(page.locator('.hoja .operacion .tipo').first()).toHaveText('Venta')

    // El detalle y atrás: la hoja reabre con su filtro (la dirección la guarda).
    await page.locator('.hoja .operacion').filter({ hasText: 'Venta' }).first().click()
    await expect(page.getByRole('heading', { name: 'Venta', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(page.getByRole('heading', { name: 'Movimientos', level: 2 })).toBeVisible()
    await expect(page).toHaveURL(/movimientos=30-dias/)
    await expect(page.getByRole('radio', { name: '30 días' })).toBeChecked()

    // Escape cierra aunque el foco esté en otro lado de la hoja.
    await page.getByRole('radio', { name: '30 días' }).focus()
    await page.keyboard.press('Escape')
    await expect(page.locator('.hoja')).toHaveCount(0)
    await expect(boton).toBeFocused()
    await expect(page.locator('.vista-inicio > .cuerpo')).not.toHaveAttribute('inert', '')

    await boton.click()
    await page.getByRole('button', { name: 'Cerrar' }).click()
    await expect(page.locator('.hoja')).toHaveCount(0)
    await expect(boton).toBeFocused()
  })

  test('320×700 Muy grande: enfocar "Vender" pegado no mueve la página', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'La barra de abajo y la columna única son de celular')
    await abrirInicioCompleto(page, 'MUY_GRANDE', 320, 700)
    const antes = await page.evaluate(() => window.scrollY)

    await page.locator('.vender-fijo button').focus()

    await expect(page.locator('.vender-fijo button')).toBeFocused()
    expect(await page.evaluate(() => window.scrollY)).toBe(antes)
  })

  test('360×740: las acciones quedan abajo, justo sobre la navegación, y debajo de fecha, cifras y aviso', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'La barra de abajo y la columna única son de celular')
    await abrirInicioCompleto(page, 'GRANDE', 360, 740)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

    const caja = async (selector: string) => {
      const medida = await page.locator(selector).first().boundingBox()
      expect(medida, `${selector} tiene caja`).not.toBeNull()
      return medida!
    }
    const fecha = await caja('.fecha-de-hoy')
    const cifra = await caja('.cifra')
    const aviso = await caja('.atencion')
    const vender = await caja('.vender-fijo')
    const historial = await caja('.enlace-movimientos')
    const acciones = { y: vender.y, height: historial.y + historial.height - vender.y }
    const navegacion = await page.getByRole('navigation').boundingBox()
    expect(cifra.y).toBeGreaterThanOrEqual(fecha.y + fecha.height - 1)
    expect(aviso.y).toBeGreaterThanOrEqual(cifra.y + cifra.height - 1)
    expect(acciones.y).toBeGreaterThanOrEqual(aviso.y + aviso.height - 1)
    expect(acciones.y + acciones.height, 'dentro de la pantalla').toBeLessThanOrEqual(740)
    expect(navegacion!.y - (acciones.y + acciones.height), 'justo sobre la navegación').toBeLessThanOrEqual(40)
    expect(navegacion!.y - (acciones.y + acciones.height)).toBeGreaterThanOrEqual(-1)
    await esperarSinDesplazamientoHorizontal(page)
  })

  test('320×700 Muy grande: al recorrer con Tab, nada enfocado queda tapado por "Vender" ni por la navegación', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'La barra de abajo y la columna única son de celular')
    await abrirInicioCompleto(page, 'MUY_GRANDE', 320, 700)

    const medidas: { enContenido: boolean; texto: string; encima: boolean }[] = []
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab')
      medidas.push(
        await page.evaluate(() => {
          const activo = document.activeElement
          const enContenido = Boolean(activo?.closest('#contenido'))
          const caja = activo?.getBoundingClientRect()
          const encima = [document.querySelector('nav'), document.querySelector('.vender-fijo')]
            .filter((el): el is Element => el !== null && activo !== null && !el.contains(activo))
            .map((el) => el.getBoundingClientRect())
            .some((otra) => caja !== undefined && caja.bottom > otra.top + 1 && caja.top < otra.bottom - 1)
          return { enContenido, texto: activo?.textContent?.trim() ?? '', encima: enContenido && encima }
        }),
      )
    }
    const revisados = medidas.filter((m) => m.enContenido)
    const tapados = revisados.filter((m) => m.encima).map((m) => m.texto)
    expect(revisados.length, 'se recorrió Inicio con Tab').toBeGreaterThanOrEqual(8)
    expect(tapados, 'nada enfocado queda debajo de lo que está pegado abajo').toEqual([])
  })
})

test.describe('Inicio en PC (1280 px): el orden de lectura es el del código (WCAG 1.3.2 / 2.4.3)', () => {
  test('cifras y aviso a la izquierda, acciones a la derecha', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'pc', 'La disposición en columnas es de PC')
    await abrirInicioCompleto(page, 'GRANDE', 1280, 800)

    const caja = async (selector: string) => {
      // Hijos directos del cuerpo de Inicio (los avisos del kit también tienen un `.acciones`).
      const medida = await page.locator(`#contenido .cuerpo > ${selector}`).boundingBox()
      expect(medida, `${selector} tiene caja`).not.toBeNull()
      return medida!
    }
    const cifra = await caja('.cifra')
    const atencion = await caja('.atencion')
    const acciones = await caja('.acciones')

    // Arriba, en dos columnas: cifras sobre el aviso a la izquierda, acciones a la derecha.
    expect(atencion.y).toBeGreaterThanOrEqual(cifra.y + cifra.height - 1)
    expect(Math.abs(atencion.x - cifra.x)).toBeLessThanOrEqual(1)
    expect(acciones.x).toBeGreaterThanOrEqual(cifra.x + cifra.width - 1)
    expect(Math.abs(acciones.y - cifra.y)).toBeLessThanOrEqual(1)

    // Y el código va en ese mismo orden.
    const ordenEnElCodigo = await page.evaluate(() =>
      ['.cifra', '.atencion', '.acciones'].map((selector) =>
        Array.from(document.querySelectorAll('#contenido .cuerpo > *')).indexOf(
          document.querySelector(`#contenido .cuerpo > ${selector}`)!,
        ),
      ),
    )
    expect(ordenEnElCodigo).toEqual([...ordenEnElCodigo].sort((a, b) => a - b))
  })
})

/** Las pantallas del plan 14 (la bienvenida, con la primera vez sin hacer, va aparte). */
const PANTALLAS = [
  './',
  './bienvenida?paso=nombre',
  './bienvenida?paso=letra',
  './bienvenida?paso=productos',
  './bienvenida?paso=contar',
  './ajustes',
  './ajustes/tienda',
  './ajustes/avisos',
  './ajustes/copia',
  './ajustes/restaurar',
  './ajustes/importar',
]

test.describe('RN-SIS-06/07, RN-UX-02: pantallas del plan 14 con letra Muy grande', () => {
  for (const ancho of [320, 360, 768, 1280]) {
    test(`${ancho}px: sin desplazamiento horizontal y objetivos táctiles grandes`, async ({ page }) => {
      test.setTimeout(60_000)
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrir(page, './')
      await expect(h1(page)).toHaveText('Te damos la bienvenida')
      await esperarSinDesplazamientoHorizontal(page)
      await esperarObjetivosTactiles(page)

      await abrirTiendaLista(page, './ajustes')
      await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3', stock: '2' })
      for (const ruta of PANTALLAS) {
        await abrir(page, ruta)
        await esperarSinDesplazamientoHorizontal(page)
        await esperarObjetivosTactiles(page)
        await esperarEncabezadoLegible(page)
      }
    })
  }

  test('Ajustes a 320 px: el detalle de cada opción usa todo el ancho (no una columnita)', async ({ page }) => {
    await usarLetra(page, 'MUY_GRANDE')
    await page.setViewportSize({ width: 320, height: 800 })
    await abrirTiendaLista(page, './ajustes')
    const proporciones = await page.locator('.enlace-de-ajuste').evaluateAll((enlaces) =>
      enlaces.map((enlace) => {
        const detalle = enlace.querySelector('.detalle')!.getBoundingClientRect().width
        return detalle / enlace.getBoundingClientRect().width
      }),
    )
    expect(proporciones.length).toBeGreaterThanOrEqual(5)
    for (const proporcion of proporciones) expect(proporcion).toBeGreaterThan(0.75)
  })

  test('axe sin violaciones graves en cada pantalla', async ({ page }) => {
    test.setTimeout(90_000)
    await usarLetra(page, 'MUY_GRANDE')
    await abrir(page, './')
    await esperarSinViolacionesGraves(page)
    await abrirTiendaLista(page, './ajustes')
    await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3', stock: '2' })
    for (const ruta of PANTALLAS) {
      await abrir(page, ruta)
      await esperarSinViolacionesGraves(page)
    }
  })
})

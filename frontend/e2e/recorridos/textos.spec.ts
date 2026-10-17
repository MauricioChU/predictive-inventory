// Plan 16, ítem 5: auditoría de textos. Ninguna pantalla usa palabras que la guía manda evitar
// (06-experiencia-de-uso, «Guía de palabras») y los textos que fija la spec salen tal cual.
import { expect, test } from '@playwright/test'
import { abrir } from '../utilidades/navegacion'
import { crearProducto } from '../utilidades/operaciones'
import {
  mostrarPantalla,
  PANTALLAS_DE_LA_PRIMERA_VEZ,
  PANTALLAS_VACIAS,
  pantallasDeLaTienda,
  prepararTiendaEnUso,
} from '../utilidades/pantallas-de-la-app'
import {
  comoSeLee,
  empezarElDia,
  h1,
  irA,
  textoVisible,
  venderPorPantalla,
} from '../utilidades/recorridos'
import { anotarTextosVistos, esperarSinPalabrasQueEvitar } from '../utilidades/textos'
import { abrirTiendaLista } from '../utilidades/tienda'

test.describe('Auditoría de textos: la guía de palabras en todas las pantallas', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'Los textos son los mismos en PC')
  })

  test('la primera vez y los estados vacíos', async ({ page }) => {
    await anotarTextosVistos(page)
    for (const pantalla of PANTALLAS_DE_LA_PRIMERA_VEZ) await mostrarPantalla(page, pantalla)
    await abrirTiendaLista(page, './')
    for (const pantalla of PANTALLAS_VACIAS) await mostrarPantalla(page, pantalla)
    await esperarSinPalabrasQueEvitar(page)
  })

  test('la tienda en uso (ocho semanas de ventas), con sus diálogos', async ({ page }) => {
    test.setTimeout(90_000)
    await anotarTextosVistos(page)
    const ids = await prepararTiendaEnUso(page)
    for (const pantalla of pantallasDeLaTienda(ids)) await mostrarPantalla(page, pantalla)
    await esperarSinPalabrasQueEvitar(page)
  })
})

test.describe('Los textos de la spec, exactos', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'Los textos son los mismos en PC')
  })

  test('navegación, Inicio, estados vacíos, conteos y Deshacer fuera de tiempo', async ({ page }) => {
    await anotarTextosVistos(page)
    await empezarElDia(page)
    await abrirTiendaLista(page, './')

    // RN-UX-12: cinco destinos con ícono y texto, en este orden.
    await expect(page.getByRole('navigation').getByRole('link')).toHaveText([
      'Inicio',
      'Vender',
      'Recibir',
      'Productos',
      /^Control/,
    ])
    // RN-UX-10 y la pantalla Inicio (06): las tres acciones, y Ajustes e Historial desde aquí.
    await expect(page.getByText('Aún no tienes productos')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agregar el primero' })).toBeVisible()
    for (const accion of ['Vender', 'Llegó mercadería', '¿Necesito comprar?']) {
      await expect(page.locator('#contenido').getByRole('button', { name: accion, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('link', { name: /^Historial/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ajustes' })).toBeVisible()
    // RN-UX-13.
    await expect(page.getByText('Instala la app en tu celular')).toBeVisible()

    // Control sin historia (04: "cada sección con poca información muestra un mensaje claro").
    const lejia = await crearProducto(page, {
      nombre: 'Lejía Tradicional 1 L',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stock: '10',
    })
    await irA(page, 'Control')
    const resumen = page.getByRole('region', { name: 'Resumen', exact: true })
    await resumen.getByRole('radio', { name: '7 días' }).click()
    await expect(resumen).toContainText('Todavía no hay ventas esta semana')
    await expect(page.getByRole('region', { name: 'Mejor día de la semana' })).toContainText(
      'Necesito al menos 2 semanas de ventas para saberlo',
    )

    // RN-OP-16: contar lo mismo que hay no registra nada.
    await abrir(page, `./productos/${lejia}/contar`)
    await page.getByLabel('¿Cuántos hay? (unid.)').fill('10')
    await page.getByRole('button', { name: 'Guardar conteo' }).click()
    await expect(h1(page)).toHaveText('El stock ya estaba correcto')

    // RN-OP-21: terminar el conteo guiado sin contar nada.
    await abrir(page, './contar')
    await page.getByRole('button', { name: 'Empezar a contar' }).click()
    await expect(page.locator('.barra-de-progreso .texto')).toHaveText('Llevas 0 de 1')
    await page.getByRole('button', { name: 'Saltar' }).click()
    await expect(page.getByText('No contaste ningún producto.')).toBeVisible()

    // RN-OP-18: un "Deshacer" que llega cuando ya pasaron los 10 s.
    await irA(page, 'Vender')
    await venderPorPantalla(
      page,
      [{ buscado: 'lejia', nombre: 'Lejía Tradicional 1 L', cantidad: 1 }],
      'Exacto',
      'S/ 3.50',
    )
    // El reloj salta 13 s (pasados los 10 s y los 2 s de margen para un toque justo al cerrar)
    // sin que corra el temporizador que cierra el aviso: un toque que llega tarde.
    await page.clock.setSystemTime(await page.evaluate(() => Date.now() + 13_000))
    await page.getByRole('button', { name: /^Deshacer/ }).click()
    await expect(page.locator('.resultado-de-deshacer')).toContainText(
      'Ya pasó el tiempo para deshacer. Puedes anularla desde el Historial.',
    )
    await esperarSinPalabrasQueEvitar(page)
  })

  test('predicción y ¿Necesito comprar? con historia (RN-AN-05, RN-AN-11, RN-AN-16)', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const ids = await prepararTiendaEnUso(page)
    await abrir(page, `./productos/${ids['Lejía Tradicional 1 L']}`)
    await expect(page.locator('#contenido')).toContainText(/Se acaba en ~\d+ días/)
    await abrir(page, `./productos/${ids['Ambientador Glade']}`)
    await expect(page.locator('#contenido')).toContainText('Sin ventas en las últimas 4 semanas')

    await abrir(page, './control')
    await expect(page.getByRole('region', { name: 'Productos parados' })).toContainText(
      'Ponlo a la vista u ofrécelo con descuento',
    )

    await abrir(page, './control/necesito-comprar')
    await page.getByLabel('¿Qué producto quieres comprar?').fill('escoba')
    await page.getByRole('button', { name: /Escoba de paja/ }).click()
    expect(await textoVisible(page, '.respuesta-grande')).toMatch(
      comoSeLee('No compres: no se vende hace 53 días y tienes 5 unid.'),
    )
  })
})

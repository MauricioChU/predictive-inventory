// Plan 16, ítem 1: la primera vez completa por "Uno por uno", tocando la pantalla (RN-SIS-05).
import { expect, test } from '@playwright/test'
import {
  comoSeLee,
  empezarElDia,
  h1,
  hacerPrimeraVezHastaCargar,
  irA,
  llenarProductoNuevo,
} from '../utilidades/recorridos'
import { anotarTextosVistos, esperarSinPalabrasQueEvitar } from '../utilidades/textos'

test.describe('Recorrido: la primera vez, uno por uno', () => {
  test('nombre → letra → un producto con foto y stock → "Seguir" → conteo guiado → Inicio con el saludo', async ({
    page,
  }) => {
    await anotarTextosVistos(page)
    await empezarElDia(page)
    await hacerPrimeraVezHastaCargar(page, 'Bodega Rosita', 'Muy grande')
    await expect(page.locator('html')).toHaveAttribute('data-letra', 'MUY_GRANDE')

    await page.getByRole('button', { name: 'Uno por uno' }).click()
    await llenarProductoNuevo(page, {
      nombre: 'Lejía Tradicional 1 L',
      categoria: 'Lejías y desinfectantes',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stock: '12',
      conFoto: true,
    })
    await expect(
      page.getByText(comoSeLee('Lejía Tradicional 1 L ya está en tu lista con 12 unid.')),
    ).toBeVisible()

    // "Seguir" (solo desde la primera vez) lleva al último paso.
    await page.getByRole('button', { name: 'Seguir' }).click()
    await expect(h1(page)).toHaveText('Ahora contemos lo que tienes')
    await page.getByRole('button', { name: 'Contar ahora' }).click()

    // Conteo guiado (RN-OP-21): uno por pantalla, con su foto; se cuentan 2 menos.
    await expect(h1(page)).toHaveText('Contar todo')
    await page.getByRole('button', { name: 'Empezar a contar' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Lejía Tradicional 1 L' })).toBeVisible()
    await expect(page.locator('#contenido img[src^="blob:"]')).toBeVisible()
    await expect(page.locator('.barra-de-progreso .texto')).toHaveText('Llevas 0 de 1')
    await page.getByLabel('¿Cuántos hay? (unid.)').fill('10')
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(h1(page)).toHaveText('Terminaste de contar')
    await expect(page.getByText(comoSeLee('Contaste 1 producto. 1 con diferencia: -S/ 4.80'))).toBeVisible()

    await page.getByRole('button', { name: 'Ir a Inicio' }).first().click()
    await expect(h1(page)).toHaveText(/^Hola, Bodega Rosita/)
    await expect(page.locator('html')).toHaveAttribute('data-letra', 'MUY_GRANDE')

    // Lo cargado está en Productos con el stock contado y la foto.
    await irA(page, 'Productos')
    const lista = page.getByRole('list', { name: 'Productos' })
    await expect(lista).toContainText('Lejía Tradicional 1 L')
    await expect(lista).toContainText(comoSeLee('10 unid.'))
    await expect(lista.locator('img[src^="blob:"]')).toHaveCount(1)

    // Volver a abrir la app no repite la bienvenida.
    await page.reload()
    await expect(h1(page)).toHaveText('Productos')
    await irA(page, 'Inicio')
    await expect(h1(page)).toHaveText(/^Hola, Bodega Rosita/)
    await esperarSinPalabrasQueEvitar(page)
  })
})

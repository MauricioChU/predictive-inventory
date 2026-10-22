// Plan 16, ítem 1 (M5): tocar una notificación abre su pantalla real (spec 03, RN-AL-03/07).
import { expect, test } from '@playwright/test'
import { abrir } from '../utilidades/navegacion'
import {
  comoSeLee,
  crearProductoPorPantalla,
  direccionDeLaNotificacion,
  empezarElDia,
  h1,
  hacerPrimeraVez,
  irA,
  nuevaVenta,
  tocarNotificacion,
  venderPorPantalla,
} from '../utilidades/recorridos'
import { notificacionesMostradas, notificacionesQueSeAceptan } from '../utilidades/tienda'

const LEJIA = 'Lejía Tradicional 1 L'

test.describe('Recorrido: los avisos en el celular', () => {
  test('una venta que deja poco avisa; tocar el aviso abre el producto, y el aviso de varios abre Para comprar', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000)
    await notificacionesQueSeAceptan(page)
    await empezarElDia(page)
    await hacerPrimeraVez(page)

    // M1 / RN-AL-08: los avisos se activan desde Ajustes (Inicio → Ajustes).
    await page.getByRole('link', { name: 'Ajustes' }).click()
    await page.getByRole('button', { name: 'Activar avisos' }).click()
    await page.getByRole('button', { name: 'Sí, avísame' }).click()
    await expect(h1(page)).toHaveText('Listo, te avisaremos')

    for (const p of [
      { nombre: LEJIA, compra: '2.40', venta: '3.50', minimo: '3', stock: '5' },
      { nombre: 'Jabón Bolívar', compra: '1.20', venta: '2.00', minimo: '4', stock: '5' },
      { nombre: 'Bolsas de basura x10', compra: '1.50', venta: '2.50', minimo: '2', stock: '3' },
    ]) {
      await crearProductoPorPantalla(page, p)
    }
    expect(await notificacionesMostradas(page), 'crear productos con stock no avisa').toEqual([])

    // Una venta deja poca Lejía: un aviso de ese producto.
    await irA(page, 'Vender')
    await venderPorPantalla(page, [{ buscado: 'lejia', nombre: LEJIA, cantidad: 3 }], 'S/ 10.50')
    await expect.poll(() => notificacionesMostradas(page)).toHaveLength(1)
    const [deUno] = await notificacionesMostradas(page)
    expect(deUno!.texto).toMatch(comoSeLee('Queda poco: Lejía Tradicional 1 L (2 unid.)'))
    expect(deUno!.url).toMatch(/^\/productos\/[\w-]+$/)

    // Otra venta deja poco de dos productos a la vez: un solo aviso para los dos.
    await nuevaVenta(page)
    await venderPorPantalla(
      page,
      [
        { buscado: 'jabon', nombre: 'Jabón Bolívar', cantidad: 2 },
        { buscado: 'bolsas', nombre: 'Bolsas de basura x10', cantidad: 2 },
      ],
      'S/ 9.00',
    )
    await expect.poll(() => notificacionesMostradas(page)).toHaveLength(2)
    const deVarios = (await notificacionesMostradas(page))[1]!
    expect(deVarios).toMatchObject({ texto: '2 productos se están acabando', url: '/productos?estado=se-acaban' })

    // Con la app abierta (en Inicio): el aviso de Lejía abre su detalle, sin recargar.
    await irA(page, 'Inicio')
    await page.evaluate(() => document.documentElement.setAttribute('data-sin-recargar', 'si'))
    await tocarNotificacion(page, deUno!.url)
    await expect(h1(page)).toHaveText(LEJIA)
    await expect(page).toHaveURL(new RegExp(`${deUno!.url}$`))
    await expect(page.getByText(comoSeLee('Tienes 2 unid.'))).toBeVisible()

    // El aviso de varios abre Productos filtrado por "Se acaban", con los tres que se acaban.
    await tocarNotificacion(page, deVarios.url)
    await expect(h1(page)).toHaveText('Productos')
    await expect(page).toHaveURL(/\/productos\?estado=se-acaban$/)
    await expect(page.getByRole('button', { name: 'Quitar filtro Se acaban' })).toBeVisible()
    for (const nombre of [LEJIA, 'Jabón Bolívar', 'Bolsas de basura x10']) {
      await expect(page.locator('#contenido').getByText(nombre, { exact: true })).toBeVisible()
    }
    await expect(page.locator('html')).toHaveAttribute('data-sin-recargar', 'si')

    // Con la app cerrada, el aviso abre la app directo en esa pantalla; "Volver" no es un
    // callejón sin salida (lleva a Inicio).
    await page.close()
    const otra = await context.newPage()
    await abrir(otra, direccionDeLaNotificacion(deUno!.url))
    await expect(h1(otra)).toHaveText(LEJIA)
    await otra.getByRole('button', { name: 'Volver' }).click()
    await expect(h1(otra)).toHaveText(/^BODEGA ROSITA/)
  })
})

import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
  usarLetra,
} from './utilidades/calidad'
import { abrir } from './utilidades/navegacion'
import { abrirTiendaLista } from './utilidades/tienda'
import {
  abrirDetalleDeVenta,
  agregarAlCarrito,
  cerrarDetalleDeVenta,
  totalDeLaVenta,
} from './utilidades/recorridos'
import {
  CARBON,
  cambiarCantidadEnLista,
  crearProducto,
  DETERGENTE,
  LEJIA,
  precioDeCompraDe,
  stockDe,
  tocablesChicos,
  trozosPartidos,
  venderPorCasoDeUso,
} from './utilidades/operaciones'

/**
 * Plan 12: los flujos críticos de operaciones, de punta a punta en la app real (IndexedDB,
 * casos de uso, pantallas). Los datos se preparan con los casos de uso; lo demás se hace
 * tocando la pantalla como lo haría la persona.
 */

const lineaDe = (page: Page, nombre: string) =>
  page.locator('.lista-del-carrito').getByRole('group', { name: nombre })

/** Busca y toca el producto; en Vender en celular deja el detalle del panel abierto. */
async function agregarBuscando(page: Page, texto: string, nombre: string): Promise<void> {
  await agregarAlCarrito(page, texto, nombre)
}

/**
 * Plan 17, ronda 1 (RN-UX-02): la forma compacta de la BarraDeTotal es SOLO para letra Muy
 * grande en 320–360 px. Con la letra por defecto (Grande) en celulares comunes y en la columna
 * del carrito en PC, el total sigue a 1.6rem y "Registrar llegada" va en su propia fila, a todo el ancho.
 */
test.describe('BarraDeTotal fuera de la forma compacta', () => {
  for (const ancho of [360, 412, 1280]) {
    test(`${ancho} px con letra Grande: total a 1.6rem y botón a todo el ancho en su fila`, async ({
      page,
    }) => {
      await usarLetra(page, 'GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrirTiendaLista(page, './')
      await crearProducto(page, LEJIA)
      // La BarraDeTotal ya no es de Vender (usa el panel de venta): se mide en Llegó mercadería.
      await abrir(page, './recibir')
      await agregarBuscando(page, 'lejia', 'Lejía 1 L')
      const m = await page.evaluate(() => {
        const contenido = document.querySelector<HTMLElement>('.barra-de-total .contenido')!
        const total = document.querySelector<HTMLElement>('.barra-de-total .total')!
        const boton = document.querySelector<HTMLElement>('.barra-de-total .accion')!
        const estilo = getComputedStyle(contenido)
        const ancho =
          contenido.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
        const raiz = parseFloat(getComputedStyle(document.documentElement).fontSize)
        return {
          letraTotal: parseFloat(getComputedStyle(total).fontSize) / raiz,
          anchoBoton: boton.getBoundingClientRect().width,
          ancho,
          debajo: boton.getBoundingClientRect().top >= total.getBoundingClientRect().bottom,
          icono: getComputedStyle(boton.querySelector('.icono')!).display,
        }
      })
      expect(m.letraTotal).toBeCloseTo(1.6, 2)
      expect(m.debajo).toBe(true)
      expect(m.anchoBoton).toBeGreaterThanOrEqual(m.ancho - 1)
      expect(m.icono).not.toBe('none')
    })
  }
})

test.describe('Vender (HU-OP-01, RN-OP-22)', () => {
  test('criterio de éxito 1: una venta de un producto en menos de 15 s desde Inicio, con el panel de venta y Deshacer', async ({
    page,
  }) => {
    // Plan 14: la tienda ya hizo la primera vez; Inicio es el de todos los días.
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, LEJIA)
    await venderPorCasoDeUso(page, lejia, '1') // ya es uno de los más vendidos
    await abrir(page, './')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^BODEGA ROSITA/)

    const inicio = Date.now()
    // El botón "Vender" de Inicio (no el enlace de la navegación).
    await page.getByRole('button', { name: 'Vender' }).click()
    await page.locator('.accesos-rapidos').getByRole('button', { name: 'Lejía 1 L' }).click()
    await expect(totalDeLaVenta(page)).toHaveText('S/ 3.50')
    await page.getByRole('button', { name: 'Confirmar venta' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Venta registrada' })).toBeVisible()
    const segundos = (Date.now() - inicio) / 1000
    expect(segundos, 'la venta se hizo en menos de 15 s').toBeLessThan(15)
    expect(await stockDe(page, lejia)).toBe(8)

    // RN-OP-18: Deshacer (10 s) anula la venta y deja el carrito para corregirlo.
    await page.getByRole('button', { name: /^Deshacer/ }).click()
    // r1 #2 (RN-UX-11): el resultado se ve en el pie y el foco queda en su "Cerrar".
    const resultado = page.locator('.resultado-de-deshacer')
    await expect(resultado).toContainText(
      'Deshiciste la venta de S/ 3.50. Tus productos volvieron al carrito.',
    )
    await expect(resultado.getByRole('button', { name: 'Cerrar' })).toBeFocused()
    await expect.poll(() => stockDe(page, lejia)).toBe(9)
    await abrirDetalleDeVenta(page)
    await expect(lineaDe(page, 'Lejía 1 L')).toBeVisible()
  })

  test('r1 #2 (RN-UX-02): con el aviso Deshacer y el panel del total a la vez, hay al menos 8 px entre los dos', async ({
    page,
  }) => {
    await usarLetra(page, 'MUY_GRANDE')
    await abrirTiendaLista(page, './')
    await crearProducto(page, LEJIA)
    await crearProducto(page, CARBON)
    await abrir(page, './vender')
    await agregarBuscando(page, 'lejia', 'Lejía 1 L')
    await page.getByRole('button', { name: 'Confirmar venta' }).click()
    await page.getByRole('button', { name: 'Nueva venta' }).click()
    await agregarBuscando(page, 'carbon', 'Carbón')
    await expect(page.locator('.aviso-deshacer')).toBeVisible()
    const separacion = await page.evaluate(() => {
      const barra = document
        .querySelector('.panel-de-venta .hoja, .barra-de-total')!
        .getBoundingClientRect()
      const deshacer = document.querySelector('.aviso-deshacer .deshacer')!.getBoundingClientRect()
      // Uno arriba del otro (celular) o en columnas distintas (PC): la distancia más corta.
      const vertical = Math.max(deshacer.top - barra.bottom, barra.top - deshacer.bottom)
      const horizontal = Math.max(deshacer.left - barra.right, barra.left - deshacer.right)
      return Math.max(vertical, horizontal)
    })
    expect(separacion).toBeGreaterThanOrEqual(8)
  })

  test('RN-OP-05 / RN-UX-07: vender más de lo que hay se marca junto a la cantidad', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    await crearProducto(page, LEJIA)
    await abrir(page, './vender')
    await agregarBuscando(page, 'lejia', 'Lejía 1 L')
    await lineaDe(page, 'Lejía 1 L').getByLabel('Cantidad (unid.)').fill('11')
    await expect(lineaDe(page, 'Lejía 1 L').getByRole('alert')).toHaveText(
      'Solo quedan 10 unid. de Lejía 1 L. Cambia la cantidad o registra la llegada de mercadería.',
    )
  })
})

test.describe('Panel de venta (RN-OP-22)', () => {
  test('celular: sube compacto, abre con Ver detalle, dice cuánto queda y confirma desde el compacto', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'El panel deslizable es de celular (< 1024 px)')
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, LEJIA)
    await crearProducto(page, CARBON)
    await abrir(page, './vender')
    await expect(page.locator('.panel-de-venta')).toHaveCount(0)

    await page.getByLabel('Buscar producto').fill('lejia')
    await page
      .getByRole('list', { name: 'Resultados' })
      .getByRole('button', { name: /^Lejía 1 L/ })
      .click()
    const panel = page.getByRole('region', { name: 'En esta venta · 1 producto' })
    await expect(panel).toBeVisible()
    await expect(totalDeLaVenta(page)).toHaveText('S/ 3.50')
    await expect(panel.getByRole('button', { name: 'Ver detalle' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    // Compacto: no tapa la grilla (el buscador sigue a la vista) y mide lo mínimo.
    await expect(page.locator('.lista-del-carrito')).toHaveCount(0)
    const caja = (await panel.boundingBox())!
    expect(caja.height, 'el panel compacto mide poco').toBeLessThan(200)
    await expect(page.getByLabel('Buscar producto')).toBeInViewport()

    await panel.getByRole('button', { name: 'Ver detalle' }).click()
    const linea = lineaDe(page, 'Lejía 1 L')
    await expect(linea.getByText('Quedan 9 unid.')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Ahora' })).toBeVisible()
    await linea.getByLabel('Cantidad (unid.)').fill('10')
    await expect(linea.getByText('Se acaba')).toBeVisible()
    await linea.getByLabel('Cantidad (unid.)').fill('3')
    await expect(linea.getByText('Quedan 7 unid.')).toBeVisible()
    await esperarSinDesplazamientoHorizontal(page)

    await panel.getByRole('button', { name: 'Cerrar' }).click()
    await expect(panel.getByRole('button', { name: 'Ver detalle' })).toBeFocused()
    await expect(totalDeLaVenta(page)).toHaveText('S/ 10.50')
    await page.getByRole('button', { name: 'Confirmar venta' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Venta registrada' })).toBeVisible()
    expect(await stockDe(page, lejia)).toBe(7)
  })

  test('celular: quitar la última línea baja el panel', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'El panel deslizable es de celular (< 1024 px)')
    await abrirTiendaLista(page, './')
    await crearProducto(page, LEJIA)
    await abrir(page, './vender')
    await agregarBuscando(page, 'lejia', 'Lejía 1 L')
    await lineaDe(page, 'Lejía 1 L').getByRole('button', { name: 'Quitar Lejía 1 L' }).click()
    await expect(page.locator('.panel-de-venta')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Vender' })).toBeFocused()
  })

  test('PC: el carrito va a la derecha, sin panel deslizable, con Confirmar venta', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'pc', 'El carrito a la derecha es de PC (≥ 1024 px)')
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, LEJIA)
    await abrir(page, './vender')
    await agregarBuscando(page, 'lejia', 'Lejía 1 L')
    await expect(page.locator('.panel-de-venta')).toHaveCount(0)
    const linea = lineaDe(page, 'Lejía 1 L')
    await expect(linea.getByText('Quedan 9 unid.')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Ahora' })).toBeVisible()
    const buscador = (await page.getByLabel('Buscar producto').boundingBox())!
    const carrito = (await linea.boundingBox())!
    expect(carrito.x, 'el carrito queda a la derecha del buscador').toBeGreaterThan(buscador.x + buscador.width - 1)
    await page.getByRole('button', { name: 'Confirmar venta' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Venta registrada' })).toBeVisible()
    expect(await stockDe(page, lejia)).toBe(9)
  })
})

test.describe('Llegó mercadería (HU-OP-03, HU-OP-09)', () => {
  test('RN-OP-14: con un costo nuevo pregunta si se actualiza el precio de compra (por defecto sí)', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, LEJIA)
    await abrir(page, './recibir')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Llegó mercadería')
    await agregarBuscando(page, 'lejia', 'Lejía 1 L')
    const linea = lineaDe(page, 'Lejía 1 L')
    await linea.getByLabel('Cantidad (unid.)').fill('12')
    await linea.getByRole('button', { name: 'Cambiar costo de Lejía 1 L' }).click()
    await linea.getByLabel('Nuevo costo en S/').fill('2.60')
    await linea.getByRole('button', { name: 'Guardar costo' }).click()
    await expect(linea.getByText('Costo nuevo')).toBeVisible()
    await page.getByRole('button', { name: 'Registrar llegada' }).click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText(
      '¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad',
    )
    // La opción por defecto (con el foco) es "Sí": Enter la elige.
    await expect(dialogo.getByRole('button', { name: 'Sí, actualizar' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mercadería registrada' }),
    ).toBeVisible()
    expect(await stockDe(page, lejia)).toBe(22)
    expect(await precioDeCompraDe(page, lejia)).toBe(260)
  })

  test('RN-OP-20: avisa la sobrecompra de un producto parado; "Cambiar cantidad" no registra y "Registrar igual" sí', async ({
    page,
  }) => {
    const ahora = Date.now()
    const DIA = 24 * 60 * 60 * 1000
    await page.clock.install({ time: new Date(ahora - 45 * DIA) })
    await abrirTiendaLista(page, './')
    const escoba = await crearProducto(page, {
      nombre: 'Escoba',
      compra: '6.00',
      venta: '9.00',
      minimo: '1',
      stock: '5',
    })
    await page.clock.setSystemTime(new Date(ahora))
    await abrir(page, './recibir')
    await agregarBuscando(page, 'escoba', 'Escoba')
    await lineaDe(page, 'Escoba').getByLabel('Cantidad (unid.)').fill('2')
    await page.getByRole('button', { name: 'Registrar llegada' }).click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText('Escoba no se vende hace 45 días y aún tienes 5 unid.')
    await dialogo.getByRole('button', { name: 'Cambiar cantidad' }).click()
    await expect(dialogo).toBeHidden()
    await expect(lineaDe(page, 'Escoba').getByLabel('Cantidad (unid.)')).toBeFocused()
    await expect(page.getByText('Revisa la cantidad')).toBeVisible()
    expect(await stockDe(page, escoba)).toBe(5)

    await page.getByRole('button', { name: 'Registrar llegada' }).click()
    await dialogo.getByRole('button', { name: 'Registrar igual' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mercadería registrada' }),
    ).toBeVisible()
    expect(await stockDe(page, escoba)).toBe(7)
  })

  test('RN-AN-08: abierta desde Para comprar se prellena con la lista de hoy (con los cambios del día)', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, { ...LEJIA, stock: '2' }) // queda poco: en la lista
    await crearProducto(page, CARBON) // está bien: no va
    await cambiarCantidadEnLista(page, lejia, '5')
    // Por la pantalla real de Para comprar (plan 13): "Registrar llegada" abre Llegó mercadería.
    await abrir(page, './control/para-comprar')
    await page.getByRole('button', { name: 'Registrar llegada' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Llegó mercadería')
    await expect(page).toHaveURL(/\/recibir\?desde=para-comprar$/)

    await expect(page.getByText('Cargamos tu lista para comprar de hoy')).toBeVisible()
    await expect(page.locator('.lista-del-carrito .fila-de-carrito')).toHaveCount(1)
    await expect(lineaDe(page, 'Lejía 1 L').getByLabel('Cantidad (unid.)')).toHaveValue('5')
    await page.getByRole('button', { name: 'Registrar llegada' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mercadería registrada' }),
    ).toBeVisible()
    expect(await stockDe(page, lejia)).toBe(7)
  })
})

test.describe('Contar todo (HU-OP-10, RN-OP-21)', () => {
  test('el conteo guiado se interrumpe con "Seguir después" y al volver sigue donde quedó', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    await crearProducto(page, LEJIA)
    await crearProducto(page, CARBON)
    await crearProducto(page, DETERGENTE)
    await abrir(page, './contar')
    await page.getByRole('button', { name: 'Empezar a contar' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Carbón' })).toBeVisible()
    await page.getByLabel('¿Cuántos hay? (kg)').fill('10')
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Detergente a granel' })).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Avance del conteo' })).toHaveAttribute(
      'aria-valuetext',
      'Llevas 1 de 3',
    )
    await page.getByRole('button', { name: 'Seguir después' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Guardamos tu avance' })).toBeVisible()

    // Se cierra la app y se vuelve a abrir el conteo.
    await abrir(page, './contar')
    await expect(page.getByText('Seguimos donde quedaste')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Detergente a granel' })).toBeVisible()
    await expect(page.locator('.barra-de-progreso .texto')).toHaveText('Llevas 1 de 3')
    await page.getByRole('button', { name: 'Saltar' }).click()
    await page.getByLabel('¿Cuántos hay? (unid.)').fill('8')
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Terminaste de contar' }),
    ).toBeVisible()
    await expect(page.getByText('Contaste 2 productos. 1 con diferencia: -S/ 4.80')).toBeVisible()
    await expect(page.getByText('Te faltó contar 1: Detergente a granel')).toBeVisible()
  })
})

test.describe('Historial (HU-OP-08, RN-OP-17)', () => {
  test('anular una venta desde el Historial devuelve el stock y la marca como anulada', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, LEJIA)
    await venderPorCasoDeUso(page, lejia, '2')
    await abrir(page, './historial')
    await expect(page.getByRole('heading', { level: 2, name: 'Hoy' })).toBeVisible()
    await page.getByRole('link', { name: /^Venta/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Venta')
    await page.getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByRole('dialog')).toContainText('¿Anular esta venta?')
    await page.getByRole('button', { name: 'Sí, anular' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Operación anulada' })).toBeVisible()
    expect(await stockDe(page, lejia)).toBe(10)

    await page.getByRole('button', { name: 'Volver al Historial' }).click()
    await expect(page.getByRole('link', { name: /^Anulado/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Venta/ })).toContainText('Anulada')
  })

  // Plan 17: DialogoConfirmacion en un navegador real (jsdom no tiene foco ni Escape nativos).
  test('el diálogo de anular: mensaje como descripción, foco adentro, Escape no anula y el foco vuelve a "Anular"', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    const lejia = await crearProducto(page, LEJIA)
    await venderPorCasoDeUso(page, lejia, '2')
    await abrir(page, './historial')
    await page.getByRole('link', { name: /^Venta/ }).click()
    const anular = page.getByRole('button', { name: 'Anular' })
    await anular.click()
    const dialogo = page.getByRole('dialog', { name: '¿Anular esta venta?' })
    await expect(dialogo).toHaveAccessibleDescription(
      'El stock vuelve a como estaba antes de esta operación. Una anulación no se puede deshacer.',
    )
    // Lo seguro primero: el foco en "No", dentro del diálogo.
    await expect(dialogo.getByRole('button', { name: 'No', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialogo).toBeHidden()
    await expect(anular).toBeFocused()
    expect(await stockDe(page, lejia)).toBe(8)
  })
})

interface FocoMedido {
  arriba: number
  abajo: number
  /** Borde de arriba de la BarraDeTotal. */
  barra: number
  nombre: string
}

/** Aprieta Tab `veces` veces y mide cada control enfocado que está dentro del carrito. */
async function recorrerElCarritoConTab(page: Page, veces: number): Promise<FocoMedido[]> {
  const medidas: FocoMedido[] = []
  for (let i = 0; i < veces; i += 1) {
    await page.keyboard.press('Tab')
    const medida = await page.evaluate(() => {
      const activo = document.activeElement
      if (!activo?.closest('.lista-del-carrito')) return null
      const caja = activo.getBoundingClientRect()
      const barra = document
        .querySelector('.pie-del-panel, .barra-de-total')!
        .getBoundingClientRect()
      return { arriba: caja.top, abajo: caja.bottom, barra: barra.top, nombre: activo.outerHTML }
    })
    if (medida) medidas.push(medida)
  }
  return medidas
}

test.describe('WCAG 2.4.11: el foco nunca queda tapado por el total y Confirmar venta', () => {
  test('al recorrer el carrito con Tab, cada control enfocado queda entero por encima del total', async ({
    page,
  }) => {
    await usarLetra(page, 'MUY_GRANDE')
    await abrirTiendaLista(page, './')
    for (const nombre of ['Lejía 1 L', 'Lejía 2 L', 'Lejía 5 L', 'Lejía 10 L']) {
      await crearProducto(page, { ...LEJIA, nombre })
    }
    await abrir(page, './vender')
    for (const nombre of ['Lejía 1 L', 'Lejía 2 L', 'Lejía 5 L', 'Lejía 10 L']) {
      await agregarBuscando(page, nombre.toLowerCase(), nombre)
    }
    await lineaDe(page, 'Lejía 1 L').getByLabel('Cantidad (unid.)').focus()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

    const enfocados = await recorrerElCarritoConTab(page, 40)
    expect(enfocados.length, 'se recorrieron controles del carrito').toBeGreaterThan(10)
    for (const medida of enfocados) {
      expect(medida.abajo, `tapado por la barra: ${medida.nombre}`).toBeLessThanOrEqual(
        medida.barra + 1,
      )
      expect(medida.arriba, `fuera de la vista: ${medida.nombre}`).toBeGreaterThanOrEqual(0)
    }
  })
})

/** Textos que nunca deben partirse a media palabra ni separar un monto de su "S/". */
const TEXTOS_SIN_CORTES = [
  '.encabezado-pagina h1',
  '.encabezado-pagina .volver',
  '.fila-de-dato dt',
  '.fila-de-dato dd',
  'dialog h2',
  'dialog p',
  '.aviso-deshacer .mensaje',
  '.pantalla-exito .detalle',
  '.operacion .productos',
  '.operacion .monto',
  '.barra-de-total .total',
  '.panel-de-venta .total',
  '.panel-de-venta .titulo-carrito',
  '.fila-de-carrito .precio',
  '.fila-de-carrito .quedan',
  '.fila-de-carrito .precio-unitario',
].join(', ')

/**
 * RN-SIS-06 / RN-SIS-07 / RN-UX-02: cada pantalla del plan 12 (y cada paso que cambia lo que se
 * ve) sin desplazamiento horizontal, sin violaciones graves de axe, con lo tocable de buen
 * tamaño y sin montos ni palabras partidos, con letra Muy grande.
 */
test.describe('Pantallas de operaciones: responsive, accesibles y tocables (letra Muy grande)', () => {
  for (const ancho of [320, 360, 768, 1280]) {
    test(`${ancho}px`, async ({ page }) => {
      test.setTimeout(90_000)
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrirTiendaLista(page, './')
      const lejia = await crearProducto(page, LEJIA)
      await crearProducto(page, CARBON)
      await venderPorCasoDeUso(page, lejia, '1')

      const revisar = async (paso: string) => {
        await page.evaluate(() => document.fonts.ready)
        await esperarSinDesplazamientoHorizontal(page)
        expect(await tocablesChicos(page), `${paso}: tocables de buen tamaño`).toEqual([])
        expect(await trozosPartidos(page, TEXTOS_SIN_CORTES), `${paso}: textos sin cortes`).toEqual(
          [],
        )
        await esperarSinViolacionesGraves(page)
      }

      await abrir(page, './vender')
      await page.locator('.accesos-rapidos').getByRole('button', { name: 'Lejía 1 L' }).click()
      await agregarBuscando(page, 'carbon', 'Carbón')
      await revisar('Vender con carrito (panel abierto en celular)')
      await cerrarDetalleDeVenta(page)
      await revisar('Vender: panel compacto')
      await page.getByRole('button', { name: 'Confirmar venta' }).click()
      await expect(page.locator('.aviso-deshacer')).toBeVisible()
      await revisar('Venta registrada')

      await abrir(page, './recibir')
      await agregarBuscando(page, 'lejia', 'Lejía 1 L')
      const linea = lineaDe(page, 'Lejía 1 L')
      await linea.getByRole('button', { name: 'Cambiar costo de Lejía 1 L' }).click()
      await linea.getByLabel('Nuevo costo en S/').fill('2.60')
      await linea.getByRole('button', { name: 'Guardar costo' }).click()
      await revisar('Llegó mercadería')
      await page.getByRole('button', { name: 'Registrar llegada' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await revisar('Pregunta del precio de compra')
      await page.getByRole('button', { name: 'Sí, actualizar' }).click()
      await expect(page.getByRole('heading', { name: 'Mercadería registrada' })).toBeVisible()

      await abrir(page, `./productos/${lejia}/merma`)
      await page.getByRole('radio', { name: 'Otro' }).click()
      await page.getByRole('button', { name: 'Guardar' }).click()
      await expect(page.getByRole('alert').first()).toBeVisible()
      await revisar('Registrar pérdida')
      await abrir(page, `./productos/${lejia}/contar`)
      await revisar('Contar stock')

      await abrir(page, './contar')
      await revisar('Contar todo (inicio)')
      await page.getByRole('button', { name: 'Empezar a contar' }).click()
      // Carbón: quedan 9 kg (se vendió 1): contar 5 cambia el stock y ofrece Deshacer.
      await page.getByLabel('¿Cuántos hay? (kg)').fill('5')
      await page.getByRole('button', { name: 'Siguiente' }).click()
      await expect(page.locator('.aviso-deshacer')).toBeVisible()
      await revisar('Contar todo (producto)')

      await abrir(page, './historial')
      await revisar('Historial')
      await page
        .getByRole('link', { name: /^Venta/ })
        .first()
        .click()
      await expect(page.getByRole('button', { name: 'Anular' })).toBeVisible()
      await revisar('Detalle de la operación')
    })
  }
})

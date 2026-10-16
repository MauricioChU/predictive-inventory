import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
  usarLetra,
  type Letra,
} from './utilidades/calidad'
import { caja, mostrarAvisoDeshacer } from './utilidades/escenarios'
import { abrir } from './utilidades/navegacion'

type VentanaConGanchos = Window & {
  __pruebas?: { mostrarCatalogo: (kit: 'productos') => Promise<void> }
}

const ALTO = 800
/** Plan 09b: el catálogo se verifica a 320/360/768/1280 px con letra Muy grande. */
const ANCHOS = [320, 360, 768, 1280]
const CELULAR = [320, 360]
/** I1: con letra Muy grande, columnas de AccesosRapidos y alto mínimo de cada botón. En celular
 * no entran 2 nombres de 13 letras a 1rem lado a lado: 1 columna de filas (foto al lado del
 * nombre, ≥ 64 px como una tarjeta); a 768 px, 2; en PC, 4 (celdas de ≥ 48 px). */
const ACCESOS_POR_ANCHO: Record<number, { columnas: number; enFilas: boolean; alto: number }> = {
  320: { columnas: 1, enFilas: true, alto: 64 },
  360: { columnas: 1, enFilas: true, alto: 64 },
  768: { columnas: 2, enFilas: false, alto: 48 },
  1280: { columnas: 4, enFilas: false, alto: 48 },
}

/** Monta el catálogo del kit A (src/shared/ui/__catalogo__/CatalogoKitProductos.vue) al final
 * de #contenido con el gancho de pruebas de la app, y espera a la letra. Las fotos no se
 * esperan: van con loading="lazy" y su caja es cuadrada y de medida fija, cargue o no. */
async function abrirCatalogo(page: Page, ancho: number, letra: Letra = 'MUY_GRANDE') {
  await usarLetra(page, letra)
  await page.setViewportSize({ width: ancho, height: ALTO })
  await abrir(page, './productos')
  await page.evaluate(async () => {
    const ganchos = (window as VentanaConGanchos).__pruebas
    if (!ganchos) throw new Error('La app no expuso window.__pruebas')
    await ganchos.mostrarCatalogo('productos')
  })
  await expect(page.getByRole('heading', { name: 'Kit de productos' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

/** Como abrirCatalogo y, si `conAviso`, además muestra el aviso Deshacer global (10 s). */
async function abrirCatalogoConAviso(page: Page, ancho: number, conAviso: boolean) {
  await abrirCatalogo(page, ancho)
  if (conAviso) await mostrarAvisoDeshacer(page)
}

/** Deja a la vista los estados que aparecen al usar los componentes: "Borrar" en el buscador,
 * la edición de precio abierta y el mensaje del vuelto. */
async function abrirEstadosInteractivos(page: Page) {
  await page.getByLabel('Buscar producto').fill('l')
  await page.getByRole('button', { name: 'Cambiar precio de Lejía Clorox 1 L' }).click()
  await page.getByRole('button', { name: 'S/ 20', exact: true }).click()
  // I2: el error de cantidad junto al campo (hay 2.5 kg de carbón).
  await page.getByRole('group', { name: 'Carbón vegetal' }).getByLabel('Cantidad (kg)').fill('3')
  await expect(page.getByRole('button', { name: 'Borrar' })).toBeVisible()
  await expect(page.getByLabel('Nuevo precio en S/')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Solo quedan 2.5 kg de Carbón vegetal')
}

for (const ancho of ANCHOS) {
  test.describe(`Kit de productos a ${ancho}px, letra Muy grande`, () => {
    test('RN-UX-09 / RN-SIS-07: sin desplazamiento horizontal y sin violaciones graves de axe', async ({
      page,
    }) => {
      await abrirCatalogo(page, ancho)
      await esperarSinDesplazamientoHorizontal(page)
      await esperarSinViolacionesGraves(page)
      await abrirEstadosInteractivos(page)
      await esperarSinDesplazamientoHorizontal(page)
      await esperarSinViolacionesGraves(page)
    })

    test('RN-UX-02: todo lo tocable mide ≥ 48 px; principales y billetes ≥ 56; tarjetas ≥ 64', async ({
      page,
    }) => {
      await abrirCatalogo(page, ancho)
      await abrirEstadosInteractivos(page)
      const medidas = await page.locator('.catalogo-kit-productos').evaluate((raiz) => {
        const visibles = (selector: string) =>
          [...raiz.querySelectorAll(selector)]
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && r.height > 0)
        const describir = ({ el, r }: { el: Element; r: DOMRect }) =>
          `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`
        return {
          chicos: visibles('button, input')
            .filter(({ r }) => r.width < 47.5 || r.height < 47.5)
            .map(describir),
          principalesBajos: visibles('.boton-principal, .billete, .buscador-grande .caja')
            .filter(({ r }) => r.height < 55.5)
            .map(describir),
          tarjetasBajas: visibles('.tarjeta-de-producto')
            .filter(({ r }) => r.height < 63.5)
            .map(describir),
        }
      })
      expect(medidas).toEqual({ chicos: [], principalesBajos: [], tarjetasBajas: [] })
    })

    test('AccesosRapidos: tantas columnas como entren con el nombre a 1rem entero (I1)', async ({
      page,
    }) => {
      await abrirCatalogo(page, ancho)
      const lista = page.getByRole('list', { name: 'Más vendidos' })
      const medida = await lista.evaluate((ul) => ({
        columnas: new Set([...ul.children].map((li) => Math.round(li.getBoundingClientRect().left)))
          .size,
        raiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
        botones: [...ul.querySelectorAll('button')].map((boton) => {
          const foto = boton.querySelector('.foto-de-producto')!.getBoundingClientRect()
          const el = boton.querySelector('.nombre')!
          const nombre = el.getBoundingClientRect()
          const caja = boton.getBoundingClientRect()
          // Palabras partidas entre dos líneas (un Range por palabra).
          const nodo = el.firstChild!
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
          return {
            texto,
            alto: caja.height,
            nombreAlLado: nombre.left >= foto.right - 0.5,
            letra: parseFloat(getComputedStyle(el).fontSize),
            partidas,
            seSale:
              nombre.left < caja.left - 0.5 ||
              nombre.right > caja.right + 0.5 ||
              el.scrollWidth > el.clientWidth + 1,
          }
        }),
      }))
      const esperado = ACCESOS_POR_ANCHO[ancho]!
      expect(medida.columnas).toBe(esperado.columnas)
      expect(medida.botones).toHaveLength(8)
      for (const boton of medida.botones) {
        expect(boton.nombreAlLado).toBe(esperado.enFilas)
        expect(boton.alto).toBeGreaterThanOrEqual(esperado.alto)
        // RN-UX-01: a la letra elegida, entero y adentro de su botón, en cualquier ancho.
        expect(boton.letra, boton.texto).toBeGreaterThanOrEqual(medida.raiz)
        expect(boton.partidas, boton.texto).toEqual([])
        expect(boton.seSale, boton.texto).toBe(false)
      }
    })
  })
}

for (const ancho of CELULAR) {
  test(`celular ${ancho}px, letra Muy grande: nombres en 3 líneas como máximo, enteros y sin achicar`, async ({
    page,
  }) => {
    await abrirCatalogo(page, ancho)
    await page.getByLabel('Buscar producto').fill('l') // para que aparezca "Borrar"
    const nombres = await page.locator('.catalogo-kit-productos').evaluate((raiz) => {
      const medir = (el: Element) => {
        const nodo = el.firstChild!
        const texto = nodo.textContent ?? ''
        const partidas: string[] = []
        let inicio = 0
        for (const palabra of texto.split(' ')) {
          const rango = document.createRange()
          rango.setStart(nodo, inicio)
          rango.setEnd(nodo, inicio + palabra.length)
          const lineas = new Set(
            [...rango.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)),
          )
          if (lineas.size > 1) partidas.push(palabra)
          inicio += palabra.length + 1
        }
        const estilo = getComputedStyle(el)
        const propia = el.getBoundingClientRect()
        const boton = el.closest('button')!.getBoundingClientRect()
        return {
          texto,
          partidas,
          lineas: propia.height / parseFloat(estilo.lineHeight),
          tope: estilo.webkitLineClamp,
          letra: parseFloat(estilo.fontSize),
          // El nombre no sale de su botón ni queda recortado adentro (una palabra entera que no
          // entra no se "parte", pero se sale por los costados: también es un defecto).
          seSale:
            propia.left < boton.left - 0.5 ||
            propia.right > boton.right + 0.5 ||
            el.scrollWidth > el.clientWidth + 1,
        }
      }
      const borrar = raiz.querySelector('.buscador-grande .borrar span')!
      return {
        raiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
        tarjetas: [...raiz.querySelectorAll('.tarjeta-de-producto .nombre')].map(medir),
        accesos: [...raiz.querySelectorAll('.accesos-rapidos .nombre')].map(medir),
        borrar: parseFloat(getComputedStyle(borrar).fontSize),
      }
    })
    expect(nombres.raiz).toBe(24) // letra Muy grande
    expect(nombres.tarjetas.length).toBeGreaterThan(0)
    for (const nombre of nombres.tarjetas) {
      // En angosto la tarjeta deja 3 líneas: las variantes ("… 1 L" / "… 5 L") difieren al final.
      expect(nombre.tope, nombre.texto).toBe('3')
      expect(nombre.lineas, nombre.texto).toBeLessThanOrEqual(3.05)
    }
    // RN-UX-01 (I1): ningún texto del kit baja de la letra elegida para que entre.
    for (const nombre of nombres.accesos) {
      expect(nombre.letra, nombre.texto).toBeGreaterThanOrEqual(nombres.raiz)
    }
    expect(nombres.borrar, '"Borrar"').toBeGreaterThanOrEqual(nombres.raiz)
    const todos = [...nombres.tarjetas, ...nombres.accesos]
    expect(todos.flatMap((n) => n.partidas)).toEqual([])
    expect(todos.filter((n) => n.seSale).map((n) => n.texto)).toEqual([])
  })

  test(`celular ${ancho}px, letra Muy grande: "Borrar" pasa a su propia fila, a todo el ancho (I1)`, async ({
    page,
  }) => {
    await abrirCatalogo(page, ancho)
    await page.getByLabel('Buscar producto').fill('l')
    const borrar = await caja(page, '.buscador-grande .borrar')
    const campo = await caja(page, '.buscador-grande .caja')
    expect(borrar.top).toBeGreaterThanOrEqual(campo.bottom)
    expect(Math.abs(borrar.width - campo.width)).toBeLessThanOrEqual(1)
    expect(borrar.height).toBeGreaterThanOrEqual(48)
  })
}

test.describe('Comportamiento en el navegador (360 px, letra Muy grande)', () => {
  test.beforeEach(async ({ page }) => {
    await abrirCatalogo(page, 360)
  })

  test('TarjetaDeProducto: un botón llamado "nombre + stock", con precio y estado como descripción', async ({
    page,
  }) => {
    const tarjeta = page
      .getByRole('list', { name: 'Resultados' })
      .getByRole('button', { name: 'Lejía Clorox 1 L 12 unid.', exact: true })
    await expect(tarjeta).toHaveAccessibleDescription('S/ 4.50 Queda poco Se acaba en ~4 días')
    await tarjeta.click()
    await expect(page.getByText('Elegiste: Lejía Clorox 1 L')).toBeVisible()
  })

  test('BuscadorGrande: filtra tras la espera, "Borrar" vacía y devuelve el foco, Enter no espera', async ({
    page,
  }) => {
    const campo = page.getByLabel('Buscar producto')
    await expect(campo).toHaveAttribute('inputmode', 'search')
    await expect(campo).toHaveAttribute('enterkeyhint', 'search')
    await campo.pressSequentially('lej')
    await expect(page.getByText('Buscando: «lej»')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Resultados' }).getByRole('listitem')).toHaveCount(
      1,
    )

    await page.getByRole('button', { name: 'Borrar' }).click()
    await expect(campo).toHaveValue('')
    await expect(campo).toBeFocused()
    await expect(page.getByText('Buscando: «»')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Borrar' })).toHaveCount(0)

    // Escribir y Enter en el mismo instante; se mira a los 50 ms, dentro de la espera de 200.
    const ecos = await campo.evaluate(async (input: HTMLInputElement) => {
      const eco = () => document.querySelector('[data-prueba="eco-busqueda"]')?.textContent
      const escribir = (valor: string) => {
        input.value = valor
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const pausa = (ms: number) => new Promise((listo) => setTimeout(listo, ms))
      escribir('bol')
      await pausa(50)
      const sinEnter = eco()
      escribir('zzz')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await pausa(50)
      return { sinEnter, conEnter: eco() }
    })
    expect(ecos).toEqual({ sinEnter: 'Buscando: «»', conEnter: 'Buscando: «zzz»' })
    await expect(page.getByText('No encontramos ese producto')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agregar producto' })).toBeVisible()
  })

  test('FilaDeCarrito: cambia el precio en línea y "Quitar" saca la línea', async ({ page }) => {
    const cambiar = page.getByRole('button', { name: 'Cambiar precio de Lejía Clorox 1 L' })
    await expect(cambiar).toHaveAttribute('aria-expanded', 'false')
    await cambiar.click()
    const precio = page.getByLabel('Nuevo precio en S/')
    await expect(precio).toBeFocused()
    await expect(precio).toHaveValue('4.50')
    // I2: un precio que no sirve deja la edición abierta, con lo escrito y el error al lado.
    await precio.fill('4..2')
    await precio.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('Escribe un precio válido, por ejemplo 4.50')
    await expect(precio).toHaveValue('4..2')
    await expect(precio).toBeFocused()
    await precio.fill('4.20')
    await page.getByRole('button', { name: 'Guardar precio' }).click()
    const fila = page.getByRole('group', { name: 'Lejía Clorox 1 L' })
    await expect(fila.getByText('S/ 4.20 c/u')).toBeVisible()
    await expect(fila.getByText('Precio especial')).toBeVisible()
    await expect(fila.getByText('S/ 8.40')).toBeVisible()
    await expect(cambiar).toBeFocused()
    await expect(page.getByRole('alert')).toHaveCount(0)

    await page.getByRole('button', { name: 'Quitar Lejía Clorox 1 L' }).click()
    await expect(fila).toHaveCount(0)
    await expect(page.locator('.barra-de-total .total')).toHaveText('S/ 5.63')
  })

  test('SelectorDeBilletes: billete, monto escrito y "Exacto" actualizan el mensaje anunciado', async ({
    page,
  }) => {
    const mensaje = page.locator('.selector-de-billetes [aria-live="polite"]')
    const monto = page.getByLabel('Paga con (S/)')
    await page.getByRole('button', { name: 'S/ 20', exact: true }).click()
    await expect(monto).toHaveValue('20')
    await expect(mensaje).toHaveText('Vuelto S/ 5.37')
    await monto.fill('10')
    await expect(mensaje).toHaveText('Faltan S/ 4.63')
    await page.getByRole('button', { name: 'Exacto' }).click()
    await expect(monto).toHaveValue('14.63')
    await expect(mensaje).toHaveText('Pago exacto: no hay vuelto')
  })

  test('CampoFoto: elegir de la galería muestra la vista previa; "Quitar foto" la saca', async ({
    page,
  }) => {
    const campo = page.getByRole('group', { name: 'Foto del producto' })
    // PNG de 1×1 px.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    await campo
      .locator('input[type="file"]:not([capture])')
      .setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png })
    const previa = campo.getByRole('img', { name: 'Lejía Clorox 1 L' })
    await expect(previa).toBeVisible()
    await expect(previa).toHaveAttribute('src', /^blob:/)

    await campo.getByRole('button', { name: 'Quitar foto' }).click()
    await expect(campo.locator('img')).toHaveCount(0)
    await expect(campo.getByText('Todavía no tiene foto')).toBeVisible()
    await expect(campo.getByRole('button', { name: 'Tomar foto' })).toBeFocused()

    await campo
      .locator('input[capture="environment"]')
      .setInputFiles({ name: 'lista.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') })
    await expect(page.getByRole('alert')).toHaveText(
      'Ese archivo no es una foto. Elige una foto de la galería o toma una nueva.',
    )
  })
})

test.describe('BarraDeTotal: pegada abajo de la columna, encima de lo que va fijo abajo', () => {
  for (const ancho of CELULAR) {
    for (const conAviso of [false, true]) {
      test(`celular ${ancho}px, letra Muy grande${conAviso ? ', con aviso Deshacer' : ''}: justo encima del pie`, async ({
        page,
      }) => {
        await abrirCatalogoConAviso(page, ancho, conAviso)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await expect
          .poll(async () => {
            const barra = await caja(page, '.barra-de-total')
            const pie = await caja(page, '.pie')
            return Math.abs(barra.bottom - pie.top)
          }, 'la barra queda pegada sobre el pie (navegación + aviso)')
          .toBeLessThanOrEqual(1)
        // Al final del recorrido queda en su lugar, sin tapar lo de arriba ni quedar bajo el pie.
        await page.evaluate(() =>
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
        )
        const barra = await caja(page, '.barra-de-total')
        const pie = await caja(page, '.pie')
        const anterior = await caja(page, '[data-prueba="cobros"]')
        expect(barra.bottom).toBeLessThanOrEqual(pie.top + 1)
        expect(anterior.bottom).toBeLessThanOrEqual(barra.top + 1)
        await page.getByRole('button', { name: 'Cobrar' }).click()
        await expect(page.getByText('Cobros: 1')).toBeVisible()
      })
    }
  }

  test('PC 1280px, letra Muy grande: al fondo de la ventana, y sobre el aviso Deshacer si aparece', async ({
    page,
  }) => {
    await abrirCatalogo(page, 1280)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect
      .poll(async () => Math.abs((await caja(page, '.barra-de-total')).bottom - ALTO))
      .toBeLessThanOrEqual(1)
    // El total queda a la vista mientras se toca "Cobrar" (no lo tapa nada).
    await page.getByRole('button', { name: 'Cobrar' }).click()
    await expect(page.getByText('Cobros: 1')).toBeVisible()

    await mostrarAvisoDeshacer(page)
    await expect
      .poll(async () => {
        const barra = await caja(page, '.barra-de-total')
        const aviso = await caja(page, '.zona-aviso-deshacer')
        return Math.abs(barra.bottom - aviso.top)
      }, 'la barra sube y queda justo encima del aviso Deshacer')
      .toBeLessThanOrEqual(1)
  })
})

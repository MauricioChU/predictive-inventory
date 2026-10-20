import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import {
  boton,
  buscar,
  desmontar,
  esperarDatos,
  HOY,
  leer,
  montarPantalla,
  type PantallaMontada,
} from '../soporte/pantallas'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'
import { instanteLocal } from '@/shared/domain/fecha'
import { formatearNumero } from '@/shared/domain/formato'

/** Los productos del Antecedente de operaciones.feature. */
async function tiendaDePrueba(): Promise<{
  app: AplicacionDePrueba
  ids: { lejia: string; carbon: string; detergente: string }
}> {
  const app = crearAplicacionDePrueba({ ahora: HOY })
  const ids = {
    lejia: await crearProductoDePrueba(app, {
      nombre: 'Lejía 1 L',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stockInicial: '10',
    }),
    carbon: await crearProductoDePrueba(app, {
      nombre: 'Carbón',
      unidad: 'KILO',
      compra: '2.75',
      venta: '4.00',
      minimo: '3',
      stockInicial: '10',
    }),
    detergente: await crearProductoDePrueba(app, {
      nombre: 'Detergente a granel',
      unidad: 'KILO',
      compra: '5.30',
      venta: '7.90',
      minimo: '2',
      stockInicial: '5',
    }),
  }
  return { app, ids }
}

const stock = async (app: AplicacionDePrueba, id: string) =>
  formatearNumero(await app.inventario.consultable.stockDe(id))

let pantalla: PantallaMontada | undefined
afterEach(() => {
  desmontar(pantalla)
  pantalla = undefined
  vi.unstubAllGlobals()
})

async function abrirVender(app: AplicacionDePrueba) {
  pantalla = await montarPantalla('/vender', { app })
  return pantalla
}

const lineas = (p: PantallaMontada) => p.w.findAll('.fila-de-carrito')
const panel = (p: PantallaMontada) => p.w.get('.panel-de-venta')
const total = (p: PantallaMontada) => p.w.get('.panel-de-venta .total').text()
const confirmar = (p: PantallaMontada) => boton(panel(p), 'Confirmar venta')
const cantidadDe = (p: PantallaMontada, indice: number) =>
  (lineas(p)[indice]!.get('.cantidad input').element as HTMLInputElement).value

/** Abre el detalle del panel (líneas, "quedan" y ¿Cuándo fue?), si no estaba abierto. */
async function detalle(p: PantallaMontada) {
  if (p.w.find('.panel-de-venta .alternar[aria-expanded="false"]').exists()) {
    await boton(panel(p), 'Ver detalle').trigger('click')
    await esperarDatos(p.app)
  }
}

async function confirmarVenta(p: PantallaMontada) {
  await confirmar(p).trigger('click')
  await esperarDatos(p.app)
}

async function agregarBuscando(p: PantallaMontada, texto: string, nombre: string) {
  await buscar(p, texto)
  const tarjeta = p.w
    .findAll('.lista-de-productos .tarjeta-de-producto')
    .find((t) => t.get('.nombre').text() === nombre)
  if (!tarjeta) throw new Error(`No apareció "${nombre}" al buscar "${texto}"`)
  await tarjeta.trigger('click')
  await esperarDatos(p.app)
}

async function cambiarCantidad(p: PantallaMontada, indice: number, texto: string) {
  await detalle(p)
  await lineas(p)[indice]!.get('.cantidad input').setValue(texto)
  await esperarDatos(p.app)
}

/** Simula un celular ancho o una PC: el panel sabe a qué ancho está (corte de 1024 px). */
function simularAncho(ancho: number) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('min-width: 1024px') ? ancho >= 1024 : false,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

describe('Vender (HU-OP-01, RN-OP-22: panel de venta)', () => {
  it('muestra el buscador grande y, sin productos elegidos, ni panel ni sección "En esta venta"', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    expect(p.w.get('h1').text()).toBe('Vender')
    expect(p.w.get('.buscador-grande label').text()).toBe('Buscar producto')
    expect(p.w.find('.accesos-rapidos').exists()).toBe(false)
    expect(lineas(p)).toHaveLength(0)
    expect(p.w.find('.panel-de-venta').exists()).toBe(false)
    expect(p.w.text()).not.toContain('En esta venta')
    expect(p.w.text()).not.toContain('Toca un producto para agregarlo.')
  })

  it('accesos rápidos: los más vendidos primero (como máximo 8); tocar uno lo agrega con cantidad 1', async () => {
    const { app, ids } = await tiendaDePrueba()
    await app.inventario.registrarVenta({ lineas: [{ productoId: ids.carbon, cantidad: '1' }] })
    await app.inventario.registrarVenta({ lineas: [{ productoId: ids.carbon, cantidad: '1' }] })
    await app.inventario.registrarVenta({ lineas: [{ productoId: ids.lejia, cantidad: '1' }] })
    const p = await abrirVender(app)
    const accesos = p.w.findAll('.accesos-rapidos .acceso')
    expect(accesos.map((a) => a.get('.nombre').text())).toEqual(['Carbón', 'Lejía 1 L'])

    await accesos[1]!.trigger('click')
    await esperarDatos(app)
    await detalle(p)
    expect(lineas(p)).toHaveLength(1)
    expect(lineas(p)[0]!.get('.nombre').text()).toBe('Lejía 1 L')
    expect(cantidadDe(p, 0)).toBe('1')
    expect(total(p)).toBe('S/ 3.50')
    expect(confirmar(p).exists()).toBe(true)
  })

  it('RN-CAT-12: el buscador encuentra sin tildes y al elegir se vacía para buscar el siguiente', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    expect(panel(p).get('.titulo-carrito').text()).toBe('En esta venta')
    expect((p.w.get('.buscador-grande input').element as HTMLInputElement).value).toBe('')
    expect(p.w.find('.lista-de-productos').exists()).toBe(false)
  })

  it('RN-CAT-12: si no encuentra nada lo dice y ofrece borrar la búsqueda (RN-UX-10)', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await buscar(p, 'escoba')
    expect(p.w.text()).toContain('No encontramos "escoba"')
    await boton(p.w, 'Borrar búsqueda').trigger('click')
    await esperarDatos(app)
    expect((p.w.get('.buscador-grande input').element as HTMLInputElement).value).toBe('')
  })

  describe('RN-OP-22: el panel de venta', () => {
    it('al agregar el primer producto sube el panel ya abierto: región con nombre, líneas, total y Confirmar venta', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')

      const region = panel(p)
      expect(region.element.tagName).toBe('SECTION')
      const titulo = region.get('.titulo-carrito')
      expect(region.attributes('aria-labelledby')).toBe(titulo.attributes('id'))
      expect(titulo.text()).toBe('En esta venta')
      expect(panel(p).get('.total-del-panel .etiqueta').text()).toBe('Total · 1 producto')
      expect(total(p)).toBe('S/ 3.50')
      expect(confirmar(p).exists()).toBe(true)
      const alternar = region.get('.alternar')
      expect(alternar.attributes('aria-expanded')).toBe('true')
      expect(alternar.text()).toContain('Ocultar')
      // Abierto a toda la pantalla: las líneas y ¿Cuándo fue?; lo de atrás no se alcanza y el
      // foco pasa al título del panel.
      expect(lineas(p)).toHaveLength(1)
      expect(p.w.find('.panel-de-venta [role="radiogroup"]').exists()).toBe(true)
      expect(p.w.get('.buscador').attributes('inert')).toBeDefined()
      expect(p.w.get('.avisos').attributes('inert')).toBeDefined()
      expect(document.activeElement).toBe(titulo.element)
    })

    it('la cabecera cuenta los productos y el total los suma', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await agregarBuscando(p, 'carbon', 'Carbón')
      expect(panel(p).get('.total-del-panel .etiqueta').text()).toBe('Total · 2 productos')
      expect(total(p)).toBe('S/ 7.50')
    })

    it('Ver detalle vuelve a abrir el panel: aria-expanded, el foco pasa al título, y se ven líneas y ¿Cuándo fue?', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await boton(panel(p), 'Ocultar').trigger('click')
      await esperarDatos(app)
      await boton(panel(p), 'Ver detalle').trigger('click')
      await esperarDatos(app)

      expect(panel(p).get('.alternar').attributes('aria-expanded')).toBe('true')
      expect(panel(p).get('.alternar').text()).toContain('Ocultar')
      expect(document.activeElement).toBe(panel(p).get('.titulo-carrito').element)
      expect(lineas(p)).toHaveLength(1)
      expect(
        panel(p)
          .findAll('[role="radio"]')
          .map((r) => r.text()),
      ).toEqual(['Ahora', 'Otro día'])
      expect(total(p)).toBe('S/ 3.50')
      expect(confirmar(p).exists()).toBe(true)
    })

    it('Ocultar deja solo el total y Confirmar venta, y el foco queda en el botón', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      const alternar = () => panel(p).get('.alternar')
      ;(alternar().element as HTMLElement).focus()
      await alternar().trigger('click')
      await esperarDatos(app)
      expect(alternar().attributes('aria-expanded')).toBe('false')
      expect(alternar().text()).toContain('Ver detalle')
      expect(lineas(p)).toHaveLength(0)
      expect(total(p)).toBe('S/ 3.50')
      expect(confirmar(p).exists()).toBe(true)
      expect(document.activeElement).toBe(alternar().element)
    })

    it('RN-UX-05: abrir y cerrar es con botón, no con gestos', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      for (const evento of ['touchstart', 'touchmove', 'pointermove', 'dblclick']) {
        await panel(p).trigger(evento)
      }
      expect(panel(p).get('.alternar').attributes('aria-expanded')).toBe('true')
      // La asa es solo un dibujo: no se puede tocar ni la lee el lector de pantalla.
      expect(panel(p).get('.asa').attributes('aria-hidden')).toBe('true')
    })

    it('cada línea dice cuántas unidades quedan tras la venta y se actualiza al cambiar la cantidad', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await detalle(p)
      const quedan = () => lineas(p)[0]!.get('.quedan').text()
      expect(quedan()).toBe('Quedan 9 unid.')
      await cambiarCantidad(p, 0, '3')
      expect(quedan()).toBe('Quedan 7 unid.')
      await lineas(p)[0]!.get('button[aria-label="Agregar uno"]').trigger('click')
      await esperarDatos(app)
      expect(quedan()).toBe('Quedan 6 unid.')
    })

    it('si la cantidad deja el stock en 0 dice "Se acaba"; si lo pasa, no dice cuánto queda y sigue el error', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await cambiarCantidad(p, 0, '10')
      expect(lineas(p)[0]!.get('.quedan').text()).toBe('Se acaba')
      await cambiarCantidad(p, 0, '11')
      expect(lineas(p)[0]!.find('.quedan').exists()).toBe(false)
      expect(lineas(p)[0]!.get('.campo-numero .error').text()).toBe(
        'Solo quedan 10 unid. de Lejía 1 L. Cambia la cantidad o registra la llegada de mercadería.',
      )
    })

    it('con kilos: "Quedan 7.5 kg"', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'carbon', 'Carbón')
      await cambiarCantidad(p, 0, '2,5')
      expect(lineas(p)[0]!.get('.quedan').text()).toBe('Quedan 7.5 kg')
    })

    it('quitar la última línea baja el panel y el foco va al título de la pantalla', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await agregarBuscando(p, 'carbon', 'Carbón')
      await detalle(p)
      await boton(lineas(p)[0]!, 'Quitar').trigger('click')
      await esperarDatos(app)
      expect(lineas(p)).toHaveLength(1)
      expect(document.activeElement).toBe(panel(p).get('.titulo-carrito').element)

      await boton(lineas(p)[0]!, 'Quitar').trigger('click')
      await esperarDatos(app)
      expect(p.w.find('.panel-de-venta').exists()).toBe(false)
      expect(document.activeElement).toBe(p.w.get('#contenido h1').element)
    })

    it('Escape en la edición del precio cierra solo esa edición, no el panel', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await detalle(p)
      await lineas(p)[0]!.get('.precio-tocable').trigger('click')
      await esperarDatos(app)
      await lineas(p)[0]!.get('.edicion-precio input').trigger('keydown', { key: 'Escape' })
      await esperarDatos(app)
      expect(lineas(p)[0]!.find('.edicion-precio').exists()).toBe(false)
      expect(panel(p).get('.alternar').attributes('aria-expanded')).toBe('true')
      // Escape fuera de la edición sí cierra la hoja, y el foco vuelve al botón.
      await panel(p).get('.titulo-carrito').trigger('keydown', { key: 'Escape' })
      await esperarDatos(app)
      expect(panel(p).get('.alternar').attributes('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(panel(p).get('.alternar').element)
    })

    it('cada línea del panel es compacta: nombre, cuánto queda y precio c/u con el importe al lado; − / + con Cambiar precio y Quitar', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await detalle(p)
      const linea = lineas(p)[0]!
      expect(linea.classes()).toContain('fila-de-carrito--compacta')
      // Las etiquetas "Cantidad (unid.)" e "Importe" siguen para el lector de pantalla.
      const etiqueta = linea.get('.cantidad label')
      expect(etiqueta.text()).toBe('Cantidad (unid.)')
      expect(etiqueta.classes()).toContain('solo-lector')
      expect(etiqueta.attributes('for')).toBe(linea.get('.cantidad input').attributes('id'))
      expect(linea.get('.importe .solo-lector').text()).toBe('Importe')
      expect(linea.get('.valor-importe').text()).toBe('S/ 3.50')
      expect(linea.get('.quedan').text()).toBe('Quedan 9 unid.')
      // El precio por unidad es el botón para cambiarlo; Quitar va junto a − / +.
      const precio = linea.get('.precio-tocable')
      expect(precio.text()).toContain('S/ 3.50 c/u')
      expect(precio.get('.solo-lector').text()).toBe('Cambiar precio de Lejía 1 L:')
      expect(linea.get('.abajo').text()).toContain('Quitar')
      expect(panel(p).get('.titulo-carrito').text()).toBe('En esta venta')
    })

    it('el panel no tapa la grilla: va en el flujo de la pantalla, que le deja su lugar', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      // Hijo de la pantalla (no de la hoja flotante del buscador): sticky en su flujo.
      expect(panel(p).element.closest('.vista-vender')).not.toBeNull()
      expect(panel(p).element.closest('.buscador')).toBeNull()
    })

    it('al agregar y al cambiar cantidades se anuncia el total (aria-live)', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await new Promise((resolver) => setTimeout(resolver, 300))
      expect(leer(p.w.get('p[role="status"]'))).toContain('Total S/ 3.50')
      await cambiarCantidad(p, 0, '2')
      await new Promise((resolver) => setTimeout(resolver, 300))
      expect(leer(p.w.get('p[role="status"]'))).toContain('Total S/ 7.00')
    })

    it('confirmar desde el panel compacto registra la venta con Ahora y muestra el éxito sin vuelto', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await confirmarVenta(p)

      expect(await stock(app, ids.lejia)).toBe('9')
      const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
      // "Ahora": al minuto (el reloj de la prueba avanza unos milisegundos).
      expect(venta?.ocurridaEn.slice(0, 16)).toBe(HOY.slice(0, 16))
      expect(p.w.get('.pantalla-exito h1').text()).toBe('Venta registrada')
      expect(leer(p.w.get('.pantalla-exito .detalle'))).toBe('Total S/ 3.50')
      expect(p.w.find('.panel-de-venta').exists()).toBe(false)
    })

    it('nunca pregunta con cuánto pagan: no hay Cobrar, billetes ni vuelto', async () => {
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await detalle(p)
      for (const texto of ['Cobrar', 'Paga con', 'Vuelto', 'Exacto', 'S/ 100']) {
        expect(p.w.text()).not.toContain(texto)
      }
    })

    it('confirmar desde el compacto con una cantidad que pasa el stock abre el detalle y lleva el foco al error', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await cambiarCantidad(p, 0, '11')
      await boton(panel(p), 'Ocultar').trigger('click')
      await esperarDatos(app)

      await confirmarVenta(p)
      expect(panel(p).get('.alternar').attributes('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(lineas(p)[0]!.get('.cantidad input').element)
      expect(await stock(app, ids.lejia)).toBe('10')
    })

    it('con una cantidad vacía no confirma: abre el detalle y pide escribirla', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await cambiarCantidad(p, 0, '')
      await boton(panel(p), 'Ocultar').trigger('click')
      await esperarDatos(app)
      await confirmarVenta(p)
      expect(lineas(p)[0]!.get('.campo-numero .error').text()).toBe('Escribe la cantidad')
      expect(await stock(app, ids.lejia)).toBe('10')
    })
  })

  describe('PC (≥ 1024 px): sin panel deslizable', () => {
    it('el carrito va a la derecha con el mismo contenido que el panel expandido y Confirmar venta', async () => {
      simularAncho(1280)
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')

      expect(p.w.find('.panel-de-venta').exists()).toBe(false)
      expect(p.w.find('.columna-carrito').exists()).toBe(true)
      expect(lineas(p)).toHaveLength(1)
      // En PC hay lugar: la línea va con sus etiquetas a la vista (no la forma compacta).
      expect(lineas(p)[0]!.classes()).not.toContain('fila-de-carrito--compacta')
      expect(lineas(p)[0]!.get('.quedan').text()).toBe('Quedan 9 unid.')
      expect(p.w.findAll('.columna-carrito [role="radio"]').map((r) => r.text())).toEqual([
        'Ahora',
        'Otro día',
      ])
      expect(p.w.get('.barra-de-total .total').text()).toBe('S/ 3.50')
      expect(p.w.text()).not.toContain('Cobrar')

      await boton(p.w.get('.barra-de-total'), 'Confirmar venta').trigger('click')
      await esperarDatos(app)
      expect(p.w.get('.pantalla-exito h1').text()).toBe('Venta registrada')
      expect(await stock(app, ids.lejia)).toBe('9')
    })

    it('RN-UX-05: quitar la última línea deja el título del carrito con el foco', async () => {
      simularAncho(1280)
      const { app } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await boton(lineas(p)[0]!, 'Quitar').trigger('click')
      await esperarDatos(app)
      expect(lineas(p)).toHaveLength(0)
      expect(document.activeElement?.textContent).toBe('En esta venta')
    })
  })

  it('RN-OP-12: total = suma de importes de línea, redondeados al céntimo', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await agregarBuscando(p, 'carbon', 'Carbón')
    await agregarBuscando(p, 'detergente', 'Detergente a granel')
    await cambiarCantidad(p, 0, '2')
    await cambiarCantidad(p, 1, '1,25')
    await cambiarCantidad(p, 2, '0.333')
    expect(lineas(p).map((l) => l.get('.valor-importe').text())).toEqual([
      'S/ 7.00',
      'S/ 5.00',
      'S/ 2.63',
    ])
    expect(total(p)).toBe('S/ 14.63')
  })

  it('RN-OP-07: agregar dos veces el mismo producto suma la cantidad en una sola línea', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await detalle(p)
    expect(lineas(p)).toHaveLength(1)
    expect(cantidadDe(p, 0)).toBe('2')
    expect(total(p)).toBe('S/ 7.00')
  })

  it('RN-OP-05 / RN-UX-07: más de lo que hay se marca junto a la cantidad, con qué hacer', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '11')
    expect(lineas(p)[0]!.get('.campo-numero .error').text()).toBe(
      'Solo quedan 10 unid. de Lejía 1 L. Cambia la cantidad o registra la llegada de mercadería.',
    )
  })

  it('RN-OP-04: un producto por unidades no acepta decimales (mensaje del dominio junto al campo)', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '1.5')
    expect(lineas(p)[0]!.get('.campo-numero .error').text()).toBe(
      'Este producto se cuenta por unidades enteras',
    )
  })

  it('RN-OP-11: el precio especial vale solo para esta venta y debe ser mayor que S/ 0.00', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '2')
    const linea = () => lineas(p)[0]!

    await linea().get('.precio-tocable').trigger('click')
    await linea().get('.edicion-precio input').setValue('0.00')
    await boton(linea(), 'Guardar precio').trigger('click')
    await esperarDatos(app)
    expect(linea().get('.edicion-precio .error').text()).toBe(
      'El precio de venta debe ser mayor que S/ 0.00',
    )

    await linea().get('.edicion-precio input').setValue('3,00')
    await boton(linea(), 'Guardar precio').trigger('click')
    await esperarDatos(app)
    expect(linea().find('.edicion-precio').exists()).toBe(false)
    expect(linea().text()).toContain('Precio especial')
    expect(total(p)).toBe('S/ 6.00')

    await confirmarVenta(p)
    const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
    expect(venta?.total?.centimos).toBe(600)
    expect((await app.catalogo.obtenerProducto(ids.lejia))?.precioVenta.centimos).toBe(350)
  })

  it('RN-OP-11: "¿Vendiste alguno a otro precio?" separa esas unidades y no deja pasar de las que hay', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    // Con una sola unidad no hay nada que separar (para eso está el precio de la línea).
    expect(lineas(p)[0]!.find('.otro-precio').exists()).toBe(false)
    await cambiarCantidad(p, 0, '2')
    const linea = () => lineas(p)[0]!

    await boton(linea(), '¿Vendiste alguno a otro precio?').trigger('click')
    const [cuantos, precio] = linea().findAll('.separar input')
    expect(linea().get('.separar').text()).toContain('¿Cuántos? (de 2)')
    expect((cuantos!.element as HTMLInputElement).value).toBe('1')
    // "+" se detiene en 2, y escribir más se marca al momento sin dejar guardar.
    const mas = linea()
      .findAll('.separar .campo-numero')[0]!
      .get('button[aria-label="Agregar uno"]')
    await mas.trigger('click')
    expect((cuantos!.element as HTMLInputElement).value).toBe('2')
    expect(mas.attributes('disabled')).toBeDefined()
    await cuantos!.setValue('5')
    expect(linea().get('.separar .error').text()).toBe('Son 2 en total: escribe de 1 a 2')
    expect(boton(linea(), 'Guardar').attributes('disabled')).toBeDefined()

    await cuantos!.setValue('1')
    await precio!.setValue('3.00')
    await boton(linea(), 'Guardar').trigger('click')
    await esperarDatos(app)

    expect(lineas(p)).toHaveLength(2)
    expect(cantidadDe(p, 0)).toBe('1')
    expect(cantidadDe(p, 1)).toBe('1')
    expect(lineas(p)[1]!.text()).toContain('Precio especial')
    expect(lineas(p)[1]!.text()).toContain('Quedan 8 unid.')
    expect(total(p)).toBe('S/ 6.50')

    await confirmarVenta(p)
    const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
    expect(venta?.total?.centimos).toBe(650)
    expect(await stock(app, ids.lejia)).toBe('8')
  })

  it('RN-OP-10 / RN-UX-11 / RN-OP-18: confirmar registra la venta, muestra el éxito y ofrece Deshacer; "Nueva venta" vuelve vacío', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '2')
    await confirmarVenta(p)

    expect(await stock(app, ids.lejia)).toBe('8')
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Venta registrada')
    expect(leer(p.w.get('.pantalla-exito .detalle'))).toBe('Total S/ 7.00')
    expect(leer(p.w.get('.aviso-deshacer'))).toContain('Venta registrada')

    await boton(p.w, 'Nueva venta').trigger('click')
    await esperarDatos(app)
    expect(p.w.get('h1').text()).toBe('Vender')
    expect(lineas(p)).toHaveLength(0)
    expect(p.w.find('.panel-de-venta').exists()).toBe(false)
  })

  it('RN-OP-18: Deshacer anula la venta y deja el carrito como estaba para corregirlo', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '2')
    await confirmarVenta(p)

    await p.w.get('.aviso-deshacer .deshacer').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, ids.lejia)).toBe('10')
    const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
    expect(venta?.anulada).toBe(true)
    expect(p.w.get('h1').text()).toBe('Vender')
    expect(leer(p.w.get('.resultado-de-deshacer'))).toContain(
      'Deshiciste la venta de S/ 7.00. Tus productos volvieron al carrito.',
    )
    await detalle(p)
    expect(lineas(p)).toHaveLength(1)
    expect(cantidadDe(p, 0)).toBe('2')
  })

  it('r1 #2 (RN-UX-11): Deshacer con otra venta en curso no la toca y dice qué se deshizo', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '2')
    await confirmarVenta(p)
    await boton(p.w, 'Nueva venta').trigger('click')
    await esperarDatos(app)
    await agregarBuscando(p, 'carbon', 'Carbón')

    await p.w.get('.aviso-deshacer .deshacer').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, ids.lejia)).toBe('10')
    await detalle(p)
    expect(lineas(p).map((l) => l.get('.nombre').text())).toEqual(['Carbón'])
    expect(leer(p.w.get('.resultado-de-deshacer'))).toContain(
      'Deshiciste la venta de S/ 7.00. Lo que estás cargando sigue aquí.',
    )
  })

  it('r1 #2 (RN-UX-11): Deshacer después de irse a otra pantalla también se ve, y el carrito espera en Vender', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '2')
    await confirmarVenta(p)
    await p.ir('/historial')

    await p.w.get('.aviso-deshacer .deshacer').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, ids.lejia)).toBe('10')
    expect(leer(p.w.get('.resultado-de-deshacer'))).toContain(
      'Deshiciste la venta de S/ 7.00. Tus productos volvieron al carrito.',
    )
    await p.ir('/vender')
    await detalle(p)
    expect(lineas(p)).toHaveLength(1)
    expect(cantidadDe(p, 0)).toBe('2')
  })

  it('r1 M9 (principio 2): el carrito no se pierde al tocar otra pantalla de la navegación', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '3')
    await p.ir('/recibir')
    await p.ir('/vender')
    await detalle(p)
    expect(lineas(p)).toHaveLength(1)
    expect(cantidadDe(p, 0)).toBe('3')
  })

  it('r2 #2: al elegir un resultado, el foco va a su línea del carrito (no al buscador: el teclado no tapa el carrito)', async () => {
    simularAncho(1280)
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    const linea = p.w.get(`.lista-del-carrito [data-producto="${ids.lejia}"]`)
    expect(document.activeElement).toBe(linea.element)
    expect(linea.attributes('tabindex')).toBe('-1')
  })

  it('r2 #2: en celular, al elegir un resultado el foco no salta al buscador (el teclado no tapa el panel)', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    expect(document.activeElement?.closest('.buscador-grande')).toBeNull()
  })

  describe('r2 #1: el carrito guardado se pone al día al volver a Vender', () => {
    it('stock: un "Solo quedan" viejo no bloquea Confirmar venta después de una llegada', async () => {
      const app = crearAplicacionDePrueba({ ahora: HOY })
      const lejia = await crearProductoDePrueba(app, {
        nombre: 'Lejía 1 L',
        compra: '2.40',
        venta: '3.50',
        minimo: '3',
        stockInicial: '2',
      })
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await cambiarCantidad(p, 0, '5')
      expect(lineas(p)[0]!.find('.campo-numero .error').exists()).toBe(true)
      await p.ir('/recibir')
      await app.inventario.registrarIngreso({
        lineas: [{ productoId: lejia, cantidad: '10', costo: '2.40' }],
        confirmarSobrecompra: true,
      })
      await p.ir('/vender')
      await detalle(p)
      expect(lineas(p)[0]!.find('.campo-numero .error').exists()).toBe(false)
      await confirmarVenta(p)
      expect(p.w.get('.pantalla-exito h1').text()).toBe('Venta registrada')
      expect(await stock(app, lejia)).toBe('7')
    })

    it('precio: una línea sin precio especial toma el precio actual y se confirma lo que se ve', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await p.ir('/historial')
      await app.catalogo.editarProducto({ productoId: ids.lejia, precioVenta: '5.00' })
      await p.ir('/vender')
      await detalle(p)
      expect(leer(lineas(p)[0]!.get('.precio-unitario'))).toBe('S/ 5.00 c/u')
      expect(total(p)).toBe('S/ 5.00')
      await confirmarVenta(p)
      const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
      expect(venta?.total?.centimos).toBe(500)
    })

    it('precio especial: se queda como estaba aunque cambie el precio del producto', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await detalle(p)
      await lineas(p)[0]!.get('.precio-tocable').trigger('click')
      await lineas(p)[0]!.get('.edicion-precio input').setValue('3.00')
      await boton(lineas(p)[0]!, 'Guardar precio').trigger('click')
      await esperarDatos(app)
      await p.ir('/historial')
      await app.catalogo.editarProducto({ productoId: ids.lejia, precioVenta: '5.00' })
      await p.ir('/vender')
      await detalle(p)
      expect(lineas(p)[0]!.text()).toContain('Precio especial')
      expect(total(p)).toBe('S/ 3.00')
      await confirmarVenta(p)
      const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
      expect(venta?.total?.centimos).toBe(300)
    })

    it('un producto archivado sale del carrito con un aviso que lo dice', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await agregarBuscando(p, 'carbon', 'Carbón')
      await p.ir('/historial')
      await app.catalogo.archivarProducto({ productoId: ids.carbon, confirmado: true })
      await p.ir('/vender')
      await detalle(p)
      expect(lineas(p).map((l) => l.get('.nombre').text())).toEqual(['Lejía 1 L'])
      expect(leer(p.w.get('.aviso-en-pagina'))).toContain('Quitamos Carbón: ya no está a la venta')
    })

    it('plan 17 (RN-UX-15): al cerrar el aviso de lo quitado, el foco va al título', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await agregarBuscando(p, 'carbon', 'Carbón')
      await p.ir('/historial')
      await app.catalogo.archivarProducto({ productoId: ids.carbon, confirmado: true })
      await p.ir('/vender')
      const cerrar = boton(p.w.get('.aviso-en-pagina'), 'Cerrar')
      ;(cerrar.element as HTMLElement).focus()
      await cerrar.trigger('click')
      await esperarDatos(app)
      expect(p.w.find('.aviso-en-pagina').exists()).toBe(false)
      expect(document.activeElement).toBe(p.w.get('#contenido h1').element)
    })

    it('lo que se confirma es lo que se vio, aunque el precio del producto cambie con la pantalla abierta', async () => {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await cambiarCantidad(p, 0, '2')
      await app.catalogo.editarProducto({ productoId: ids.lejia, precioVenta: '5.00' })
      expect(total(p)).toBe('S/ 7.00')
      await confirmarVenta(p)
      const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
      expect(venta?.total?.centimos).toBe(700)
    })
  })

  it('r2 #3: al cerrarse el resultado del Deshacer con el foco en su "Cerrar", el foco va al título', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await confirmarVenta(p)
    await p.w.get('.aviso-deshacer .deshacer').trigger('click')
    await esperarDatos(app)
    const cerrar = p.w.get('.resultado-de-deshacer .cerrar')
    ;(cerrar.element as HTMLElement).focus()
    await cerrar.trigger('click')
    await esperarDatos(app)
    expect(document.activeElement).toBe(p.w.get('#contenido h1').element)
  })

  it('r2 #3: y también cuando se cierra solo a los 6 s', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await confirmarVenta(p)
    // Como con el dedo o el teclado: el botón Deshacer tiene el foco cuando se toca.
    const deshacer = p.w.get('.aviso-deshacer .deshacer')
    ;(deshacer.element as HTMLElement).focus()
    await deshacer.trigger('click')
    await esperarDatos(app)
    expect(document.activeElement).toBe(p.w.get('.resultado-de-deshacer .cerrar').element)
    await new Promise((resolver) => setTimeout(resolver, 6300))
    await esperarDatos(app)
    expect(p.w.find('.resultado-de-deshacer').exists()).toBe(false)
    expect(document.activeElement).toBe(p.w.get('#contenido h1').element)
  }, 12_000)

  it('RN-OP-05 / RN-UX-07: si al confirmar ya no alcanza el stock, el error del dominio se ve tal cual con su ayuda', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '9')
    // Mientras tanto se vendió en otro lado: quedan 2.
    await app.inventario.registrarVenta({ lineas: [{ productoId: ids.lejia, cantidad: '8' }] })
    await confirmarVenta(p)

    const error = p.w.get('.mensaje-de-error')
    expect(error.get('.mensaje').text()).toBe('Solo quedan 2 unid. de Lejía 1 L')
    expect(error.get('.ayuda').text()).toBe(
      'Cambia la cantidad o registra la llegada de mercadería.',
    )
    expect(await stock(app, ids.lejia)).toBe('2')
    // El panel sigue ahí, abierto, con la línea marcada.
    expect(panel(p).get('.alternar').attributes('aria-expanded')).toBe('true')
  })

  describe('RN-OP-09 / HU-OP-07: anotar una venta de otro día (hasta 7 días atrás)', () => {
    async function ventaDeLejia() {
      const { app, ids } = await tiendaDePrueba()
      const p = await abrirVender(app)
      await agregarBuscando(p, 'lejia', 'Lejía 1 L')
      await detalle(p)
      return { app, ids, p }
    }

    it('por defecto la venta es de ahora; con "Otro día" se elige la fecha y la hora', async () => {
      const { app, p } = await ventaDeLejia()
      const grupo = p.w.get('[role="radiogroup"]')
      expect(grupo.findAll('[role="radio"]').map((r) => r.text())).toEqual(['Ahora', 'Otro día'])
      expect(p.w.find('input[type="date"]').exists()).toBe(false)

      await boton(p.w, 'Otro día').trigger('click')
      await p.w.get('input[type="date"]').setValue('2026-10-14')
      await p.w.get('input[type="time"]').setValue('18:30')
      await confirmarVenta(p)
      const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
      expect(venta?.ocurridaEn).toBe(instanteLocal('2026-10-14 18:30'))
      expect(p.w.get('.pantalla-exito h1').text()).toBe('Venta registrada')
    })

    it('sin hora pide "Elige la fecha y la hora" debajo de la hora y no registra', async () => {
      const { app, p } = await ventaDeLejia()
      await boton(p.w, 'Otro día').trigger('click')
      await p.w.get('input[type="date"]').setValue('2026-10-14')
      await confirmarVenta(p)
      const campoHora = p.w
        .findAll('.campo-texto')
        .find((c) => c.find('input[type="time"]').exists())
      expect(campoHora?.get('.error').text()).toBe('Elige la fecha y la hora')
      expect(await app.inventario.historial({ tipo: 'VENTA' })).toEqual([])
    })

    it('si se eligió Otro día sin hora y se confirma desde el compacto, se abre el detalle para completarla', async () => {
      const { app, p } = await ventaDeLejia()
      await boton(p.w, 'Otro día').trigger('click')
      await boton(panel(p), 'Ocultar').trigger('click')
      await esperarDatos(app)
      await confirmarVenta(p)
      expect(panel(p).get('.alternar').attributes('aria-expanded')).toBe('true')
      expect(p.w.text()).toContain('Elige la fecha y la hora')
      // El foco va al campo que falta (no se queda en Confirmar venta, lejos del error).
      expect(document.activeElement).toBe(p.w.get('input[type="time"]').element)
      expect(await app.inventario.historial({ tipo: 'VENTA' })).toEqual([])
    })

    it('r1 M6: el día solo deja elegir de hace 7 días a hoy (hora de la tienda)', async () => {
      const { p } = await ventaDeLejia()
      await boton(p.w, 'Otro día').trigger('click')
      const dia = p.w.get('input[type="date"]')
      expect(dia.attributes('min')).toBe('2026-10-08')
      expect(dia.attributes('max')).toBe('2026-10-15')
    })

    it('r1 M3: Deshacer una venta de otro día devuelve el carrito con su fecha y su hora', async () => {
      const { app, p } = await ventaDeLejia()
      await boton(p.w, 'Otro día').trigger('click')
      await p.w.get('input[type="date"]').setValue('2026-10-14')
      await p.w.get('input[type="time"]').setValue('18:30')
      await confirmarVenta(p)
      await p.w.get('.aviso-deshacer .deshacer').trigger('click')
      await esperarDatos(app)
      await detalle(p)
      expect(p.w.get('[role="radio"][aria-checked="true"]').text()).toBe('Otro día')
      expect((p.w.get('input[type="date"]').element as HTMLInputElement).value).toBe('2026-10-14')
      expect((p.w.get('input[type="time"]').element as HTMLInputElement).value).toBe('18:30')
    })

    it('más de 7 días atrás se rechaza con el mensaje del dominio', async () => {
      const { app, p } = await ventaDeLejia()
      await boton(p.w, 'Otro día').trigger('click')
      await p.w.get('input[type="date"]').setValue('2026-10-07')
      await p.w.get('input[type="time"]').setValue('23:59')
      await confirmarVenta(p)
      expect(p.w.text()).toContain('Solo puedes anotar hasta 7 días atrás')
      expect(await app.inventario.historial({ tipo: 'VENTA' })).toEqual([])
    })
  })

  it('RN-UX-10: sin productos todavía, explica y ofrece agregar el primero', async () => {
    const p = await abrirVender(crearAplicacionDePrueba({ ahora: HOY }))
    expect(p.w.text()).toContain('Aún no tienes productos.')
    expect(boton(p.w, 'Agregar el primero').exists()).toBe(true)
  })
})

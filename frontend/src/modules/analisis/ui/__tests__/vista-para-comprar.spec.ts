import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatearNumero } from '@/shared/domain/formato'
import { ESPERA_ANUNCIO_MS } from '@/shared/ui/anunciador'
import VistaParaComprar from '../VistaParaComprar.vue'
import { esperarCarga, montarVista } from '../__pruebas__/montar-vista'
import { textoLeido as texto } from '../__pruebas__/texto-leido'
import { TiendaDePrueba } from '../__pruebas__/tienda-de-prueba'

const BOLSAS = { nombre: 'Bolsas', compra: '0.05', venta: '0.10', minimo: '0' }
const CARBON = {
  nombre: 'Carbón',
  unidad: 'KILO' as const,
  compra: '2.75',
  venta: '4.00',
  minimo: '2',
}
const JABON = { nombre: 'Jabón', compra: '1.20', venta: '2.00', minimo: '3' }

/** Bolsas agotadas (1 unid.), Carbón con 1 kg de 2 (3 kg) y Jabón con 2 de 3 (4 unid.). */
async function tiendaConLista(): Promise<TiendaDePrueba> {
  const tienda = new TiendaDePrueba()
  await tienda.app.tienda.actualizarConfiguracion({ nombreTienda: 'Bodega Rosita' })
  await tienda.producto(BOLSAS)
  await tienda.producto({ ...CARBON, stockInicial: '1' })
  await tienda.producto({ ...JABON, stockInicial: '2' })
  return tienda
}

let montada: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  montada?.unmount()
  montada = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function abrir(tienda: TiendaDePrueba) {
  const montaje = await montarVista(VistaParaComprar, {
    aplicacion: tienda.app,
    ruta: '/control/para-comprar',
  })
  montada = montaje.envoltura
  return montaje
}

function lineas(w: VueWrapper): DOMWrapper<Element>[] {
  return w.findAll('.fila-de-carrito')
}

function linea(w: VueWrapper, nombre: string): DOMWrapper<Element> {
  const encontrada = lineas(w).find((l) => texto(l.get('.nombre')) === nombre)
  if (!encontrada) throw new Error(`No está la línea de "${nombre}"`)
  return encontrada
}

function boton(w: Pick<VueWrapper, 'findAll'>, nombre: string): DOMWrapper<Element> {
  const encontrado = w.findAll('button').find((b) => texto(b) === nombre)
  if (!encontrado) throw new Error(`No está el botón "${nombre}"`)
  return encontrado
}

async function escribirCantidad(w: VueWrapper, nombre: string, cantidad: string) {
  await linea(w, nombre).get('input').setValue(cantidad)
}

/** Los guardados de cantidades quedan esperando hasta `soltar()` (un guardado "en vuelo"). */
function demorarGuardados(tienda: TiendaDePrueba): { soltar: () => void } {
  const original = tienda.app.analisis.cambiarCantidadEnLista
  let soltar = (): void => undefined
  const espera = new Promise<void>((resolver) => {
    soltar = resolver
  })
  vi.spyOn(tienda.app.analisis, 'cambiarCantidadEnLista').mockImplementation(
    async (productoId, texto) => {
      await espera
      return original(productoId, texto)
    },
  )
  return { soltar: () => soltar() }
}

/** Lo que quedó guardado en la lista de hoy (la cantidad de cada línea). */
async function listaGuardada(tienda: TiendaDePrueba) {
  const lista = await tienda.app.analisis.listaParaComprar()
  return lista.lineas.map((l) => [l.nombre, formatearNumero(l.cantidad)])
}

describe('Para comprar', () => {
  it('RN-AN-07 / RN-AN-08: cada línea con su cantidad sugerida, su costo y el total estimado', async () => {
    const { envoltura } = await abrir(await tiendaConLista())
    expect(texto(envoltura.get('h1'))).toBe('Para comprar')
    expect(
      lineas(envoltura).map((l) => [
        texto(l.get('.nombre')),
        (l.get('input').element as HTMLInputElement).value,
        texto(l.get('.precio')),
        texto(l.get('.importe')),
      ]),
    ).toEqual([
      ['Bolsas', '1', 'Costo S/ 0.05 c/u', 'Costo estimado S/ 0.05'],
      ['Carbón', '3', 'Costo S/ 2.75 el kg', 'Costo estimado S/ 8.25'],
      ['Jabón', '4', 'Costo S/ 1.20 c/u', 'Costo estimado S/ 4.80'],
    ])
    expect(texto(envoltura.get('.barra-de-total .resumen'))).toBe('Total estimado S/ 13.10')
  })

  it('RN-AN-08: cambiar una cantidad recalcula el costo y el total, y se recuerda', async () => {
    const tienda = await tiendaConLista()
    const { envoltura } = await abrir(tienda)
    await escribirCantidad(envoltura, 'Jabón', '10')
    await vi.advanceTimersByTimeAsync(500)
    await esperarCarga()
    expect(texto(linea(envoltura, 'Jabón').get('.importe'))).toBe('Costo estimado S/ 12.00')
    expect(texto(envoltura.get('.barra-de-total .resumen'))).toBe('Total estimado S/ 20.30')
    expect(await listaGuardada(tienda)).toEqual([
      ['Bolsas', '1'],
      ['Carbón', '3'],
      ['Jabón', '10'],
    ])

    // Al volver a la pantalla sigue con 10.
    envoltura.unmount()
    const otra = await abrir(tienda)
    expect((linea(otra.envoltura, 'Jabón').get('input').element as HTMLInputElement).value).toBe(
      '10',
    )
  })

  it('RN-UX-07: una cantidad que no vale se explica junto al campo y no se guarda', async () => {
    const tienda = await tiendaConLista()
    const { envoltura } = await abrir(tienda)
    await escribirCantidad(envoltura, 'Carbón', '0')
    await vi.advanceTimersByTimeAsync(500)
    await esperarCarga()
    expect(texto(linea(envoltura, 'Carbón').get('[role="alert"]'))).toBe(
      'La cantidad debe ser mayor que 0. Escribe cuánto vas a comprar o toca Quitar.',
    )
    expect(await listaGuardada(tienda)).toContainEqual(['Carbón', '3'])

    await escribirCantidad(envoltura, 'Carbón', '1.5')
    await vi.advanceTimersByTimeAsync(500)
    await esperarCarga()
    expect(linea(envoltura, 'Carbón').find('[role="alert"]').exists()).toBe(false)
    expect(await listaGuardada(tienda)).toContainEqual(['Carbón', '1.5'])
  })

  it('borrar el número para escribir otro no es un error: no se guarda nada hasta que haya uno', async () => {
    const tienda = await tiendaConLista()
    const { envoltura } = await abrir(tienda)
    await escribirCantidad(envoltura, 'Jabón', '')
    await vi.advanceTimersByTimeAsync(500)
    await esperarCarga()
    expect(linea(envoltura, 'Jabón').find('[role="alert"]').exists()).toBe(false)
    expect(await listaGuardada(tienda)).toContainEqual(['Jabón', '4'])
    await escribirCantidad(envoltura, 'Jabón', '8')
    await vi.advanceTimersByTimeAsync(500)
    await esperarCarga()
    expect(await listaGuardada(tienda)).toContainEqual(['Jabón', '8'])
  })

  it('RN-UX-07: si el producto ya no está (archivado), lo dice con el mensaje del dominio', async () => {
    const tienda = await tiendaConLista()
    const { envoltura } = await abrir(tienda)
    await tienda.app.catalogo.archivarProducto({ productoId: tienda.id('Jabón'), confirmado: true })
    await escribirCantidad(envoltura, 'Jabón', '6')
    await vi.advanceTimersByTimeAsync(500)
    await esperarCarga()
    expect(texto(envoltura.get('.mensaje-de-error'))).toBe(
      'No encontramos ese producto Vuelve a abrir la lista: ya no está en tus productos.',
    )
  })

  it('RN-AN-08 / RN-OP-18: quitar saca la línea y ofrece Deshacer, que la devuelve con su cantidad', async () => {
    const tienda = await tiendaConLista()
    const { envoltura, aviso } = await abrir(tienda)
    // Recién escrita (todavía sin guardar): Quitar la guarda antes, y Deshacer la devuelve.
    await escribirCantidad(envoltura, 'Jabón', '7')

    await boton(linea(envoltura, 'Jabón'), 'Quitar').trigger('click')
    await esperarCarga()
    expect(lineas(envoltura).map((l) => texto(l.get('.nombre')))).toEqual(['Bolsas', 'Carbón'])
    expect(texto(envoltura.get('.barra-de-total .resumen'))).toBe('Total estimado S/ 8.30')
    expect(aviso.activo.value?.mensaje).toBe('Quitaste Jabón de la lista')

    aviso.activo.value?.alDeshacer()
    await esperarCarga()
    expect(await listaGuardada(tienda)).toContainEqual(['Jabón', '7'])
    expect(lineas(envoltura).map((l) => texto(l.get('.nombre')))).toEqual([
      'Bolsas',
      'Carbón',
      'Jabón',
    ])
  })

  // Ronda 1: Deshacer no deja la línea "fijada" con la cantidad sugerida como si la hubiera
  // escrito el usuario: vuelve a seguir la sugerencia.
  it('RN-OP-18: deshacer quitar una línea sin cambios la deja siguiendo la sugerencia', async () => {
    const tienda = await tiendaConLista()
    const { envoltura, aviso } = await abrir(tienda)
    await boton(linea(envoltura, 'Jabón'), 'Quitar').trigger('click')
    await esperarCarga()
    aviso.activo.value?.alDeshacer()
    await esperarCarga()
    expect(await listaGuardada(tienda)).toContainEqual(['Jabón', '4'])
    // Llega 1 Jabón (quedan 3 de 3): la sugerencia baja a 3 y la línea la sigue.
    await tienda.recibir('Jabón', '1', '1.20')
    expect(await listaGuardada(tienda)).toContainEqual(['Jabón', '3'])
  })

  describe('Compartir', () => {
    const TEXTO = [
      'Lista de compras – Bodega Rosita – 15/10/2026',
      '• Bolsas: 1 unid.',
      '• Carbón: 3 kg',
      '• Jabón: 9 unid.',
      'Total estimado: S/ 19.10',
    ].join('\n')

    it('RN-AN-08: con Web Share API comparte el texto exacto, con el cambio recién escrito', async () => {
      const share = vi.fn(() => Promise.resolve())
      vi.stubGlobal('navigator', { share })
      const { envoltura } = await abrir(await tiendaConLista())
      // Sin esperar a que se guarde solo: Compartir guarda antes lo que está escrito.
      await escribirCantidad(envoltura, 'Jabón', '9')
      await boton(envoltura, 'Compartir').trigger('click')
      await esperarCarga()
      expect(share).toHaveBeenCalledWith({ text: TEXTO })
      expect(envoltura.find('.aviso-en-pagina').exists()).toBe(false)
    })

    it('sin Web Share API copia la lista y avisa que ya se puede pegar', async () => {
      const writeText = vi.fn(() => Promise.resolve())
      vi.stubGlobal('navigator', { clipboard: { writeText } })
      const { envoltura, anunciador } = await abrir(await tiendaConLista())
      await escribirCantidad(envoltura, 'Jabón', '9')
      await boton(envoltura, 'Compartir').trigger('click')
      await esperarCarga()
      expect(writeText).toHaveBeenCalledWith(TEXTO)
      const copiada = envoltura.get('.aviso-en-pagina')
      expect(texto(copiada)).toBe('Copiamos la lista Pégala en WhatsApp o en otra app. Cerrar')
      await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
      expect(anunciador.texto.value).toBe('Copiamos la lista. Pégala en WhatsApp o en otra app.')
      await boton(copiada, 'Cerrar').trigger('click')
      expect(envoltura.find('.aviso-en-pagina').exists()).toBe(false)
    })

    it('si no se puede compartir ni copiar, muestra el texto para copiarlo a mano', async () => {
      vi.stubGlobal('navigator', {})
      const { envoltura } = await abrir(await tiendaConLista())
      await escribirCantidad(envoltura, 'Jabón', '9')
      await boton(envoltura, 'Compartir').trigger('click')
      await esperarCarga()
      expect(texto(envoltura.get('.mensaje-de-error'))).toBe(
        'No pudimos compartir la lista Copia este texto y pégalo en WhatsApp.',
      )
      expect((envoltura.get('textarea').element as HTMLTextAreaElement).value).toBe(TEXTO)
    })
  })

  it('RN-AN-08: "Registrar llegada" guarda lo escrito y abre Recibir prellenado desde la lista', async () => {
    const tienda = await tiendaConLista()
    const { envoltura, router } = await abrir(tienda)
    await escribirCantidad(envoltura, 'Jabón', '9')
    await boton(envoltura, 'Registrar llegada').trigger('click')
    await esperarCarga()
    expect(router.currentRoute.value.name).toBe('recibir')
    expect(router.currentRoute.value.query).toEqual({ desde: 'para-comprar' })
    // Recibir lee la lista de hoy de Análisis: ya tiene el cambio.
    const llegada = await tienda.app.analisis.lineasParaRegistrarLlegada()
    expect(llegada.map((l) => formatearNumero(l.cantidad))).toEqual(['1', '3', '9'])
  })

  describe('ronda 1', () => {
    it('RN-UX-07: con una cantidad que no vale no se comparte ni se registra la llegada: lleva a corregirla', async () => {
      const share = vi.fn(() => Promise.resolve())
      vi.stubGlobal('navigator', { share })
      const { envoltura, router } = await abrir(await tiendaConLista())
      await escribirCantidad(envoltura, 'Carbón', '0')
      const campo = linea(envoltura, 'Carbón').get('input').element

      await boton(envoltura, 'Compartir').trigger('click')
      await esperarCarga()
      expect(share).not.toHaveBeenCalled()
      expect(texto(envoltura.get('.bloqueo'))).toBe(
        'Revisa la cantidad de Carbón Corrígela o toca Quitar antes de compartir la lista.',
      )
      // role="alert": se anuncia al aparecer.
      expect(envoltura.get('.bloqueo').attributes('role')).toBe('alert')
      expect(document.activeElement).toBe(campo)

      await boton(envoltura, 'Registrar llegada').trigger('click')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('para-comprar')
      expect(texto(envoltura.get('.bloqueo'))).toBe(
        'Revisa la cantidad de Carbón Corrígela o toca Quitar antes de registrar la llegada.',
      )

      await escribirCantidad(envoltura, 'Carbón', '2')
      expect(envoltura.find('.bloqueo').exists()).toBe(false)
      await boton(envoltura, 'Compartir').trigger('click')
      await esperarCarga()
      expect(share).toHaveBeenCalledTimes(1)
    })

    it('RN-AN-08: Compartir espera al guardado que ya estaba en camino', async () => {
      const share = vi.fn(() => Promise.resolve())
      vi.stubGlobal('navigator', { share })
      const tienda = await tiendaConLista()
      const { envoltura } = await abrir(tienda)
      const { soltar } = demorarGuardados(tienda)
      await escribirCantidad(envoltura, 'Jabón', '9')
      await vi.advanceTimersByTimeAsync(500) // el guardado arrancó y quedó esperando
      await boton(envoltura, 'Compartir').trigger('click')
      await esperarCarga()
      expect(share).not.toHaveBeenCalled()
      soltar()
      await esperarCarga()
      expect(share).toHaveBeenCalledTimes(1)
      expect(share.mock.calls[0]).toEqual([
        expect.objectContaining({ text: expect.stringContaining('• Jabón: 9 unid.') }),
      ])
    })

    it('RN-AN-08: al salir de la pantalla, la salida espera a que se guarde lo escrito', async () => {
      const tienda = await tiendaConLista()
      const { envoltura, router } = await abrir(tienda)
      const { soltar } = demorarGuardados(tienda)
      await escribirCantidad(envoltura, 'Jabón', '9')
      const salida = router.push('/control')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('para-comprar')
      soltar()
      await salida
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('control')
      expect(await listaGuardada(tienda)).toContainEqual(['Jabón', '9'])
    })

    it('RN-UX-15: al quitar la última línea, el foco va al título de la pantalla', async () => {
      const tienda = new TiendaDePrueba()
      await tienda.producto(BOLSAS)
      const { envoltura } = await abrir(tienda)
      await boton(linea(envoltura, 'Bolsas'), 'Quitar').trigger('click')
      await esperarCarga()
      expect(envoltura.find('.estado-vacio').exists()).toBe(true)
      expect(document.activeElement).toBe(envoltura.get('h1').element)
    })
  })

  it('RN-UX-10: sin nada que comprar lo dice y ofrece "¿Necesito comprar?"', async () => {
    const tienda = new TiendaDePrueba()
    await tienda.producto({ ...JABON, stockInicial: '20' })
    const { envoltura, router } = await abrir(tienda)
    expect(texto(envoltura.get('.estado-vacio'))).toBe(
      'No hace falta comprar nada por ahora Cuando algo se esté acabando, aparecerá aquí. ¿Necesito comprar?',
    )
    expect(envoltura.find('.barra-de-total').exists()).toBe(false)
    await boton(envoltura, '¿Necesito comprar?').trigger('click')
    await esperarCarga()
    expect(router.currentRoute.value.name).toBe('necesito-comprar')
  })
})

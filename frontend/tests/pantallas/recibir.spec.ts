import { afterEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { formatearNumero } from '@/shared/domain/formato'
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

let pantalla: PantallaMontada | undefined
afterEach(() => {
  desmontar(pantalla)
  pantalla = undefined
})

async function conLejia(): Promise<{ app: AplicacionDePrueba; lejia: string }> {
  const app = crearAplicacionDePrueba({ ahora: HOY })
  const lejia = await crearProductoDePrueba(app, {
    nombre: 'Lejía 1 L',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
    stockInicial: '10',
  })
  return { app, lejia }
}

const stock = async (app: AplicacionDePrueba, id: string) =>
  formatearNumero(await app.inventario.consultable.stockDe(id))
const lineas = (p: PantallaMontada) => p.w.findAll('.fila-de-carrito')
const dialogoAbierto = (p: PantallaMontada) => p.w.find('dialog[open]')

async function abrir(app: AplicacionDePrueba, ruta = '/recibir') {
  pantalla = await montarPantalla(ruta, { app })
  return pantalla
}

/** Abre el detalle del panel (líneas y ¿Cuándo llegó?), si no estaba abierto. */
async function detalle(p: PantallaMontada) {
  if (p.w.find('.panel-de-venta .alternar[aria-expanded="false"]').exists()) {
    await boton(p.w.get('.panel-de-venta'), 'Ver detalle').trigger('click')
    await esperarDatos(p.app)
  }
}

async function agregar(p: PantallaMontada, texto: string, nombre: string) {
  await buscar(p, texto)
  const tarjeta = p.w
    .findAll('.lista-de-productos .tarjeta-de-producto')
    .find((t) => t.get('.nombre').text() === nombre)
  if (!tarjeta) throw new Error(`No apareció "${nombre}"`)
  await tarjeta.trigger('click')
  await esperarDatos(p.app)
}

async function cantidad(p: PantallaMontada, indice: number, texto: string) {
  await lineas(p)[indice]!.get('.cantidad input').setValue(texto)
  await esperarDatos(p.app)
}

async function registrar(p: PantallaMontada) {
  await boton(p.w, 'Registrar llegada').trigger('click')
  await esperarDatos(p.app)
}

describe('Llegó mercadería (HU-OP-03)', () => {
  it('plan 17 (RN-UX-15): un producto archivado sale del carrito; al cerrar el aviso, el foco va al título', async () => {
    const { app, lejia } = await conLejia()
    await crearProductoDePrueba(app, {
      nombre: 'Carbón',
      unidad: 'KILO',
      compra: '2.75',
      venta: '4.00',
      minimo: '1',
      stockInicial: '0',
    })
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await agregar(p, 'carbon', 'Carbón')
    await p.ir('/historial')
    await app.catalogo.archivarProducto({ productoId: lejia, confirmado: true })
    await p.ir('/recibir')
    await detalle(p)
    expect(lineas(p).map((l) => l.get('.nombre').text())).toEqual(['Carbón'])
    const aviso = p.w.findAll('.aviso-en-pagina').find((a) => leer(a).includes('Quitamos'))
    expect(aviso && leer(aviso)).toContain('Quitamos Lejía 1 L: ya no está a la venta')
    const cerrar = boton(aviso!, 'Cerrar')
    ;(cerrar.element as HTMLElement).focus()
    await cerrar.trigger('click')
    await esperarDatos(app)
    expect(p.w.findAll('.aviso-en-pagina').some((a) => leer(a).includes('Quitamos'))).toBe(false)
    expect(document.activeElement).toBe(p.w.get('#contenido h1').element)
  })

  it('RN-UX-12: la pantalla se titula "Llegó mercadería" y en la navegación se llama "Recibir"', async () => {
    const { app } = await conLejia()
    const p = await abrir(app)
    expect(p.w.get('#contenido h1').text()).toBe('Llegó mercadería')
    expect(p.w.get('nav a[href="/recibir"]').text()).toBe('Recibir')
  })

  it('RN-OP-14: cada línea lleva el costo, prellenado con el precio de compra', async () => {
    const { app } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await cantidad(p, 0, '6')
    expect(lineas(p)[0]!.get('.precio-unitario').text()).toBe('Costo S/ 2.40 c/u')
    expect(lineas(p)[0]!.get('.precio-tocable .solo-lector').text()).toBe(
      'Cambiar costo de Lejía 1 L:',
    )
    expect(p.w.get('.total-del-panel .etiqueta').text()).toContain('Valor total')
    expect(p.w.get('.panel-de-venta .total').text()).toBe('S/ 14.40')
  })

  it('RN-OP-01 / RN-OP-18: registra la llegada, muestra el éxito y ofrece Deshacer, que la anula', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await cantidad(p, 0, '6')
    await registrar(p)
    expect(await stock(app, lejia)).toBe('16')
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Llegada registrada')
    expect(leer(p.w.get('.pantalla-exito .detalle'))).toBe('1 producto · Valor total S/ 14.40')
    expect(leer(p.w.get('.pantalla-exito .deshacer'))).toMatch(/Deshacer\s*\(10\)/)
    expect(p.w.find('.aviso-deshacer').exists()).toBe(false)
    expect(leer(p.w.get('.pantalla-exito .linea'))).toContain('Lejía 1 L')
    expect(leer(p.w.get('.pantalla-exito .linea'))).toContain('6 unid. × S/ 2.40')

    await p.w.get('.pantalla-exito .deshacer').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, lejia)).toBe('10')
  })

  it('RN-OP-14: si el costo cambió pregunta "¿Actualizar el precio de compra a S/ X?" con el margen nuevo; por defecto sí', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await cantidad(p, 0, '12')
    await lineas(p)[0]!.get('.precio-tocable').trigger('click')
    await lineas(p)[0]!.get('.edicion-precio input').setValue('2.60')
    await boton(lineas(p)[0]!, 'Guardar costo').trigger('click')
    await esperarDatos(app)
    expect(lineas(p)[0]!.text()).toContain('Costo nuevo')
    await registrar(p)

    const dialogo = dialogoAbierto(p)
    expect(dialogo.exists()).toBe(true)
    expect(leer(dialogo.get('p'))).toBe(
      '¿Actualizar el precio de compra a S/ 2.60? Ganarás S/ 0.90 por unidad',
    )
    expect(document.activeElement?.textContent?.trim()).toBe('Sí, actualizar')
    await boton(dialogo, 'Sí, actualizar').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, lejia)).toBe('22')
    expect((await app.catalogo.obtenerProducto(lejia))?.precioCompra.centimos).toBe(260)
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Llegada registrada')
  })

  it('RN-OP-14: se puede registrar el costo distinto sin cambiar el precio de compra', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await cantidad(p, 0, '12')
    await lineas(p)[0]!.get('.precio-tocable').trigger('click')
    await lineas(p)[0]!.get('.edicion-precio input').setValue('2,60')
    await boton(lineas(p)[0]!, 'Guardar costo').trigger('click')
    await esperarDatos(app)
    await registrar(p)
    await boton(dialogoAbierto(p), 'No, solo esta vez').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, lejia)).toBe('22')
    expect((await app.catalogo.obtenerProducto(lejia))?.precioCompra.centimos).toBe(240)
  })

  it('r1 M1: cerrar la pregunta del precio (Escape o "atrás" del celular) no registra nada', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await lineas(p)[0]!.get('.precio-tocable').trigger('click')
    await lineas(p)[0]!.get('.edicion-precio input').setValue('2.60')
    await boton(lineas(p)[0]!, 'Guardar costo').trigger('click')
    await esperarDatos(app)
    await registrar(p)
    await dialogoAbierto(p).trigger('cancel')
    await esperarDatos(app)
    expect(dialogoAbierto(p).exists()).toBe(false)
    expect(await stock(app, lejia)).toBe('10')
    expect(lineas(p)[0]!.text()).toContain('Costo nuevo')
  })

  it('r1 M9: lo cargado no se pierde al irse a otra pantalla y volver', async () => {
    const { app } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await cantidad(p, 0, '6')
    await p.ir('/vender')
    await p.ir('/recibir')
    await detalle(p)
    expect((lineas(p)[0]!.get('.cantidad input').element as HTMLInputElement).value).toBe('6')
  })

  it('r2 #1: al volver, lo cargado se pone al día: el costo de siempre toma el precio de compra actual', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await p.ir('/vender')
    await app.catalogo.editarProducto({ productoId: lejia, precioCompra: '2.80' })
    await p.ir('/recibir')
    await detalle(p)
    expect(lineas(p)[0]!.get('.precio-unitario').text()).toBe('Costo S/ 2.80 c/u')
    expect(lineas(p)[0]!.text()).not.toContain('Costo nuevo')
  })

  it('r1 #2: Deshacer la llegada muestra qué se deshizo', async () => {
    const { app } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await cantidad(p, 0, '6')
    await registrar(p)
    await p.w.get('.pantalla-exito .deshacer').trigger('click')
    await esperarDatos(app)
    expect(leer(p.w.get('.resultado-de-deshacer'))).toContain(
      'Deshiciste la llegada de mercadería (valor total S/ 14.40). Los productos volvieron a la lista.',
    )
  })

  it('RN-OP-14: un costo negativo se rechaza junto al campo, con el mensaje del dominio', async () => {
    const { app } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    await lineas(p)[0]!.get('.precio-tocable').trigger('click')
    await lineas(p)[0]!.get('.edicion-precio input').setValue('-1')
    await boton(lineas(p)[0]!, 'Guardar costo').trigger('click')
    await esperarDatos(app)
    expect(lineas(p)[0]!.get('.edicion-precio .error').text()).toBe(
      'El precio de compra no puede ser negativo',
    )
  })

  it('RN-OP-09: la llegada se puede anotar en otro día (dentro de los 7 días)', async () => {
    const { app } = await conLejia()
    const p = await abrir(app)
    await agregar(p, 'lejia', 'Lejía 1 L')
    expect(p.w.text()).toContain('¿Cuándo llegó?')
    await boton(p.w, 'Otro día').trigger('click')
    await p.w.get('input[type="date"]').setValue('2026-10-16')
    await p.w.get('input[type="time"]').setValue('08:00')
    await registrar(p)
    expect(p.w.text()).toContain('La fecha no puede ser futura')

    await p.w.get('input[type="date"]').setValue('2026-10-13')
    await registrar(p)
    const [ingreso] = await app.inventario.historial({ tipo: 'INGRESO' })
    expect(ingreso?.ocurridaEn).toBe(instanteLocal('2026-10-13 08:00'))
  })

  describe('RN-OP-20: aviso de sobrecompra (no bloquea)', () => {
    /** Escoba: stock inicial 5 el 2026-07-17, una venta el 2026-08-31 → parada hace 45 días. */
    async function conEscobaParada() {
      const app = crearAplicacionDePrueba({ ahora: HOY })
      app.reloj.fijar(instanteLocal('2026-07-17 10:00'))
      const escoba = await crearProductoDePrueba(app, {
        nombre: 'Escoba',
        compra: '6.00',
        venta: '9.00',
        minimo: '1',
        stockInicial: '5',
      })
      app.reloj.fijar(instanteLocal('2026-08-31 10:00'))
      await app.inventario.registrarVenta({ lineas: [{ productoId: escoba, cantidad: '1' }] })
      app.reloj.fijar(HOY)
      return { app, escoba }
    }

    it('avisa con el mensaje exacto y ofrece "Registrar igual" / "Cambiar cantidad"', async () => {
      const { app, escoba } = await conEscobaParada()
      const p = await abrir(app)
      await agregar(p, 'escoba', 'Escoba')
      await cantidad(p, 0, '2')
      await registrar(p)
      const dialogo = dialogoAbierto(p)
      expect(dialogo.get('h2').text()).toBe('Esto es más de lo que necesitas')
      const filas = dialogo.findAll('li')
      expect(filas).toHaveLength(1)
      expect(leer(filas[0]!.get('strong'))).toBe('Escoba')
      expect(filas[0]!.findAll('span').map((f) => leer(f))).toEqual([
        'No se vende hace 45 días',
        'Aún tienes 4 unid.',
      ])
      expect(dialogo.findAll('button').map((b) => b.text())).toEqual([
        'Cambiar cantidad',
        'Registrar igual',
      ])

      await boton(dialogo, 'Registrar igual').trigger('click')
      await esperarDatos(app)
      expect(await stock(app, escoba)).toBe('6')
      expect(p.w.get('.pantalla-exito h1').text()).toBe('Llegada registrada')
    })

    it('"Cambiar cantidad" no registra nada: deja el aviso a la vista y el foco en la cantidad', async () => {
      const { app, escoba } = await conEscobaParada()
      const p = await abrir(app)
      await agregar(p, 'escoba', 'Escoba')
      await cantidad(p, 0, '2')
      await registrar(p)
      await boton(dialogoAbierto(p), 'Cambiar cantidad').trigger('click')
      await esperarDatos(app)
      expect(await stock(app, escoba)).toBe('4')
      expect(dialogoAbierto(p).exists()).toBe(false)
      // AvisoEnPagina no deja partir "45 días" ni "4 unid." (espacios duros): se comparan normales.
      expect(
        p.w
          .get('.aviso-en-pagina')
          .text()
          .replace(/\u00a0/g, ' '),
      ).toContain('Escoba no se vende hace 45 días y aún tienes 4 unid.')
      const campo = lineas(p)[0]!.get('.cantidad input').element
      // El foco se mueve recién cuando el diálogo terminó de cerrarse.
      await vi.waitFor(() => expect(document.activeElement).toBe(campo))
    })
  })

  describe('RN-AN-08: abierta desde Para comprar (?desde=para-comprar)', () => {
    it('se prellena con la lista de hoy, con los cambios que hizo la persona, y se puede editar', async () => {
      const app = crearAplicacionDePrueba({ ahora: HOY })
      const lejia = await crearProductoDePrueba(app, {
        nombre: 'Lejía 1 L',
        compra: '2.40',
        venta: '3.50',
        minimo: '3',
        stockInicial: '2',
      })
      await crearProductoDePrueba(app, {
        nombre: 'Carbón',
        unidad: 'KILO',
        compra: '2.75',
        venta: '4.00',
        minimo: '1',
        stockInicial: '10',
      })
      await app.analisis.cambiarCantidadEnLista(lejia, '5')
      const p = await abrir(app, '/recibir?desde=para-comprar')

      expect(p.w.text()).toContain('Cargamos tu lista para comprar de hoy')
      await detalle(p)
      expect(lineas(p)).toHaveLength(1)
      expect(lineas(p)[0]!.get('.nombre').text()).toBe('Lejía 1 L')
      expect((lineas(p)[0]!.get('.cantidad input').element as HTMLInputElement).value).toBe('5')
      expect(lineas(p)[0]!.get('.precio-unitario').text()).toBe('Costo S/ 2.40 c/u')

      await cantidad(p, 0, '6')
      await registrar(p)
      expect(await stock(app, lejia)).toBe('8')
    })

    it('r1 M9: si ya había algo cargado, se agrega lo de la lista sin borrar lo que había', async () => {
      const app = crearAplicacionDePrueba({ ahora: HOY })
      const lejia = await crearProductoDePrueba(app, {
        nombre: 'Lejía 1 L',
        compra: '2.40',
        venta: '3.50',
        minimo: '3',
        stockInicial: '2',
      })
      await crearProductoDePrueba(app, {
        nombre: 'Carbón',
        unidad: 'KILO',
        compra: '2.75',
        venta: '4.00',
        minimo: '1',
        stockInicial: '10',
      })
      void lejia
      const p = await abrir(app)
      await agregar(p, 'carbon', 'Carbón')
      await p.ir('/recibir?desde=para-comprar')
      await detalle(p)
      expect(lineas(p).map((l) => l.get('.nombre').text())).toEqual(['Carbón', 'Lejía 1 L'])
    })

    it('si la lista de hoy está vacía, lo dice y deja buscar', async () => {
      const { app } = await conLejia()
      const p = await abrir(app, '/recibir?desde=para-comprar')
      expect(p.w.text()).toContain('Tu lista para comprar de hoy está vacía')
      expect(lineas(p)).toHaveLength(0)
    })
  })
})

import { afterEach, describe, expect, it } from 'vitest'
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
})

async function abrirVender(app: AplicacionDePrueba) {
  pantalla = await montarPantalla('/vender', { app })
  return pantalla
}

const lineas = (p: PantallaMontada) => p.w.findAll('.fila-de-carrito')
const total = (p: PantallaMontada) => p.w.get('.barra-de-total .total').text()

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
  await lineas(p)[indice]!.get('.cantidad input').setValue(texto)
  await esperarDatos(p.app)
}

describe('Vender (HU-OP-01, HU-OP-02)', () => {
  it('muestra el buscador grande y, sin ventas todavía, ningún acceso rápido ni línea', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    expect(p.w.get('h1').text()).toBe('Vender')
    expect(p.w.get('.buscador-grande label').text()).toBe('Buscar producto')
    expect(p.w.find('.accesos-rapidos').exists()).toBe(false)
    expect(lineas(p)).toHaveLength(0)
    expect(p.w.find('.barra-de-total').exists()).toBe(false)
    expect(p.w.text()).toContain('Toca un producto para agregarlo.')
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
    expect(lineas(p)).toHaveLength(1)
    expect(lineas(p)[0]!.get('.nombre').text()).toBe('Lejía 1 L')
    expect((lineas(p)[0]!.get('.cantidad input').element as HTMLInputElement).value).toBe('1')
    expect(total(p)).toBe('S/ 3.50')
    expect(p.w.get('.barra-de-total').text()).toContain('Cobrar')
  })

  it('RN-CAT-12: el buscador encuentra sin tildes y al elegir se vacía para buscar el siguiente', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    expect(lineas(p)).toHaveLength(1)
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

  it('RN-OP-07: agregar dos veces el mismo producto suma la cantidad en una sola línea', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    expect(lineas(p)).toHaveLength(1)
    expect((lineas(p)[0]!.get('.cantidad input').element as HTMLInputElement).value).toBe('2')
    expect(total(p)).toBe('S/ 7.00')
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

    await boton(linea(), 'Cambiar precio').trigger('click')
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

    await boton(p.w, 'Cobrar').trigger('click')
    await esperarDatos(app)
    await boton(p.w, 'Confirmar venta').trigger('click')
    await esperarDatos(app)
    const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
    expect(venta?.total?.centimos).toBe(600)
    expect((await app.catalogo.obtenerProducto(ids.lejia))?.precioVenta.centimos).toBe(350)
  })

  it('RN-OP-13: Cobrar muestra los billetes y el vuelto; si falta no deja confirmar', async () => {
    const { app } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await agregarBuscando(p, 'carbon', 'Carbón')
    await agregarBuscando(p, 'detergente', 'Detergente a granel')
    await cambiarCantidad(p, 0, '2')
    await cambiarCantidad(p, 1, '1.25')
    await cambiarCantidad(p, 2, '0.333')
    await boton(p.w, 'Cobrar').trigger('click')
    await esperarDatos(app)

    expect(p.w.get('h1').text()).toBe('Cobrar')
    expect(p.w.get('.selector-de-billetes .valor-total').text()).toBe('S/ 14.63')
    const billetes = p.w.findAll('.selector-de-billetes .billete').map((b) => b.text())
    expect(billetes).toEqual(['S/ 10', 'S/ 20', 'S/ 50', 'S/ 100', 'Exacto'])
    const confirmar = () => boton(p.w, 'Confirmar venta')
    const mensaje = () => p.w.get('.selector-de-billetes .mensaje').text()

    await boton(p.w, 'S/ 20').trigger('click')
    expect(mensaje()).toBe('Vuelto S/ 5.37')
    expect(confirmar().attributes('disabled')).toBeUndefined()

    await boton(p.w, 'S/ 10').trigger('click')
    expect(mensaje()).toBe('Faltan S/ 4.63')
    expect(confirmar().attributes('disabled')).toBeDefined()

    await boton(p.w, 'Exacto').trigger('click')
    expect(mensaje()).toBe('Vuelto S/ 0.00')
    expect(confirmar().attributes('disabled')).toBeUndefined()
  })

  it('RN-OP-10 / RN-UX-11 / RN-OP-18: confirmar registra la venta, muestra el éxito y ofrece Deshacer; "Nueva venta" vuelve vacío', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '2')
    await boton(p.w, 'Cobrar').trigger('click')
    await esperarDatos(app)
    await boton(p.w, 'S/ 20').trigger('click')
    await boton(p.w, 'Confirmar venta').trigger('click')
    await esperarDatos(app)

    expect(await stock(app, ids.lejia)).toBe('8')
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Venta registrada')
    expect(leer(p.w.get('.pantalla-exito .detalle'))).toBe('Total S/ 7.00 · Vuelto S/ 13.00')
    expect(leer(p.w.get('.aviso-deshacer'))).toContain('Venta registrada')

    await boton(p.w, 'Nueva venta').trigger('click')
    await esperarDatos(app)
    expect(p.w.get('h1').text()).toBe('Vender')
    expect(lineas(p)).toHaveLength(0)
  })

  it('RN-OP-18: Deshacer anula la venta y deja el carrito como estaba para corregirlo', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '2')
    await boton(p.w, 'Cobrar').trigger('click')
    await esperarDatos(app)
    await boton(p.w, 'Confirmar venta').trigger('click')
    await esperarDatos(app)

    await p.w.get('.aviso-deshacer .deshacer').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, ids.lejia)).toBe('10')
    const [venta] = await app.inventario.historial({ tipo: 'VENTA' })
    expect(venta?.anulada).toBe(true)
    expect(p.w.get('h1').text()).toBe('Vender')
    expect(p.w.text()).toContain('Deshiciste la venta')
    expect(lineas(p)).toHaveLength(1)
    expect((lineas(p)[0]!.get('.cantidad input').element as HTMLInputElement).value).toBe('2')
  })

  it('RN-OP-05 / RN-UX-07: si al confirmar ya no alcanza el stock, el error del dominio se ve tal cual con su ayuda', async () => {
    const { app, ids } = await tiendaDePrueba()
    const p = await abrirVender(app)
    await agregarBuscando(p, 'lejia', 'Lejía 1 L')
    await cambiarCantidad(p, 0, '9')
    await boton(p.w, 'Cobrar').trigger('click')
    await esperarDatos(app)
    // Mientras tanto se vendió en otro lado: quedan 2.
    await app.inventario.registrarVenta({ lineas: [{ productoId: ids.lejia, cantidad: '8' }] })
    await boton(p.w, 'Confirmar venta').trigger('click')
    await esperarDatos(app)

    const error = p.w.get('.mensaje-de-error')
    expect(error.get('.mensaje').text()).toBe('Solo quedan 2 unid. de Lejía 1 L')
    expect(error.get('.ayuda').text()).toBe(
      'Cambia la cantidad o registra la llegada de mercadería.',
    )
    expect(await stock(app, ids.lejia)).toBe('2')
  })

  it('RN-UX-10: sin productos todavía, explica y ofrece agregar el primero', async () => {
    const p = await abrirVender(crearAplicacionDePrueba({ ahora: HOY }))
    expect(p.w.text()).toContain('Aún no tienes productos.')
    expect(boton(p.w, 'Agregar el primero').exists()).toBe(true)
  })
})

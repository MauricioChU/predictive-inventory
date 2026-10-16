import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorDeDominio } from '@/shared/domain/errores'
import { formatearCantidad } from '@/shared/domain/formato'
import { elegirArchivo, simularUrlsDeObjeto } from '@/shared/ui/__tests__/utilidades-kit-productos'
import type { AplicacionDePrueba } from '../../../../../tests/soporte/aplicacion-de-prueba'
import {
  crearAplicacion,
  crearProducto,
  esperar,
  esperarRuta,
  idDeCategoria,
  montarVista,
  type VistaMontada,
} from '../../../../../tests/soporte/pantallas-de-productos'

function leer(texto: string): string {
  return texto.replace(/ /g, ' ')
}

function boton(w: VueWrapper, texto: string) {
  const encontrado = w.findAll('button').find((b) => b.text().trim() === texto)
  if (!encontrado) throw new Error(`No hay un botón "${texto}"`)
  return encontrado
}

/** El contenedor del campo cuya etiqueta (label, legend o p del grupo) es `etiqueta`. */
function campo(w: VueWrapper, etiqueta: string): DOMWrapper<Element> {
  const contenedor = w
    .findAll('[data-campo]')
    .find((c) =>
      c.findAll('label, legend, .etiqueta').some((e) => leer(e.text()).trim() === etiqueta),
    )
  if (!contenedor) throw new Error(`No hay un campo "${etiqueta}"`)
  return contenedor
}

function entrada(w: VueWrapper, etiqueta: string) {
  return campo(w, etiqueta).get<HTMLInputElement>('input')
}

function errorDe(w: VueWrapper, etiqueta: string): string | null {
  const error = campo(w, etiqueta).find('.error, .mensaje-de-error .mensaje')
  return error.exists() ? leer(error.text()) : null
}

async function escribir(w: VueWrapper, etiqueta: string, valor: string) {
  await entrada(w, etiqueta).setValue(valor)
}

async function elegir(w: VueWrapper, opcion: string) {
  await boton(w, opcion).trigger('click')
}

async function guardar(w: VueWrapper, texto = 'Guardar producto') {
  await boton(w, texto).trigger('click')
  await esperar()
}

describe('Formulario de producto: crear (/productos/nuevo)', () => {
  let app: AplicacionDePrueba
  let vista: VistaMontada | undefined
  let urls: ReturnType<typeof simularUrlsDeObjeto>

  beforeEach(async () => {
    urls = simularUrlsDeObjeto()
    app = await crearAplicacion()
  })

  afterEach(async () => {
    vista?.wrapper.unmount()
    vista = undefined
    urls.restaurar()
    await app.cerrar()
  })

  async function abrir(ruta = '/productos/nuevo') {
    vista = await montarVista(app, ruta)
    return vista.wrapper
  }

  async function llenar(w: VueWrapper, cambios: Partial<Record<string, string>> = {}) {
    const valores = {
      'Nombre del producto': 'Lejía 1 L',
      'Precio de compra por unidad (S/)': '2.40',
      'Precio de venta por unidad (S/)': '3.50',
      'Stock mínimo': '3',
      '¿Cuántos tienes ahora?': '12',
      ...cambios,
    }
    for (const [etiqueta, valor] of Object.entries(valores)) {
      if (valor !== undefined) await escribir(w, etiqueta, valor)
    }
    await elegir(w, 'Lejías y desinfectantes')
  }

  it('muestra cada campo con su etiqueta, el mínimo sugerido (3) y "Por unidad" elegido', async () => {
    const w = await abrir()
    expect(w.get('h1').text()).toBe('Producto nuevo')
    expect(entrada(w, 'Nombre del producto').element.value).toBe('')
    expect(entrada(w, 'Stock mínimo').element.value).toBe('3')
    expect(entrada(w, '¿Cuántos tienes ahora?').element.value).toBe('0')
    expect(campo(w, 'Precio de venta por unidad (S/)').get('input').attributes('inputmode')).toBe(
      'decimal',
    )
    const unidades = campo(w, '¿Cómo se vende?').findAll('[role="radio"]')
    expect(unidades.map((u) => u.text())).toEqual(['Por unidad', 'Por kilo', 'Por litro'])
    expect(unidades[0]!.attributes('aria-checked')).toBe('true')
    const categorias = campo(w, '¿De qué categoría es?').findAll('[role="radio"]')
    expect(categorias).toHaveLength(10)
    expect(categorias.at(-1)!.text()).toBe('Otros')
    // RN-CAT-14: la foto se toma con la cámara de atrás o se elige de la galería.
    expect(campo(w, 'Foto del producto').find('input[capture="environment"]').exists()).toBe(true)
  })

  it('el nombre llega escrito si viene de una búsqueda sin resultados', async () => {
    const w = await abrir('/productos/nuevo?nombre=shampoo')
    expect(entrada(w, 'Nombre del producto').element.value).toBe('shampoo')
  })

  it('RN-CAT-01/04: sin nada escrito, cada error va junto a su campo y el foco al primero', async () => {
    const w = await abrir()
    await escribir(w, 'Stock mínimo', '3')
    await guardar(w)
    expect(errorDe(w, 'Nombre del producto')).toBe('Escribe el nombre del producto')
    expect(errorDe(w, '¿De qué categoría es?')).toBe('Elige una categoría')
    expect(errorDe(w, 'Precio de venta por unidad (S/)')).toBe(
      'Escribe un monto válido, por ejemplo 3.50',
    )
    expect(document.activeElement).toBe(entrada(w, 'Nombre del producto').element)
    expect(await app.catalogo.buscarProductos({ texto: '' })).toEqual([])
  })

  it('RN-CAT-04/06: precios y stock mínimo con los mensajes exactos de la spec', async () => {
    const w = await abrir()
    await llenar(w, {
      'Precio de compra por unidad (S/)': '2.405',
      'Precio de venta por unidad (S/)': '100000.00',
      'Stock mínimo': '2.5',
    })
    await guardar(w)
    expect(errorDe(w, 'Precio de compra por unidad (S/)')).toBe('Usa como máximo dos decimales')
    expect(errorDe(w, 'Precio de venta por unidad (S/)')).toBe(
      'El precio no puede pasar de S/ 99 999.99',
    )
    expect(errorDe(w, 'Stock mínimo')).toBe('Este producto se cuenta por unidades enteras')
    expect(errorDe(w, 'Nombre del producto')).toBeNull()

    // Al corregir un campo, su error se va.
    await escribir(w, 'Stock mínimo', '2')
    expect(errorDe(w, 'Stock mínimo')).toBeNull()
  })

  it('RN-CAT-01: un nombre repetido lo dice el caso de uso, junto al nombre', async () => {
    await crearProducto(app, { nombre: 'Lejía 1 L', compra: '2', venta: '3' })
    const w = await abrir()
    await llenar(w, { 'Nombre del producto': 'LEJIA   1 l' })
    await guardar(w)
    expect(errorDe(w, 'Nombre del producto')).toBe('Ya existe un producto con ese nombre')
  })

  it('RN-CAT-08 / RN-CAT-14: crea el producto con su stock inicial y su foto', async () => {
    const w = await abrir()
    await llenar(w)
    const foto = new File(['foto'], 'lejia.jpg', { type: 'image/jpeg' })
    const galeria = campo(w, 'Foto del producto').get<HTMLInputElement>(
      'input[type="file"]:not([capture])',
    )
    elegirArchivo(galeria.element, foto)
    await galeria.trigger('change')
    await guardar(w)

    expect(w.get('h1').text()).toBe('Producto guardado')
    expect(leer(w.text())).toContain('Lejía 1 L ya está en tu lista con 12 unid.')
    const [creado] = await app.catalogo.buscarProductos({ texto: 'lejia' })
    expect(creado).toMatchObject({
      nombre: 'Lejía 1 L',
      categoriaNombre: 'Lejías y desinfectantes',
    })
    expect(formatearCantidad(creado!.stock, 'UNIDAD')).toBe('12 unid.')
    const [inicial] = await app.inventario.historial({ productoId: creado!.id })
    expect(inicial?.tipo).toBe('STOCK_INICIAL')
    // La foto pasó por el procesador del catálogo (RN-CAT-14) y quedó guardada.
    expect(app.procesadorDeFotos.reducidas).toBe(1)
    expect(await app.catalogo.obtenerFoto(creado!.id)).not.toBeNull()

    await boton(w, 'Ver producto').trigger('click')
    await esperarRuta(vista!.router, 'producto')
    expect(vista!.router.currentRoute.value.params.id).toBe(creado!.id)
  })

  it('"Agregar otro producto" deja el formulario vacío para el siguiente', async () => {
    const w = await abrir()
    await llenar(w)
    await guardar(w)
    await boton(w, 'Agregar otro producto').trigger('click')
    await esperar()
    expect(w.get('h1').text()).toBe('Producto nuevo')
    expect(entrada(w, 'Nombre del producto').element.value).toBe('')
  })

  it('por kilo: las cantidades aceptan decimales y dicen "kg"', async () => {
    const w = await abrir()
    await elegir(w, 'Por kilo')
    expect(campo(w, 'Stock mínimo').text()).toContain('kg')
    await llenar(w, {
      'Nombre del producto': 'Carbón',
      'Precio de compra por kilo (S/)': '2.75',
      'Precio de venta por kilo (S/)': '4',
      'Precio de compra por unidad (S/)': undefined,
      'Precio de venta por unidad (S/)': undefined,
      'Stock mínimo': '1.5',
      '¿Cuántos tienes ahora?': '10.25',
    })
    await guardar(w)
    const [carbon] = await app.catalogo.buscarProductos({ texto: 'carbon' })
    expect(carbon?.unidad).toBe('KILO')
    expect(formatearCantidad(carbon!.stock, 'KILO')).toBe('10.25 kg')
  })

  it('muestra cuánto se gana con los precios escritos', async () => {
    const w = await abrir()
    await escribir(w, 'Precio de compra por unidad (S/)', '2.40')
    await escribir(w, 'Precio de venta por unidad (S/)', '3.50')
    expect(leer(w.text())).toContain('Ganas S/ 1.10 por cada unidad')
  })

  it('RN-CAT-05: con pérdida pide confirmar mostrando cuánto se pierde por unidad', async () => {
    const w = await abrir()
    await llenar(w, {
      'Precio de compra por unidad (S/)': '5.00',
      'Precio de venta por unidad (S/)': '4.50',
    })
    await guardar(w)
    const dialogo = w.get('dialog[open]')
    expect(leer(dialogo.text())).toContain('Vas a perder S/ 0.50 por cada unidad')

    await boton(w, 'Cambiar el precio').trigger('click')
    await esperar()
    expect(w.find('dialog[open]').exists()).toBe(false)
    expect(await app.catalogo.buscarProductos({ texto: '' })).toEqual([])
    expect(document.activeElement).toBe(entrada(w, 'Precio de venta por unidad (S/)').element)

    await guardar(w)
    await boton(w, 'Sí, guardar así').trigger('click')
    await esperar()
    expect(w.get('h1').text()).toBe('Producto guardado')
    expect(await app.catalogo.buscarProductos({ texto: 'lejia' })).toHaveLength(1)
  })

  it('RN-CAT-02: un nombre archivado no crea otro: ofrece reactivarlo', async () => {
    const escoba = await crearProducto(app, { nombre: 'Escoba', compra: '6', venta: '9' })
    await app.catalogo.archivarProducto({ productoId: escoba })
    const w = await abrir()
    await llenar(w, { 'Nombre del producto': 'escoba', '¿Cuántos tienes ahora?': '0' })
    await guardar(w)
    const dialogo = w.get('dialog[open]')
    expect(dialogo.text()).toContain('Escoba')
    expect(dialogo.text()).toContain('archivado')

    await boton(w, 'Sí, reactivarlo').trigger('click')
    await esperar()
    expect(w.get('h1').text()).toBe('Producto reactivado')
    expect((await app.catalogo.obtenerProducto(escoba))?.activo).toBe(true)
    expect(await app.catalogo.buscarProductos({ texto: '' })).toHaveLength(1)
  })

  it('RN-CAT-14: si la foto no se puede leer, el producto queda guardado y lo dice', async () => {
    vi.spyOn(app.procesadorDeFotos, 'reducir').mockRejectedValue(
      new ErrorDeDominio('FOTO_INVALIDA', 'No pudimos leer la foto. Prueba con otra.'),
    )
    const w = await abrir()
    await llenar(w)
    const galeria = campo(w, 'Foto del producto').get<HTMLInputElement>(
      'input[type="file"]:not([capture])',
    )
    elegirArchivo(galeria.element, new File(['x'], 'rara.heic', { type: '' }))
    await galeria.trigger('change')
    await guardar(w)

    expect(w.get('h1').text()).toBe('Producto guardado')
    expect(w.get('[role="alert"]').text()).toContain('No pudimos leer la foto. Prueba con otra.')
    await boton(w, 'Agregar foto').trigger('click')
    await esperarRuta(vista!.router, 'producto-editar')
  })

  it('un archivo que no es foto se avisa junto a la foto', async () => {
    const w = await abrir()
    const camara = campo(w, 'Foto del producto').get<HTMLInputElement>(
      'input[capture="environment"]',
    )
    elegirArchivo(camara.element, new File(['hola'], 'lista.txt', { type: 'text/plain' }))
    await camara.trigger('change')
    expect(errorDe(w, 'Foto del producto')).toBe(
      'Ese archivo no es una foto. Elige una foto de la galería o toma una nueva.',
    )
  })
})

describe('Formulario de producto: editar (/productos/:id/editar)', () => {
  let app: AplicacionDePrueba
  let vista: VistaMontada | undefined
  let urls: ReturnType<typeof simularUrlsDeObjeto>

  beforeEach(async () => {
    urls = simularUrlsDeObjeto()
    app = await crearAplicacion()
  })

  afterEach(async () => {
    vista?.wrapper.unmount()
    vista = undefined
    urls.restaurar()
    await app.cerrar()
  })

  async function abrir(id: string) {
    vista = await montarVista(app, `/productos/${id}/editar`)
    return vista.wrapper
  }

  const LEJIA = {
    nombre: 'Lejía 1 L',
    categoria: 'Lejías y desinfectantes',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
  }

  it('llega con los datos del producto y sin stock inicial', async () => {
    const id = await crearProducto(app, LEJIA)
    const w = await abrir(id)
    expect(w.get('h1').text()).toBe('Editar producto')
    expect(entrada(w, 'Nombre del producto').element.value).toBe('Lejía 1 L')
    expect(entrada(w, 'Precio de compra por unidad (S/)').element.value).toBe('2.40')
    expect(entrada(w, 'Precio de venta por unidad (S/)').element.value).toBe('3.50')
    expect(entrada(w, 'Stock mínimo').element.value).toBe('3')
    expect(w.findAll('label').some((l) => l.text() === '¿Cuántos tienes ahora?')).toBe(false)
    const elegida = campo(w, '¿De qué categoría es?').get('[aria-checked="true"]')
    expect(elegida.text()).toBe('Lejías y desinfectantes')
  })

  it('RN-CAT-05 / RN-CAT-09: cambiar el precio con pérdida pide confirmar y luego guarda', async () => {
    const id = await crearProducto(app, LEJIA)
    const w = await abrir(id)
    await escribir(w, 'Precio de venta por unidad (S/)', '2.00')
    await guardar(w, 'Guardar cambios')
    expect(leer(w.get('dialog[open]').text())).toContain('Vas a perder S/ 0.40 por cada unidad')
    await boton(w, 'Sí, guardar así').trigger('click')
    await esperar()
    expect(w.get('h1').text()).toBe('Cambios guardados')
    const producto = await app.catalogo.obtenerProducto(id)
    expect(producto?.precioVenta.centimos).toBe(200)

    await boton(w, 'Ver producto').trigger('click')
    await esperarRuta(vista!.router, 'producto')
  })

  it('cambiar solo el nombre de un producto con pérdida no vuelve a preguntar por el precio', async () => {
    const id = await crearProducto(app, { ...LEJIA, compra: '4.00' })
    const w = await abrir(id)
    await escribir(w, 'Nombre del producto', 'Lejía Clorox 1 L')
    await guardar(w, 'Guardar cambios')
    expect(w.find('dialog[open]').exists()).toBe(false)
    expect((await app.catalogo.obtenerProducto(id))?.nombre).toBe('Lejía Clorox 1 L')
  })

  it('RN-CAT-03: con movimientos la unidad no se puede cambiar y lo explica', async () => {
    const id = await crearProducto(app, { ...LEJIA, stockInicial: '5' })
    const w = await abrir(id)
    expect(campo(w, '¿Cómo se vende?').findAll('[role="radio"]')).toHaveLength(0)
    expect(campo(w, '¿Cómo se vende?').text()).toContain('Por unidad')
    expect(campo(w, '¿Cómo se vende?').text()).toContain(
      'No puedes cambiar la unidad de un producto que ya tiene movimientos',
    )
  })

  it('RN-CAT-03: sin movimientos la unidad sí se puede cambiar', async () => {
    const id = await crearProducto(app, {
      ...LEJIA,
      nombre: 'Carbón',
      categoria: 'Carbón y combustibles',
    })
    const w = await abrir(id)
    await elegir(w, 'Por kilo')
    await escribir(w, 'Precio de compra por kilo (S/)', '2.75')
    await guardar(w, 'Guardar cambios')
    expect((await app.catalogo.obtenerProducto(id))?.unidad).toBe('KILO')
  })

  it('cambia la categoría y quita la foto', async () => {
    const id = await crearProducto(app, LEJIA)
    await app.catalogo.guardarFoto(id, new Blob(['foto'], { type: 'image/webp' }))
    const w = await abrir(id)
    await boton(w, 'Quitar foto').trigger('click')
    await elegir(w, 'Otros')
    await guardar(w, 'Guardar cambios')
    const producto = await app.catalogo.obtenerProducto(id)
    expect(producto?.categoriaId).toBe(await idDeCategoria(app, 'Otros'))
    expect(producto?.tieneFoto).toBe(false)
  })

  it('si la foto nueva no se puede leer, lo dice junto a la foto y guarda lo demás', async () => {
    const id = await crearProducto(app, LEJIA)
    vi.spyOn(app.procesadorDeFotos, 'reducir').mockRejectedValue(
      new ErrorDeDominio('FOTO_INVALIDA', 'No pudimos leer la foto. Prueba con otra.'),
    )
    const w = await abrir(id)
    await escribir(w, 'Nombre del producto', 'Lejía Clorox 1 L')
    const galeria = campo(w, 'Foto del producto').get<HTMLInputElement>(
      'input[type="file"]:not([capture])',
    )
    elegirArchivo(galeria.element, new File(['x'], 'rara.heic', { type: '' }))
    await galeria.trigger('change')
    await guardar(w, 'Guardar cambios')
    expect(w.get('h1').text()).toBe('Editar producto')
    expect(errorDe(w, 'Foto del producto')).toBe('No pudimos leer la foto. Prueba con otra.')
    expect((await app.catalogo.obtenerProducto(id))?.nombre).toBe('Lejía Clorox 1 L')
  })

  it('un producto que no existe: "No encontramos ese producto"', async () => {
    const w = await abrir('no-existe')
    expect(w.get('h1').text()).toBe('No encontramos ese producto')
    await boton(w, 'Ver mis productos').trigger('click')
    await esperarRuta(vista!.router, 'productos')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatearNumero } from '@/shared/domain/formato'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import {
  boton,
  desmontar,
  esperarDatos,
  HOY,
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
const tipos = async (app: AplicacionDePrueba, id: string) =>
  (await app.inventario.historial({ productoId: id })).map((o) => o.tipo)

async function abrir(app: AplicacionDePrueba, ruta: string) {
  pantalla = await montarPantalla(ruta, { app })
  return pantalla
}

async function tocar(p: PantallaMontada, texto: string) {
  await boton(p.w, texto).trigger('click')
  await esperarDatos(p.app)
}

/** Si la ruta "producto" (plan 11) todavía no existe, el enlace lleva a Inicio. */
const nombreDeLaFicha = (p: PantallaMontada) =>
  p.router.hasRoute('producto') ? 'producto' : 'inicio'

describe('Registrar merma (HU-OP-04, RN-OP-15)', () => {
  it('muestra el producto, cuánto hay y los motivos como botones grandes', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/merma`)
    expect(p.w.get('#contenido h1').text()).toBe('Registrar merma')
    expect(p.w.text()).toContain('Lejía 1 L')
    expect(p.w.text()).toContain('Hay 10 unid.')
    const grupo = p.w.get('.botones-de-opcion')
    expect(grupo.get('.etiqueta').text()).toBe('¿Qué pasó?')
    expect(grupo.findAll('[role="radio"]').map((r) => r.text())).toEqual([
      'Se dañó o rompió',
      'Se derramó',
      'Se venció',
      'Otro',
    ])
  })

  it('RN-OP-15: con motivo registra la pérdida, muestra el éxito y ofrece Deshacer', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/merma`)
    await tocar(p, 'Se derramó')
    await p.w.get('.campo-numero input').setValue('2')
    await tocar(p, 'Guardar')
    expect(await stock(app, lejia)).toBe('8')
    const [merma] = await app.inventario.historial({ tipo: 'MERMA' })
    expect(merma?.motivo).toBe('Se derramó')
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Lo anotamos')
    expect(p.w.get('.pantalla-exito .detalle').text()).toBe(
      'Se derramó: 2 unid. de Lejía 1 L. Ahora hay 8 unid.',
    )
    expect(p.w.get('.aviso-deshacer').text()).toContain('Se derramó: 2 unid. de Lejía 1 L')

    await p.w.get('.aviso-deshacer .deshacer').trigger('click')
    await esperarDatos(app)
    expect(await stock(app, lejia)).toBe('10')
  })

  it('RN-OP-15: sin motivo pide "Elige qué pasó con el producto" junto a los motivos', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/merma`)
    await tocar(p, 'Guardar')
    expect(p.w.get('.botones-de-opcion .error').text()).toBe('Elige qué pasó con el producto')
    expect(await tipos(app, lejia)).toEqual(['STOCK_INICIAL'])
  })

  it('RN-OP-15: "Otro" pide la nota ("Cuéntanos qué pasó") y con ella registra', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/merma`)
    await tocar(p, 'Otro')
    await tocar(p, 'Guardar')
    expect(p.w.get('.campo-texto .error').text()).toBe('Cuéntanos qué pasó')

    await p.w.get('.campo-texto input').setValue('Se lo llevó un niño')
    await tocar(p, 'Guardar')
    const [merma] = await app.inventario.historial({ tipo: 'MERMA' })
    expect(merma).toMatchObject({ motivo: 'Otro', nota: 'Se lo llevó un niño' })
  })

  it('RN-OP-05 / RN-UX-07: más de lo que hay se rechaza junto a la cantidad, con qué hacer', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/merma`)
    await tocar(p, 'Se venció')
    await p.w.get('.campo-numero input').setValue('11')
    await tocar(p, 'Guardar')
    expect(p.w.get('.campo-numero .error').text()).toBe(
      'Solo quedan 10 unid. de Lejía 1 L. Cambia la cantidad. Si el stock no cuadra, primero cuéntalo con Contar stock.',
    )
  })

  it('"Volver al producto" lleva a la ficha del producto', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/merma`)
    await tocar(p, 'Se venció')
    await tocar(p, 'Guardar')
    await tocar(p, 'Volver al producto')
    // La pantalla de destino se carga aparte (import diferido): se espera a que llegue.
    await vi.waitFor(() => expect(p.router.currentRoute.value.name).toBe(nombreDeLaFicha(p)))
  })

  it('RN-OP-08: un producto que no existe no deja registrar nada', async () => {
    const p = await abrir(crearAplicacionDePrueba({ ahora: HOY }), '/productos/no-existe/merma')
    expect(p.w.text()).toContain('No encontramos ese producto')
    expect(p.w.find('.botones-de-opcion').exists()).toBe(false)
  })
})

describe('Contar stock (HU-OP-05, RN-OP-16)', () => {
  it('pregunta "¿Cuántos hay?" y registra un AJUSTE por la diferencia, con Deshacer', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/contar`)
    expect(p.w.get('#contenido h1').text()).toBe('Contar stock')
    expect(p.w.get('.campo-numero label').text()).toBe('¿Cuántos hay? (unid.)')
    await p.w.get('.campo-numero input').setValue('8')
    await tocar(p, 'Guardar conteo')

    expect(await stock(app, lejia)).toBe('8')
    expect(await tipos(app, lejia)).toEqual(['AJUSTE', 'STOCK_INICIAL'])
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Stock corregido')
    expect(p.w.get('.pantalla-exito .detalle').text()).toBe(
      'Lejía 1 L: ahora hay 8 unid. (2 unid. menos)',
    )
    expect(p.w.find('.aviso-deshacer').exists()).toBe(true)
  })

  it('RN-OP-16: si coincide no registra nada y dice "El stock ya estaba correcto" (sin Deshacer)', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/contar`)
    await p.w.get('.campo-numero input').setValue('10')
    await tocar(p, 'Guardar conteo')
    expect(p.w.get('.pantalla-exito h1').text()).toBe('El stock ya estaba correcto')
    expect(await tipos(app, lejia)).toEqual(['STOCK_INICIAL'])
    expect(p.w.find('.aviso-deshacer').exists()).toBe(false)
  })

  it('RN-OP-16: una cantidad negativa se rechaza junto al campo', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/contar`)
    await p.w.get('.campo-numero input').setValue('-1')
    await tocar(p, 'Guardar conteo')
    expect(p.w.get('.campo-numero .error').text()).toBe('La cantidad contada no puede ser negativa')
  })

  it('si contó de más también lo dice ("3 unid. más")', async () => {
    const { app, lejia } = await conLejia()
    const p = await abrir(app, `/productos/${lejia}/contar`)
    await p.w.get('.campo-numero input').setValue('13')
    await tocar(p, 'Guardar conteo')
    expect(p.w.get('.pantalla-exito .detalle').text()).toBe(
      'Lejía 1 L: ahora hay 13 unid. (3 unid. más)',
    )
  })
})

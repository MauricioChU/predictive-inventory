import { afterEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { formatearNumero } from '@/shared/domain/formato'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import {
  boton,
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

async function tienda(): Promise<{ app: AplicacionDePrueba; lejia: string; detergente: string }> {
  const app = crearAplicacionDePrueba({ ahora: HOY })
  app.reloj.fijar(instanteLocal('2026-10-12 09:00'))
  const lejia = await crearProductoDePrueba(app, {
    nombre: 'Lejía 1 L',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
    stockInicial: '10',
  })
  const detergente = await crearProductoDePrueba(app, {
    nombre: 'Detergente a granel',
    unidad: 'KILO',
    compra: '5.30',
    venta: '7.90',
    minimo: '2',
    stockInicial: '5',
  })
  app.reloj.fijar(HOY)
  return { app, lejia, detergente }
}

const stock = async (app: AplicacionDePrueba, id: string) =>
  formatearNumero(await app.inventario.consultable.stockDe(id))

async function abrir(app: AplicacionDePrueba, ruta = '/historial') {
  pantalla = await montarPantalla(ruta, { app })
  return pantalla
}

async function tocar(p: PantallaMontada, texto: string) {
  await boton(p.w, texto).trigger('click')
  await esperarDatos(p.app)
}

const dias = (p: PantallaMontada) =>
  p.w.findAll('.lista-agrupada-por-dia .dia').map((d) => d.text())
const items = (p: PantallaMontada) => p.w.findAll('.lista-agrupada-por-dia .operacion')

async function abrirOperacion(p: PantallaMontada, indice: number) {
  await items(p)[indice]!.trigger('click')
  await vi.waitFor(() => expect(p.router.currentRoute.value.name).toBe('operacion'))
  await esperarDatos(p.app)
}

describe('Historial (HU-OP-08)', () => {
  it('RN-UX-10: vacío, explica qué se verá y ofrece hacer una venta', async () => {
    const p = await abrir(crearAplicacionDePrueba({ ahora: HOY }))
    expect(p.w.get('#contenido h1').text()).toBe('Historial')
    expect(p.w.text()).toContain('Todavía no hay nada en el historial')
    await tocar(p, 'Hacer una venta')
    await vi.waitFor(() => expect(p.router.currentRoute.value.name).toBe('vender'))
  })

  it('agrupa por día ("Hoy", "Ayer", "Lunes 12"), lo más nuevo primero, con hora y resumen', async () => {
    const { app, lejia } = await tienda()
    app.reloj.fijar(instanteLocal('2026-10-14 18:30'))
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '1' }] })
    app.reloj.fijar(HOY)
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '2' }] })
    const p = await abrir(app)

    expect(dias(p)).toEqual(['Hoy', 'Ayer', 'Lunes 12'])
    const primero = items(p)[0]!
    expect(primero.get('.tipo').text()).toBe('Venta')
    expect(primero.get('.hora').text()).toBe('10:00')
    expect(leer(primero.get('.productos'))).toBe('Lejía 1 L (2 unid.)')
    expect(leer(primero.get('.monto'))).toBe('S/ 7.00')
    expect(items(p)[1]!.get('.hora').text()).toBe('18:30')
  })

  it('se filtra por tipo con "Mostrar"', async () => {
    const { app, lejia } = await tienda()
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '2' }] })
    const p = await abrir(app)
    expect(items(p).length).toBe(3)
    const grupo = p.w.get('[role="radiogroup"]')
    expect(grupo.findAll('[role="radio"]').map((r) => r.text())).toEqual([
      'Todo',
      'Ventas',
      'Llegó mercadería',
      'Pérdidas',
      'Conteos',
      'Anulados',
    ])
    await tocar(p, 'Ventas')
    expect(items(p).map((i) => i.get('.tipo').text())).toEqual(['Venta'])
    await tocar(p, 'Conteos')
    expect(p.w.text()).toContain('No hay movimientos de este tipo')
  })

  it('el detalle muestra cada línea con su cuenta, el total y la ganancia (RN-OP-12)', async () => {
    const { app, lejia } = await tienda()
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '2' }] })
    const p = await abrir(app)
    await abrirOperacion(p, 0)

    expect(p.w.get('#contenido h1').text()).toBe('Venta')
    expect(p.w.text()).toContain('Hoy, 10:00')
    const filas = p.w.findAll('.fila-de-dato').map((f) => f.text().replace(/ /g, ' '))
    expect(filas).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Lejía 1 L'),
        expect.stringContaining('2 unid. × S/ 3.50 = S/ 7.00'),
        expect.stringMatching(/Total\s*S\/ 7\.00/),
        expect.stringMatching(/Ganancia\s*S\/ 2\.20/),
      ]),
    )
  })

  it('RN-OP-17: Anular (con confirmación) devuelve el stock y la marca como anulada', async () => {
    const { app, lejia } = await tienda()
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '2' }] })
    const p = await abrir(app)
    await abrirOperacion(p, 0)
    await tocar(p, 'Anular')
    const dialogo = p.w.get('dialog[open]')
    expect(dialogo.get('h2').text()).toBe('¿Anular esta venta?')
    await boton(dialogo, 'Sí, anular').trigger('click')
    await esperarDatos(app)

    expect(await stock(app, lejia)).toBe('10')
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Operación anulada')
    await tocar(p, 'Volver al Historial')
    await vi.waitFor(() => expect(p.router.currentRoute.value.name).toBe('historial'))
    await esperarDatos(app)
    expect(items(p)[0]!.get('.tipo').text()).toBe('Anulado')
    expect(items(p)[1]!.text()).toContain('Anulada')
  })

  it('RN-OP-17: no se anula un ingreso cuya mercadería ya se vendió (mensaje del dominio + ayuda)', async () => {
    const { app, detergente } = await tienda()
    await app.inventario.registrarIngreso({
      lineas: [{ productoId: detergente, cantidad: '3', costo: '5.30' }],
    })
    await app.inventario.registrarVenta({ lineas: [{ productoId: detergente, cantidad: '7' }] })
    const p = await abrir(app)
    await tocar(p, 'Llegó mercadería')
    await abrirOperacion(p, 0)
    await tocar(p, 'Anular')
    await boton(p.w.get('dialog[open]'), 'Sí, anular').trigger('click')
    await esperarDatos(app)

    const error = p.w.get('.mensaje-de-error')
    expect(leer(error.get('.mensaje'))).toBe('Solo queda 1 kg de Detergente a granel')
    expect(error.get('.ayuda').text()).toBe(
      'Esa mercadería ya se vendió o se usó. Si el stock no cuadra, cuéntalo con Contar stock.',
    )
    expect(await stock(app, detergente)).toBe('1')
  })

  it('RN-OP-17: una operación ya anulada (o una anulación) no ofrece Anular', async () => {
    const { app, lejia } = await tienda()
    const { operacionId } = await app.inventario.registrarVenta({
      lineas: [{ productoId: lejia, cantidad: '2' }],
    })
    const { anulacionId } = await app.inventario.anularOperacion({ operacionId })
    const p = await abrir(app, `/historial/${operacionId}`)
    expect(p.w.text()).toContain('Esta operación está anulada')
    expect(p.w.findAll('button').some((b) => b.text() === 'Anular')).toBe(false)

    await p.ir(`/historial/${anulacionId}`)
    expect(p.w.get('#contenido h1').text()).toBe('Anulado')
    expect(p.w.findAll('button').some((b) => b.text() === 'Anular')).toBe(false)
  })

  it('una operación que no existe lo dice y ofrece volver al Historial', async () => {
    const p = await abrir(crearAplicacionDePrueba({ ahora: HOY }), '/historial/no-existe')
    expect(p.w.text()).toContain('No encontramos esa operación')
    expect(boton(p.w, 'Ir al Historial').exists()).toBe(true)
  })
})

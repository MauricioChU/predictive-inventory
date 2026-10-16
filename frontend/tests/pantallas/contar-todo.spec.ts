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

/** El Antecedente de operaciones.feature: tres productos de "Otros". */
async function tienda(): Promise<{ app: AplicacionDePrueba; lejia: string }> {
  const app = crearAplicacionDePrueba({ ahora: HOY })
  const lejia = await crearProductoDePrueba(app, {
    nombre: 'Lejía 1 L',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
    stockInicial: '10',
  })
  await crearProductoDePrueba(app, {
    nombre: 'Carbón',
    unidad: 'KILO',
    compra: '2.75',
    venta: '4.00',
    minimo: '3',
    stockInicial: '10',
  })
  await crearProductoDePrueba(app, {
    nombre: 'Detergente a granel',
    unidad: 'KILO',
    compra: '5.30',
    venta: '7.90',
    minimo: '2',
    stockInicial: '5',
  })
  return { app, lejia }
}

async function abrir(app: AplicacionDePrueba) {
  pantalla = await montarPantalla('/contar', { app })
  return pantalla
}

async function tocar(p: PantallaMontada, texto: string) {
  await boton(p.w, texto).trigger('click')
  await esperarDatos(p.app)
}

async function responder(p: PantallaMontada, texto: string) {
  await p.w.get('.campo-numero input').setValue(texto)
  await tocar(p, 'Siguiente')
}

const productoActual = (p: PantallaMontada) => p.w.get('.resumen-del-producto .nombre').text()
const progreso = (p: PantallaMontada) => p.w.get('.barra-de-progreso .texto').text()

describe('Contar todo (HU-OP-10, RN-OP-21)', () => {
  it('explica el conteo y empieza por categoría y nombre, con la barra "Llevas 0 de 3"', async () => {
    const { app } = await tienda()
    const p = await abrir(app)
    expect(p.w.get('#contenido h1').text()).toBe('Contar todo')
    await tocar(p, 'Empezar a contar')
    expect(productoActual(p)).toBe('Carbón')
    expect(progreso(p)).toBe('Llevas 0 de 3')
    const barra = p.w.get('[role="progressbar"]')
    expect(barra.attributes('aria-valuenow')).toBe('0')
    expect(barra.attributes('aria-valuemax')).toBe('3')
    expect(p.w.get('.campo-numero label').text()).toBe('¿Cuántos hay? (kg)')
  })

  it('RN-OP-21: recorre los productos (Siguiente, Saltar), registra al momento y resume al terminar', async () => {
    const { app, lejia } = await tienda()
    const p = await abrir(app)
    await tocar(p, 'Empezar a contar')
    await responder(p, '10')
    expect(productoActual(p)).toBe('Detergente a granel')
    expect(progreso(p)).toBe('Llevas 1 de 3')
    await tocar(p, 'Saltar')
    expect(productoActual(p)).toBe('Lejía 1 L')
    await responder(p, '8')

    expect(formatearNumero(await app.inventario.consultable.stockDe(lejia))).toBe('8')
    const [ajuste] = await app.inventario.historial({ tipo: 'AJUSTE' })
    expect(ajuste?.lineas[0]?.cantidad.milesimas).toBe(-2000)
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Terminaste de contar')
    expect(p.w.get('.pantalla-exito').text()).toContain(
      'Contaste 2 productos. 1 con diferencia: -S/ 4.80',
    )
    expect(p.w.get('.pantalla-exito').text()).toContain('Te faltó contar 1: Detergente a granel')
  })

  it('RN-OP-18: si el conteo cambió el stock ofrece Deshacer; si cuadraba, no', async () => {
    const { app } = await tienda()
    const p = await abrir(app)
    await tocar(p, 'Empezar a contar')
    await responder(p, '10')
    expect(p.w.find('.aviso-deshacer').exists()).toBe(false)
    await responder(p, '4')
    expect(p.w.get('.aviso-deshacer').text()).toContain('Detergente a granel: ahora hay 4 kg')
  })

  it('RN-OP-21: "No contaste ningún producto." si se saltaron todos', async () => {
    const { app } = await tienda()
    const p = await abrir(app)
    await tocar(p, 'Empezar a contar')
    await tocar(p, 'Saltar')
    await tocar(p, 'Saltar')
    await tocar(p, 'Saltar')
    expect(p.w.get('.pantalla-exito').text()).toContain('No contaste ningún producto.')
  })

  it('RN-OP-16: una cantidad negativa se rechaza junto al campo y no avanza', async () => {
    const { app } = await tienda()
    const p = await abrir(app)
    await tocar(p, 'Empezar a contar')
    await responder(p, '-1')
    expect(p.w.get('.campo-numero .error').text()).toBe('La cantidad contada no puede ser negativa')
    expect(productoActual(p)).toBe('Carbón')
  })

  it('RN-OP-21: "Seguir después" guarda el avance y al volver sigue donde quedó', async () => {
    const { app } = await tienda()
    const p = await abrir(app)
    await tocar(p, 'Empezar a contar')
    await responder(p, '10')
    await tocar(p, 'Seguir después')
    expect(p.w.get('.pantalla-exito h1').text()).toBe('Guardamos tu avance')
    expect(p.w.get('.pantalla-exito .detalle').text()).toBe(
      'Llevas 1 de 3. Para seguir, vuelve a Contar todo.',
    )
    await tocar(p, 'Ir a Inicio')
    await vi.waitFor(() => expect(p.router.currentRoute.value.name).toBe('inicio'))

    await p.ir('/contar')
    expect(p.w.text()).toContain('Seguimos donde quedaste')
    expect(productoActual(p)).toBe('Detergente a granel')
    expect(progreso(p)).toBe('Llevas 1 de 3')
  })

  it('RN-UX-10: sin productos, lo explica y ofrece agregar el primero', async () => {
    const p = await abrir(crearAplicacionDePrueba({ ahora: HOY }))
    expect(p.w.text()).toContain('Aún no tienes productos.')
    expect(boton(p.w, 'Agregar el primero').exists()).toBe(true)
  })
})

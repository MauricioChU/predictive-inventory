import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CONFIRMACIONES_PARA_RESTAURAR } from '@/modules/respaldo'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { elegirArchivo, leerTexto } from '../soporte/archivos-en-pantalla'
import {
  esperarPantalla,
  montarPantalla,
  simularDialogos,
  type PantallaMontada,
} from '../soporte/montar-pantalla'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

const HOY = instanteLocal('2026-10-15 20:30')

describe('Restaurar copia', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined
  let lejia: string
  let copia: string

  async function tocar(texto: string): Promise<void> {
    const boton = pantalla!.wrapper.findAll('button').find((b) => b.text().trim() === texto)
    if (!boton) throw new Error(`No hay un botón "${texto}" en: ${pantalla!.wrapper.text()}`)
    await boton.trigger('click')
    await esperarPantalla()
  }

  async function elegir(texto: string, nombre = 'respaldo-bodega-rosita-2026-10-15-2030.json') {
    pantalla = await montarPantalla(app, '/ajustes/restaurar')
    const input = pantalla.wrapper.get('input[type="file"]').element as HTMLInputElement
    await elegirArchivo(input, new File([texto], nombre, { type: 'application/json' }))
    await esperarPantalla()
  }

  function dialogoAbierto() {
    return pantalla!.wrapper.findAll('dialog').find((d) => d.attributes('open') !== undefined)
  }

  async function stockDeLejia(): Promise<number> {
    return (await app.inventario.consultable.stockDe(lejia)).milesimas
  }

  beforeAll(() => simularDialogos())

  beforeEach(async () => {
    app = crearAplicacionDePrueba({ ahora: HOY })
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
    lejia = await crearProductoDePrueba(app, {
      nombre: 'Lejía 1 L',
      compra: '2.40',
      venta: '3.50',
      stockInicial: '10',
    })
    copia = await leerTexto((await app.respaldo.guardarCopia()).contenido)
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '5' }] })
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    await app.cerrar()
  })

  it('RN-RE-03/04: muestra qué contiene y reemplaza los datos tras dos confirmaciones', async () => {
    await elegir(copia)

    expect(pantalla!.wrapper.text()).toContain(
      '1 producto, 1 movimiento, del 15/10/2026 al 15/10/2026',
    )
    expect(dialogoAbierto()).toBeUndefined()

    await tocar('Restaurar esta copia')
    expect(dialogoAbierto()!.text()).toContain(CONFIRMACIONES_PARA_RESTAURAR[0])
    expect(await stockDeLejia()).toBe(5000)

    await tocar('Sí, continuar')
    expect(dialogoAbierto()!.text()).toContain(CONFIRMACIONES_PARA_RESTAURAR[1])
    expect(await stockDeLejia()).toBe(5000)

    await tocar('Sí, restaurar')

    expect(await stockDeLejia()).toBe(10_000)
    expect(pantalla!.wrapper.get('h1').text()).toBe('Copia restaurada')
  })

  it('RN-UX-15: lo que contiene la copia se anuncia al elegirla', async () => {
    await elegir(copia)

    expect(await pantalla!.anunciado()).toContain(
      'La copia tiene 1 producto, 1 movimiento, del 15/10/2026 al 15/10/2026',
    )
  })

  it('RN-RE-03: cancelar en la segunda confirmación no cambia nada', async () => {
    await elegir(copia)

    await tocar('Restaurar esta copia')
    await tocar('Sí, continuar')
    await tocar('No, mejor no')

    expect(dialogoAbierto()).toBeUndefined()
    expect(await stockDeLejia()).toBe(5000)
    expect(pantalla!.wrapper.get('h1').text()).toBe('Restaurar copia')
  })

  it('RN-RE-03: una copia dañada no toca los datos y dice qué hacer', async () => {
    await elegir('esto no es una copia', 'notas.json')

    const texto = pantalla!.wrapper.text()
    expect(texto).toContain('Este archivo no es una copia válida de la app')
    expect(texto).toContain(
      'Elige el archivo que guardaste con «Guardar copia»: su nombre empieza con «respaldo-».',
    )
    expect(texto).not.toContain('.json')
    expect(
      pantalla!.wrapper.findAll('button').some((b) => b.text() === 'Restaurar esta copia'),
    ).toBe(false)
    expect(await stockDeLejia()).toBe(5000)
  })

  it('RN-RE-05: una copia de una versión más nueva se rechaza', async () => {
    await elegir(JSON.stringify({ ...JSON.parse(copia), versionDeFormato: 3 }))

    expect(pantalla!.wrapper.text()).toContain('Actualiza la app para abrir este respaldo')
  })

  it('RN-RE-04: si la copia no cuadra al restaurar, se revierte y se informa', async () => {
    const alterada = JSON.parse(copia)
    alterada.control.stockPorProducto[lejia] = 99_000
    await elegir(JSON.stringify(alterada))

    await tocar('Restaurar esta copia')
    await tocar('Sí, continuar')
    await tocar('Sí, restaurar')

    expect(pantalla!.wrapper.text()).toContain(
      'La copia tiene datos que no cuadran. No se cambió nada',
    )
    expect(await stockDeLejia()).toBe(5000)
  })
})

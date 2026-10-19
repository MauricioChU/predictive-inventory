import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'

const HOY = instanteLocal('2026-10-15 20:30')

/** RN-AN-17 y la pantalla "Alquiler del local" (06-experiencia-de-uso). */
describe('Alquiler del local (pantalla)', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined

  const wrapper = () => pantalla!.wrapper

  function campo(etiqueta: string) {
    const label = wrapper()
      .findAll('label')
      .find((l) => l.text() === etiqueta)
    if (!label) throw new Error(`No hay un campo "${etiqueta}" en: ${wrapper().text()}`)
    return wrapper().get(`#${label.attributes('for')}`)
  }

  const hayCampo = (etiqueta: string) =>
    wrapper()
      .findAll('label')
      .some((l) => l.text() === etiqueta)

  async function elegir(opcion: string): Promise<void> {
    const radio = wrapper()
      .findAll('[role="radio"]')
      .find((r) => r.text() === opcion)
    if (!radio) throw new Error(`No hay la opción "${opcion}"`)
    await radio.trigger('click')
    await esperarPantalla()
  }

  async function tocar(texto: string): Promise<void> {
    const boton = wrapper()
      .findAll('button')
      .find((b) => b.text() === texto)
    if (!boton) throw new Error(`No hay el botón "${texto}" en: ${wrapper().text()}`)
    await boton.trigger('click')
    await esperarPantalla()
  }

  async function abrir(ruta = '/control/alquiler'): Promise<void> {
    pantalla = await montarPantalla(app, ruta)
  }

  const opcionElegida = () =>
    wrapper()
      .findAll('[role="radio"][aria-checked="true"]')
      .map((r) => r.text())

  beforeEach(async () => {
    app = crearAplicacionDePrueba({ ahora: HOY })
    await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    await app.cerrar()
  })

  it('sin configurar: pregunta con las tres opciones, ninguna elegida, y todavía sin monto ni días', async () => {
    await abrir()
    expect(wrapper().get('h1').text()).toBe('Alquiler del local')
    expect(
      wrapper()
        .findAll('[role="radio"]')
        .map((r) => r.text()),
    ).toEqual(['Una vez al mes', 'Dos veces al mes', 'No pago, el local es mío'])
    expect(opcionElegida()).toEqual([])
    expect(wrapper().text()).toContain('¿Pagas alquiler por tu local?')
    expect(hayCampo('¿Cuánto pagas cada vez? (S/)')).toBe(false)
    expect(wrapper().findAll('select')).toHaveLength(0)
  })

  it('RN-AN-17: guarda el alquiler mensual y muestra el resultado', async () => {
    await abrir()
    await elegir('Una vez al mes')
    await campo('¿Cuánto pagas cada vez? (S/)').setValue('600')
    await campo('¿Qué día pagas?').setValue('5')
    await tocar('Guardar')

    expect((await app.tienda.obtenerConfiguracion()).alquilerDelLocal).toEqual({
      tipo: 'MENSUAL',
      montoCentimos: 60000,
      dias: [5],
    })
    expect(wrapper().get('h1').text()).toBe('Listo, guardamos el alquiler del local')
  })

  it('RN-AN-17: guarda el alquiler quincenal con los días ordenados', async () => {
    await abrir()
    await elegir('Dos veces al mes')
    await campo('¿Cuánto pagas cada vez? (S/)').setValue('300.50')
    await campo('Primer día de pago').setValue('20')
    await campo('Segundo día de pago').setValue('5')
    await tocar('Guardar')

    expect((await app.tienda.obtenerConfiguracion()).alquilerDelLocal).toEqual({
      tipo: 'QUINCENAL',
      montoCentimos: 30050,
      dias: [5, 20],
    })
    expect(wrapper().get('h1').text()).toBe('Listo, guardamos el alquiler del local')
  })

  it('RN-AN-17: dos días iguales muestran "Elige dos días distintos" y no se guarda nada', async () => {
    await abrir()
    await elegir('Dos veces al mes')
    await campo('¿Cuánto pagas cada vez? (S/)').setValue('300')
    await campo('Primer día de pago').setValue('10')
    await campo('Segundo día de pago').setValue('10')
    await tocar('Guardar')

    expect(wrapper().text()).toContain('Elige dos días distintos')
    expect(wrapper().get('h1').text()).toBe('Alquiler del local')
    expect((await app.tienda.obtenerConfiguracion()).alquilerDelLocal).toBeNull()
  })

  it('RN-AN-17: un monto con tres decimales dice "El monto puede tener hasta 2 decimales" junto al monto', async () => {
    await abrir()
    await elegir('Una vez al mes')
    await campo('¿Cuánto pagas cada vez? (S/)').setValue('12.345')
    await campo('¿Qué día pagas?').setValue('5')
    await tocar('Guardar')

    const monto = campo('¿Cuánto pagas cada vez? (S/)')
    expect(monto.attributes('aria-invalid')).toBe('true')
    expect(
      wrapper()
        .get(`#${monto.attributes('aria-describedby')!}`)
        .text(),
    ).toBe('El monto puede tener hasta 2 decimales')
    expect((await app.tienda.obtenerConfiguracion()).alquilerDelLocal).toBeNull()
  })

  it('RN-AN-17: un monto en cero o negativo dice que debe ser mayor que S/ 0.00', async () => {
    await abrir()
    await elegir('Una vez al mes')
    await campo('¿Cuánto pagas cada vez? (S/)').setValue('0')
    await campo('¿Qué día pagas?').setValue('5')
    await tocar('Guardar')
    expect(wrapper().text()).toContain('El monto debe ser mayor que S/ 0.00')
  })

  it('faltan datos: pide el monto y el día con su mensaje junto al campo', async () => {
    await abrir()
    await elegir('Una vez al mes')
    await tocar('Guardar')
    expect(wrapper().text()).toContain('Escribe cuánto pagas cada vez')
    expect(wrapper().text()).toContain('Elige el día de pago')

    await elegir('Dos veces al mes')
    await campo('Primer día de pago').setValue('3')
    await tocar('Guardar')
    expect(wrapper().text()).toContain('Elige el segundo día de pago')
    expect((await app.tienda.obtenerConfiguracion()).alquilerDelLocal).toBeNull()
  })

  it('sin elegir una de las tres opciones, Guardar lo pide', async () => {
    await abrir()
    await tocar('Guardar')
    expect(wrapper().text()).toContain('Elige cada cuánto pagas el alquiler')
    expect((await app.tienda.obtenerConfiguracion()).alquilerDelLocal).toBeNull()
  })

  it('"No pago, el local es mío" oculta el monto y los días y se guarda', async () => {
    await abrir()
    await elegir('Una vez al mes')
    expect(hayCampo('¿Cuánto pagas cada vez? (S/)')).toBe(true)
    await elegir('No pago, el local es mío')
    expect(hayCampo('¿Cuánto pagas cada vez? (S/)')).toBe(false)
    expect(wrapper().findAll('select')).toHaveLength(0)

    await tocar('Guardar')
    expect((await app.tienda.obtenerConfiguracion()).alquilerDelLocal).toEqual({ tipo: 'NO_PAGA' })
    expect(wrapper().get('h1').text()).toBe('Listo, guardamos el alquiler del local')
  })

  it('RN-UX-15: cada selector de día tiene nombre accesible y el monto lleva − / +', async () => {
    await abrir()
    await elegir('Dos veces al mes')
    for (const nombre of ['Primer día de pago', 'Segundo día de pago']) {
      expect(campo(nombre).element.tagName).toBe('SELECT')
    }
    expect(wrapper().find('[aria-label="Quitar uno"]').exists()).toBe(true)
    expect(wrapper().find('[aria-label="Agregar uno"]').exists()).toBe(true)
  })

  it('el monto sube de 10 en 10 con el botón +', async () => {
    await abrir()
    await elegir('Una vez al mes')
    await campo('¿Cuánto pagas cada vez? (S/)').setValue('600')
    await wrapper().get('[aria-label="Agregar uno"]').trigger('click')
    expect((campo('¿Cuánto pagas cada vez? (S/)').element as HTMLInputElement).value).toBe('610')
  })

  it('al abrir se precarga lo guardado', async () => {
    await app.tienda.actualizarConfiguracion({
      alquilerDelLocal: { tipo: 'QUINCENAL', montoCentimos: 60050, dias: [20, 5] },
    })
    await abrir()
    expect(opcionElegida()).toEqual(['Dos veces al mes'])
    expect((campo('¿Cuánto pagas cada vez? (S/)').element as HTMLInputElement).value).toBe('600.50')
    expect((campo('Primer día de pago').element as HTMLSelectElement).value).toBe('5')
    expect((campo('Segundo día de pago').element as HTMLSelectElement).value).toBe('20')
  })

  it('de dos veces al mes a una conserva el primer día; y de una a dos el segundo empieza vacío', async () => {
    await app.tienda.actualizarConfiguracion({
      alquilerDelLocal: { tipo: 'QUINCENAL', montoCentimos: 60000, dias: [5, 20] },
    })
    await abrir()
    await elegir('Una vez al mes')
    expect((campo('¿Qué día pagas?').element as HTMLSelectElement).value).toBe('5')
    await elegir('Dos veces al mes')
    expect((campo('Primer día de pago').element as HTMLSelectElement).value).toBe('5')
    expect((campo('Segundo día de pago').element as HTMLSelectElement).value).toBe('')
  })

  it('al abrir una configuración "No pago" la elige y no muestra monto', async () => {
    await app.tienda.actualizarConfiguracion({ alquilerDelLocal: { tipo: 'NO_PAGA' } })
    await abrir()
    expect(opcionElegida()).toEqual(['No pago, el local es mío'])
    expect(hayCampo('¿Cuánto pagas cada vez? (S/)')).toBe(false)
  })

  it('Volver, abierto desde Control, regresa a Control', async () => {
    await abrir()
    await elegir('No pago, el local es mío')
    await tocar('Guardar')
    await tocar('Volver')
    expect(pantalla!.router.currentRoute.value.name).toBe('control')
  })

  it('Volver, abierto desde Datos de la tienda (?desde=ajustes), regresa a Datos de la tienda', async () => {
    await abrir('/control/alquiler?desde=ajustes')
    await elegir('No pago, el local es mío')
    await tocar('Guardar')
    await tocar('Volver')
    expect(pantalla!.router.currentRoute.value.name).toBe('datos-de-la-tienda')
  })
})

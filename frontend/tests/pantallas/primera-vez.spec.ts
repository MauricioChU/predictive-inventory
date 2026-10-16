import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'

const HOY = instanteLocal('2026-10-15 10:00')

describe('Primera vez', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined

  function boton(texto: string) {
    const encontrado = pantalla!.wrapper
      .findAll('button, a')
      .find((b) => b.text().trim() === texto || b.attributes('aria-label') === texto)
    if (!encontrado) throw new Error(`No hay un botón "${texto}" en: ${pantalla!.wrapper.text()}`)
    return encontrado
  }

  async function tocar(texto: string): Promise<void> {
    await boton(texto).trigger('click')
    await esperarPantalla()
  }

  function titulo(): string {
    return pantalla!.wrapper.get('h1').text()
  }

  async function escribirNombre(nombre: string): Promise<void> {
    await pantalla!.wrapper.get('input').setValue(nombre)
  }

  beforeEach(() => {
    app = crearAplicacionDePrueba({ ahora: HOY })
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    document.documentElement.removeAttribute('data-letra')
    await app.cerrar()
  })

  it('RN-AL-08: la bienvenida no pide permiso de notificaciones', async () => {
    pantalla = await montarPantalla(app, '/')

    expect(titulo()).toBe('Te damos la bienvenida')
    expect(pantalla.wrapper.text()).toContain('Paso 1 de 5')
    expect(app.notificador.solicitudes).toBe(0)
  })

  it('bienvenida → nombre → letra con vista previa: guarda la primera vez y sigue con los productos', async () => {
    pantalla = await montarPantalla(app, '/')

    await tocar('Empezar')
    expect(titulo()).toBe('¿Cómo se llama tu tienda?')
    expect(pantalla.router.currentRoute.value.query.paso).toBe('nombre')

    await tocar('Seguir')
    expect(pantalla.wrapper.text()).toContain('Escribe el nombre de tu tienda')
    expect(titulo()).toBe('¿Cómo se llama tu tienda?')

    await escribirNombre('  Bodega Rosita  ')
    await tocar('Seguir')
    expect(titulo()).toBe('¿Qué tamaño de letra prefieres?')

    // RN-UX-01: la vista previa es la app entera, que cambia al elegir.
    await tocar('Muy grande')
    expect(document.documentElement.dataset.letra).toBe('MUY_GRANDE')
    expect(pantalla.wrapper.text()).toContain('Así se ve la letra')

    await tocar('Seguir')
    expect(titulo()).toBe('¿Cómo quieres cargar tus productos?')

    const configuracion = await app.tienda.obtenerConfiguracion()
    expect(configuracion.nombreTienda).toBe('Bodega Rosita')
    expect(configuracion.tamanoDeLetra).toBe('MUY_GRANDE')
    expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(true)
    expect(pantalla.estadoGlobal.primeraVez).toBe(false)
  })

  it('el nombre tiene hasta 40 letras', async () => {
    pantalla = await montarPantalla(app, '/bienvenida?paso=nombre')

    await escribirNombre('x'.repeat(41))
    await tocar('Seguir')

    expect(pantalla.wrapper.text()).toContain('El nombre de la tienda puede tener hasta 40 letras')
    expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(false)
  })

  it('"Volver" regresa al paso anterior', async () => {
    pantalla = await montarPantalla(app, '/')
    await tocar('Empezar')
    await escribirNombre('Bodega Rosita')
    await tocar('Seguir')
    expect(titulo()).toBe('¿Qué tamaño de letra prefieres?')

    await tocar('Volver')
    expect(titulo()).toBe('¿Cómo se llama tu tienda?')
    expect(pantalla.wrapper.get('input').element.value).toBe('Bodega Rosita')

    await tocar('Volver')
    expect(titulo()).toBe('Te damos la bienvenida')
  })

  describe('después de guardar el nombre y la letra', () => {
    beforeEach(async () => {
      await app.tienda.completarPrimeraVez({ nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' })
    })

    it.each([
      ['Uno por uno', 'producto-nuevo', {}],
      ['Desde Excel', 'importar-productos', { desde: 'primera-vez' }],
      ['Lo hago después', 'inicio', {}],
    ])('"%s" abre %s', async (texto, nombre, query) => {
      pantalla = await montarPantalla(app, '/bienvenida?paso=productos')
      expect(titulo()).toBe('¿Cómo quieres cargar tus productos?')

      await tocar(texto)

      expect(pantalla.router.currentRoute.value.name).toBe(nombre)
      expect(pantalla.router.currentRoute.value.query).toEqual(query)
    })

    it.each([
      ['Contar ahora', 'contar-todo'],
      ['Dejar para después', 'inicio'],
    ])('RN-OP-21: "Ahora contemos lo que tienes" → "%s" abre %s', async (texto, nombre) => {
      pantalla = await montarPantalla(app, '/bienvenida?paso=contar')
      expect(titulo()).toBe('Ahora contemos lo que tienes')
      expect(pantalla.wrapper.text()).toContain('Paso 5 de 5')

      await tocar(texto)

      expect(pantalla.router.currentRoute.value.name).toBe(nombre)
    })

    it('la bienvenida ya no se repite: lleva a Inicio', async () => {
      pantalla = await montarPantalla(app, '/bienvenida')

      expect(pantalla.router.currentRoute.value.name).toBe('inicio')
    })
  })
})

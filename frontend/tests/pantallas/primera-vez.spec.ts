import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

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

  it('bienvenida → nombre → letra con vista previa: guarda nombre y letra, pero la primera vez sigue sin completarse (RN-UX-16)', async () => {
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
    expect(pantalla.wrapper.text()).toContain('Paso 4 de 5')

    const configuracion = await app.tienda.obtenerConfiguracion()
    expect(configuracion.nombreTienda).toBe('Bodega Rosita')
    expect(configuracion.tamanoDeLetra).toBe('MUY_GRANDE')
    expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(false)
    expect(pantalla.estadoGlobal.primeraVez).toBe(true)
  })

  it('RN-RE-10: "Ya tengo una copia guardada" abre Restaurar copia desde la primera vez', async () => {
    pantalla = await montarPantalla(app, '/')

    await tocar('Ya tengo una copia guardada')

    expect(pantalla.router.currentRoute.value.name).toBe('restaurar-copia')
    expect(pantalla.router.currentRoute.value.query).toEqual({ desde: 'primera-vez' })
  })

  it('"Ya tengo una copia guardada" solo está en la bienvenida', async () => {
    pantalla = await montarPantalla(app, '/')
    expect(pantalla.wrapper.text()).toContain('Ya tengo una copia guardada')

    await tocar('Empezar')

    expect(pantalla.wrapper.text()).not.toContain('Ya tengo una copia guardada')
  })

  it('RN-UX-01: el paso de la letra parte de la que la app tiene ahora', async () => {
    pantalla = await montarPantalla(app, '/')
    await app.tienda.actualizarConfiguracion({ tamanoDeLetra: 'MUY_GRANDE' })
    await vi.waitFor(() => expect(pantalla!.estadoGlobal.tamanoDeLetra).toBe('MUY_GRANDE'))

    await tocar('Empezar')
    await escribirNombre('Bodega Rosita')
    await tocar('Seguir')

    expect(boton('Muy grande').attributes('aria-checked')).toBe('true')
    await tocar('Seguir')
    expect((await app.tienda.obtenerConfiguracion()).tamanoDeLetra).toBe('MUY_GRANDE')
    expect(pantalla.estadoGlobal.primeraVez).toBe(true)
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

  it('"Volver" usa el "atrás" del historial si el paso anterior es la entrada anterior (el botón atrás del celular sigue en orden)', async () => {
    pantalla = await montarPantalla(app, '/')
    await tocar('Empezar')
    await escribirNombre('Bodega Rosita')
    await tocar('Seguir')
    // Como en el navegador real: la entrada anterior del historial es el paso del nombre.
    Object.defineProperty(pantalla.router.options.history, 'state', {
      configurable: true,
      value: { back: '/bienvenida?paso=nombre' },
    })
    const atras = vi.spyOn(pantalla.router, 'back')
    const reemplazar = vi.spyOn(pantalla.router, 'replace')

    await tocar('Volver')

    expect(atras).toHaveBeenCalledTimes(1)
    expect(reemplazar).not.toHaveBeenCalled()
  })

  describe('después de guardar el nombre y la letra (la primera vez aún no está completada)', () => {
    beforeEach(async () => {
      await app.tienda.actualizarConfiguracion({
        nombreTienda: 'Bodega Rosita',
        tamanoDeLetra: 'GRANDE',
      })
    })

    it('recargar en un paso conserva el nombre prellenado', async () => {
      pantalla = await montarPantalla(app, '/bienvenida?paso=nombre')

      expect(pantalla.wrapper.get('input').element.value).toBe('Bodega Rosita')
    })

    it('recargar en el paso 4 sigue en la primera vez y "Volver" regresa a la letra', async () => {
      pantalla = await montarPantalla(app, '/bienvenida?paso=productos')
      expect(pantalla.estadoGlobal.primeraVez).toBe(true)

      await tocar('Volver')
      expect(titulo()).toBe('¿Qué tamaño de letra prefieres?')

      await tocar('Volver')
      expect(titulo()).toBe('¿Cómo se llama tu tienda?')
      expect(pantalla.wrapper.get('input').element.value).toBe('Bodega Rosita')
    })

    it.each([
      ['Uno por uno', 'producto-nuevo', { desde: 'primera-vez' }],
      ['Desde Excel', 'importar-productos', { desde: 'primera-vez' }],
      ['Más tarde', 'primera-vez', { paso: 'contar' }],
    ])('paso 4: "%s" abre %s', async (texto, nombre, query) => {
      pantalla = await montarPantalla(app, '/bienvenida?paso=productos')
      expect(titulo()).toBe('¿Cómo quieres cargar tus productos?')
      expect(pantalla.wrapper.text()).toContain('Paso 4 de 5')

      await tocar(texto)

      expect(pantalla.router.currentRoute.value.name).toBe(nombre)
      expect(pantalla.router.currentRoute.value.query).toEqual(query)
      expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(false)
    })

    it('paso 4: ya no existe "Dejar para después"', async () => {
      pantalla = await montarPantalla(app, '/bienvenida?paso=productos')

      expect(pantalla.wrapper.text()).not.toContain('Dejar para después')
    })

    describe('paso 5, sin productos', () => {
      it('no ofrece "Contar ahora" ni dice que hay algo por contar', async () => {
        pantalla = await montarPantalla(app, '/bienvenida?paso=contar')

        expect(titulo()).toBe('Ahora contemos lo que tienes')
        expect(pantalla.wrapper.text()).toContain('Paso 5 de 5')
        expect(pantalla.wrapper.findAll('button').map((b) => b.text().trim())).not.toContain(
          'Contar ahora',
        )
        expect(pantalla.wrapper.text()).not.toContain('Puedes contarlos después desde Inicio')
        expect(boton('Terminar')).toBeDefined()
      })

      it('"Terminar" completa la primera vez y abre Inicio sin dejar la bienvenida en el historial', async () => {
        pantalla = await montarPantalla(app, '/bienvenida?paso=contar')
        const reemplazar = vi.spyOn(pantalla.router, 'replace')

        await tocar('Terminar')

        expect(pantalla.router.currentRoute.value.name).toBe('inicio')
        expect(reemplazar).toHaveBeenCalledWith({ name: 'inicio' })
        expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(true)
        expect(pantalla.estadoGlobal.primeraVez).toBe(false)
        const configuracion = await app.tienda.obtenerConfiguracion()
        expect(configuracion.nombreTienda).toBe('Bodega Rosita')
        expect(configuracion.tamanoDeLetra).toBe('GRANDE')
      })
    })

    describe('paso 5: no se muestra nada hasta saber si hay productos (RN-UX-16, ruling R8)', () => {
      /** Una promesa que se resuelve cuando la prueba quiere. */
      function pendiente<T>() {
        let resolver!: (valor: T) => void
        let rechazar!: (causa: unknown) => void
        const promesa = new Promise<T>((alResolver, alRechazar) => {
          resolver = alResolver
          rechazar = alRechazar
        })
        return { promesa, resolver, rechazar }
      }

      function textosDeLosBotones(): string[] {
        return pantalla!.wrapper.findAll('button').map((b) => b.text().trim())
      }

      it('con productos: mientras se leen no hay cuerpo ni botones, y después aparece "Contar ahora" (sin parpadeo)', async () => {
        await crearProductoDePrueba(app, {
          nombre: 'Lejía 1 L',
          compra: '2.40',
          venta: '3.50',
          minimo: '3',
          stockInicial: '0',
        })
        const lectura = pendiente<Awaited<ReturnType<typeof app.catalogo.consultable.productos>>>()
        const productos = app.catalogo.consultable.productos.bind(app.catalogo.consultable)
        // Se retiene la lectura de la pantalla (no las de abrirApp): se entra al paso 5 desde el 4.
        pantalla = await montarPantalla(app, '/bienvenida?paso=productos')
        vi.spyOn(app.catalogo.consultable, 'productos').mockImplementation(() => lectura.promesa)
        await tocar('Más tarde')

        expect(titulo()).toBe('Ahora contemos lo que tienes')
        expect(textosDeLosBotones()).not.toContain('Terminar')
        expect(textosDeLosBotones()).not.toContain('Contar ahora')
        // Ni la versión "sin productos" del texto, que sería la que parpadea.
        expect(pantalla.wrapper.text()).not.toContain('Cuando cargues tus productos')

        lectura.resolver(await productos({ soloActivos: true }))
        await esperarPantalla()

        expect(textosDeLosBotones()).toContain('Contar ahora')
        expect(textosDeLosBotones()).toContain('Terminar')
        expect(pantalla.wrapper.text()).not.toContain('Cuando cargues tus productos')
      })

      it('sin productos: aparece solo "Terminar"', async () => {
        const lectura = pendiente<never[]>()
        pantalla = await montarPantalla(app, '/bienvenida?paso=productos')
        vi.spyOn(app.catalogo.consultable, 'productos').mockImplementation(() => lectura.promesa)
        await tocar('Más tarde')
        expect(textosDeLosBotones()).not.toContain('Terminar')

        lectura.resolver([])
        await esperarPantalla()

        expect(textosDeLosBotones()).toContain('Terminar')
        expect(textosDeLosBotones()).not.toContain('Contar ahora')
        expect(pantalla.wrapper.text()).toContain('Cuando cargues tus productos')
      })

      it('si no se pueden leer los productos: lo registra y sigue como si no hubiera (solo "Terminar")', async () => {
        const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const causa = new Error('sin disco')
        pantalla = await montarPantalla(app, '/bienvenida?paso=productos')
        vi.spyOn(app.catalogo.consultable, 'productos').mockRejectedValue(causa)
        await tocar('Más tarde')

        expect(registro).toHaveBeenCalledWith('No se pudieron leer los productos:', causa)
        expect(textosDeLosBotones()).toEqual(expect.arrayContaining(['Terminar']))
        expect(textosDeLosBotones()).not.toContain('Contar ahora')
        await tocar('Terminar')
        expect(pantalla.router.currentRoute.value.name).toBe('inicio')
      })
    })

    describe('paso 5 tras recargar: no se puede terminar antes de leer el nombre (ruling R8)', () => {
      it('los botones esperan a la configuración y "Terminar" no rebota al paso del nombre', async () => {
        const original = app.tienda.obtenerConfiguracion.bind(app.tienda)
        let lecturaRetenida: (() => void) | undefined
        let llamadas = 0
        vi.spyOn(app.tienda, 'obtenerConfiguracion').mockImplementation(() => {
          llamadas += 1
          // La 1.ª es de abrirApp; la 2.ª, de la pantalla, que es la que tarda.
          if (llamadas !== 2) return original()
          return new Promise((resolver) => {
            lecturaRetenida = () => resolver(original())
          })
        })

        pantalla = await montarPantalla(app, '/bienvenida?paso=contar')
        expect(lecturaRetenida, 'la pantalla pidió la configuración').toBeDefined()

        const terminar = boton('Terminar')
        expect(terminar.attributes('disabled')).toBeDefined()
        await terminar.trigger('click')
        await esperarPantalla()
        expect(titulo()).toBe('Ahora contemos lo que tienes')
        expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(false)

        lecturaRetenida!()
        await esperarPantalla()
        expect(boton('Terminar').attributes('disabled')).toBeUndefined()

        await tocar('Terminar')
        expect(pantalla.router.currentRoute.value.name).toBe('inicio')
        expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(true)
        expect((await app.tienda.obtenerConfiguracion()).nombreTienda).toBe('Bodega Rosita')
      })

      it('si la configuración no se puede leer, los botones se habilitan igual (y sin nombre vuelve al paso del nombre)', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const original = app.tienda.obtenerConfiguracion.bind(app.tienda)
        let llamadas = 0
        vi.spyOn(app.tienda, 'obtenerConfiguracion').mockImplementation(() => {
          llamadas += 1
          return llamadas === 2 ? Promise.reject(new Error('sin disco')) : original()
        })

        pantalla = await montarPantalla(app, '/bienvenida?paso=contar')
        await esperarPantalla()

        expect(boton('Terminar').attributes('disabled')).toBeUndefined()
      })
    })

    describe('paso 5, con productos', () => {
      beforeEach(async () => {
        await crearProductoDePrueba(app, {
          nombre: 'Lejía 1 L',
          compra: '2.40',
          venta: '3.50',
          minimo: '3',
          stockInicial: '0',
        })
      })

      it('RN-OP-21: "Contar ahora" completa la primera vez y abre Contar todo', async () => {
        pantalla = await montarPantalla(app, '/bienvenida?paso=contar')
        const reemplazar = vi.spyOn(pantalla.router, 'replace')

        await tocar('Contar ahora')

        expect(pantalla.router.currentRoute.value.name).toBe('contar-todo')
        expect(reemplazar).toHaveBeenCalledWith({ name: 'contar-todo' })
        expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(true)
        expect(pantalla.estadoGlobal.primeraVez).toBe(false)
      })

      it('"Terminar" dice que se pueden contar después desde Inicio y abre Inicio', async () => {
        pantalla = await montarPantalla(app, '/bienvenida?paso=contar')
        expect(pantalla.wrapper.text()).toContain('Puedes contarlos después desde Inicio')

        await tocar('Terminar')

        expect(pantalla.router.currentRoute.value.name).toBe('inicio')
        expect((await app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(true)
      })
    })

    it('si no se puede completar, avisa y se queda en el paso 5', async () => {
      pantalla = await montarPantalla(app, '/bienvenida?paso=contar')
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      vi.spyOn(app.tienda, 'completarPrimeraVez').mockRejectedValue(new Error('sin disco'))

      await tocar('Terminar')

      expect(pantalla.wrapper.text()).toContain('No se pudo guardar')
      expect(titulo()).toBe('Ahora contemos lo que tienes')
      expect(pantalla.estadoGlobal.primeraVez).toBe(true)
    })
  })

  describe('con la primera vez ya completada', () => {
    beforeEach(async () => {
      await app.tienda.completarPrimeraVez({
        nombreTienda: 'Bodega Rosita',
        tamanoDeLetra: 'GRANDE',
      })
    })

    it('la bienvenida ya no se repite: lleva a Inicio', async () => {
      pantalla = await montarPantalla(app, '/bienvenida')

      expect(pantalla.router.currentRoute.value.name).toBe('inicio')
    })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
import { olvidarInstalacionParaPruebas } from '@/modules/tienda'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from '../soporte/aplicacion-de-prueba'
import { esperarPantalla, montarPantalla, type PantallaMontada } from '../soporte/montar-pantalla'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

const HOY = instanteLocal('2026-10-15 10:00')
const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }
const CARBON = {
  nombre: 'Carbón',
  unidad: 'KILO' as const,
  compra: '2.75',
  venta: '4.00',
  minimo: '3',
}

describe('Inicio', () => {
  let app: AplicacionDePrueba
  let pantalla: PantallaMontada | undefined

  async function tiendaLista(nombre = 'Bodega Rosita'): Promise<void> {
    await app.tienda.completarPrimeraVez({ nombreTienda: nombre, tamanoDeLetra: 'GRANDE' })
  }

  async function abrirInicio(): Promise<PantallaMontada> {
    pantalla = await montarPantalla(app, '/')
    return pantalla
  }

  function botonCon(texto: string) {
    const boton = pantalla!.wrapper.findAll('button, a').find((b) => b.text().includes(texto))
    if (!boton) throw new Error(`No hay un botón o enlace "${texto}"`)
    return boton
  }

  beforeEach(() => {
    app = crearAplicacionDePrueba({ ahora: HOY })
    olvidarInstalacionParaPruebas()
  })

  afterEach(async () => {
    pantalla?.wrapper.unmount()
    pantalla = undefined
    await app.cerrar()
  })

  it('primera vez: Inicio lleva a la bienvenida', async () => {
    const { router } = await abrirInicio()

    expect(router.currentRoute.value.name).toBe('primera-vez')
  })

  it('saluda con el nombre de la tienda', async () => {
    await tiendaLista('Bodega Rosita')
    const { wrapper } = await abrirInicio()

    expect(wrapper.get('h1').text()).toContain('Hola, Bodega Rosita')
  })

  it('RN-AN-03: muestra la ganancia neta y las ventas de hoy', async () => {
    await tiendaLista()
    const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })
    await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '2' }] })

    const { wrapper } = await abrirInicio()

    const cifra = wrapper.get('.tarjeta-de-cifra')
    expect(cifra.text()).toContain('Hoy ganaste')
    expect(cifra.text()).toContain('S/ 2.20')
    expect(cifra.text()).toContain('Vendiste S/ 7.00')
  })

  it('RN-AN-03: sin ventas hoy lo dice con palabras', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })

    const { wrapper } = await abrirInicio()

    expect(wrapper.get('.tarjeta-de-cifra').text()).toContain('Todavía no hay ventas hoy')
  })

  it('RN-AL-06: avisa cuántos productos se acaban y lleva a Para comprar', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    await crearProductoDePrueba(app, { ...CARBON, stockInicial: '2' })
    const { wrapper, router } = await abrirInicio()

    const aviso = wrapper.get('.aviso-en-pagina--atencion')
    expect(aviso.text()).toContain('2 productos se acaban')
    expect(aviso.text()).toContain('1 agotado y 1 por acabarse')

    await botonCon('Ver qué comprar').trigger('click')
    await esperarPantalla()
    expect(router.currentRoute.value.name).toBe('para-comprar')
  })

  it('RN-AL-06: si nada se acaba, lo dice', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })

    const { wrapper } = await abrirInicio()

    expect(wrapper.text()).toContain('Todo bien: no falta nada')
    expect(wrapper.find('.aviso-en-pagina--atencion').exists()).toBe(false)
  })

  it('RN-UX-10: sin productos ofrece agregar el primero', async () => {
    await tiendaLista()
    const { wrapper, router } = await abrirInicio()

    expect(wrapper.text()).toContain('Aún no tienes productos')
    await botonCon('Agregar el primero').trigger('click')
    await esperarPantalla()
    expect(router.currentRoute.value.name).toBe('producto-nuevo')
  })

  it.each([
    ['Vender', 'vender'],
    ['Llegó mercadería', 'recibir'],
    ['¿Necesito comprar?', 'necesito-comprar'],
    ['Historial', 'historial'],
    ['Ajustes', 'ajustes'],
  ])('RN-UX-12: "%s" abre su pantalla', async (texto, nombre) => {
    await tiendaLista()
    const { router } = await abrirInicio()

    await botonCon(texto).trigger('click')
    await esperarPantalla()

    expect(router.currentRoute.value.name).toBe(nombre)
  })

  it('RN-RE-06: recuerda guardar una copia y lleva a Guardar copia', async () => {
    await tiendaLista()
    const { wrapper, router } = await abrirInicio()

    expect(wrapper.text()).toContain('Todavía no guardas una copia de tus datos')
    await botonCon('Guardar copia ahora').trigger('click')
    await esperarPantalla()
    expect(router.currentRoute.value.name).toBe('guardar-copia')
  })

  it('RN-RE-06: con una copia reciente no recuerda nada', async () => {
    await tiendaLista()
    await app.respaldo.marcarCopiaGuardada()

    const { wrapper } = await abrirInicio()

    expect(wrapper.text()).not.toContain('guardas una copia')
  })

  it('RN-AL-09: el resumen del día se cierra con un toque y no vuelve ese día', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    const { wrapper } = await abrirInicio()

    const resumen = wrapper.get('[data-resumen-del-dia]')
    expect(resumen.text()).toContain('Resumen del día')
    expect(resumen.text()).toContain('1 agotado')
    expect(resumen.text()).toContain('Nada por acabarse')
    expect(resumen.text()).toContain('Ayer no hubo ventas')

    await botonCon('Cerrar').trigger('click')
    await esperarPantalla()

    expect(wrapper.find('[data-resumen-del-dia]').exists()).toBe(false)
    expect(await app.alertas.resumenDelDia()).toBeNull()
  })

  it('RN-UX-15: al cerrar el resumen del día el foco no se pierde: va al saludo', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })
    const { wrapper } = await abrirInicio()

    await botonCon('Cerrar').trigger('click')
    await esperarPantalla()

    expect(document.activeElement).toBe(wrapper.get('h1').element)
  })

  it('celular: Vender y las otras acciones van antes del resumen del día, el recordatorio y la instalación', async () => {
    await tiendaLista()
    await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '0' })
    const { wrapper } = await abrirInicio()

    const html = wrapper.html()
    const posicion = (marca: string) => {
      const i = html.indexOf(marca)
      if (i < 0) throw new Error(`No está "${marca}"`)
      return i
    }
    const orden = [
      posicion('tarjeta-de-cifra'),
      posicion('aviso-en-pagina--atencion'),
      posicion('class="vender-fijo"'),
      posicion('class="enlace-historial"'),
      posicion('data-resumen-del-dia'),
      posicion('Todavía no guardas una copia'),
      posicion('Instala la app en tu celular'),
    ]
    expect(orden).toEqual([...orden].sort((a, b) => a - b))
  })

  it('sin productos no muestra el resumen del día (no hay nada que resumir)', async () => {
    await tiendaLista()
    const { wrapper } = await abrirInicio()

    expect(wrapper.text()).toContain('Aún no tienes productos')
    expect(wrapper.find('[data-resumen-del-dia]').exists()).toBe(false)
  })

  describe('RN-UX-13: tarjeta de instalación', () => {
    function ofrecerInstalacion(resultado: 'accepted' | 'dismissed') {
      const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: string }>
        pedidas: number
      }
      evento.pedidas = 0
      evento.prompt = async () => {
        evento.pedidas += 1
      }
      evento.userChoice = Promise.resolve({ outcome: resultado })
      window.dispatchEvent(evento)
      return evento
    }

    it('si el navegador la ofrece, el botón Instalar abre el diálogo del navegador', async () => {
      await tiendaLista()
      const { wrapper } = await abrirInicio()
      const evento = ofrecerInstalacion('accepted')
      await esperarPantalla()

      expect(wrapper.text()).toContain('Instala la app en tu celular')
      await botonCon('Instalar').trigger('click')
      await esperarPantalla()

      expect(evento.pedidas).toBe(1)
      expect(evento.defaultPrevented).toBe(true)
      expect(wrapper.text()).not.toContain('Instala la app en tu celular')
    })

    it('si el diálogo del navegador falla, se registra y quedan los pasos', async () => {
      await tiendaLista()
      const { wrapper } = await abrirInicio()
      const evento = ofrecerInstalacion('accepted')
      evento.prompt = () => Promise.reject(new Error('El navegador no lo permitió'))
      const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await esperarPantalla()

      await botonCon('Instalar').trigger('click')
      await esperarPantalla()

      expect(registro).toHaveBeenCalled()
      expect(wrapper.text()).toContain('Agregar a la pantalla principal')
      registro.mockRestore()
    })

    it('si el navegador no la ofrece, muestra los pasos', async () => {
      await tiendaLista()
      const { wrapper } = await abrirInicio()

      expect(wrapper.text()).toContain('Instala la app en tu celular')
      expect(wrapper.text()).toContain('Agregar a la pantalla principal')
      expect(wrapper.findAll('button').some((b) => b.text() === 'Instalar')).toBe(false)
    })

    it('"Ahora no" la esconde', async () => {
      await tiendaLista()
      const { wrapper } = await abrirInicio()

      await botonCon('Ahora no').trigger('click')
      await esperarPantalla()

      expect(wrapper.text()).not.toContain('Instala la app en tu celular')
      expect(document.activeElement).toBe(wrapper.get('h1').element)
    })

    it('instalada (abierta como app) no aparece', async () => {
      await tiendaLista()
      window.matchMedia = ((consulta: string) => ({
        matches: consulta === '(display-mode: standalone)',
      })) as unknown as typeof window.matchMedia
      olvidarInstalacionParaPruebas()
      try {
        const { wrapper } = await abrirInicio()
        expect(wrapper.text()).not.toContain('Instala la app en tu celular')
      } finally {
        Reflect.deleteProperty(window, 'matchMedia')
        olvidarInstalacionParaPruebas()
      }
    })
  })
})

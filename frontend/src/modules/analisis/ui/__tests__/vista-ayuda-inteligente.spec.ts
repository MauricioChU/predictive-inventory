import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import VistaAyudaInteligente from '../VistaAyudaInteligente.vue'
import { esperarCarga, montarVista } from '../__pruebas__/montar-vista'
import { textoLeido } from '../__pruebas__/texto-leido'
import { TiendaDePrueba } from '../__pruebas__/tienda-de-prueba'

const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }
const JABON = { nombre: 'Jabón', compra: '1.20', venta: '2.00', minimo: '3' }
const BOLSAS = { nombre: 'Bolsas', compra: '0.05', venta: '0.10', minimo: '0' }
const CERA_ROJA = { nombre: 'Cera roja', compra: '5.00', venta: '4.50', minimo: '2' }

const texto = textoLeido

let montada: VueWrapper | undefined
afterEach(() => {
  montada?.unmount()
  montada = undefined
})

async function abrirAyuda(tienda: TiendaDePrueba, conDetalleDeProducto = true) {
  const montaje = await montarVista(VistaAyudaInteligente, {
    aplicacion: tienda.app,
    ruta: '/control/ayuda',
    conDetalleDeProducto,
  })
  montada = montaje.envoltura
  return montaje
}

function seccion(w: VueWrapper, titulo: string): DOMWrapper<Element> {
  const encontrada = w
    .findAll('section')
    .find((s) => s.find('h2').exists() && texto(s.get('h2')) === titulo)
  if (!encontrada) throw new Error(`No está la sección "${titulo}"`)
  return encontrada
}

describe('Ayuda inteligente (Atención, Para comprar y Productos parados)', () => {
  describe('Atención', () => {
    async function tiendaConAtencion() {
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' }, '2026-10-01 08:00')
      await tienda.producto(BOLSAS)
      await tienda.producto({ ...JABON, stockInicial: '2' })
      await tienda.producto({ ...CERA_ROJA, stockInicial: '10' })
      return tienda
    }

    it('cada grupo dice cuántos productos tiene y abre su lista', async () => {
      const tienda = await tiendaConAtencion()
      const { envoltura } = await abrirAyuda(tienda)
      const atencion = seccion(envoltura, 'Atención')
      const botones = atencion.findAll('button[aria-expanded]')
      expect(botones.map(texto)).toEqual([
        'Agotados 1 producto',
        'Queda poco 1 producto',
        'Precios para revisar 1 producto',
      ])
      expect(botones.map((b) => b.attributes('aria-expanded'))).toEqual(['false', 'false', 'false'])

      await botones[0]!.trigger('click')
      expect(botones[0]!.attributes('aria-expanded')).toBe('true')
      const agotados = atencion.get(`#${botones[0]!.attributes('aria-controls')}`)
      expect(agotados.isVisible()).toBe(true)
      expect(agotados.findAll('li').map(texto)).toEqual(['Bolsas Agotado'])
      // Cada producto abre su detalle (ruta `producto`, rama 11).
      expect(agotados.get('a').attributes('href')).toBe(`/productos/${tienda.id('Bolsas')}`)

      await botones[1]!.trigger('click')
      const porAcabarse = atencion.get(`#${botones[1]!.attributes('aria-controls')}`)
      expect(porAcabarse.findAll('li').map(texto)).toEqual(['Jabón Quedan 2 unid.'])

      await botones[2]!.trigger('click')
      const precios = atencion.get(`#${botones[2]!.attributes('aria-controls')}`)
      expect(precios.findAll('li').map(texto)).toEqual(['Cera roja Pierdes S/ 0.50 por unidad'])

      await botones[0]!.trigger('click')
      expect(botones[0]!.attributes('aria-expanded')).toBe('false')
      expect(agotados.isVisible()).toBe(false)
    })

    it('mientras no exista el detalle del producto (rama 11), la lista no enlaza', async () => {
      const { envoltura } = await abrirAyuda(await tiendaConAtencion(), false)
      const atencion = seccion(envoltura, 'Atención')
      const agotados = atencion.findAll('button[aria-expanded]')[0]!
      await agotados.trigger('click')
      const lista = atencion.get(`#${agotados.attributes('aria-controls')}`)
      expect(atencion.find('a').exists()).toBe(false)
      expect(lista.findAll('li').map(texto)).toEqual(['Bolsas Agotado'])
    })

    it('un grupo sin productos dice "Ninguno" y no es un botón', async () => {
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' })
      const { envoltura } = await abrirAyuda(tienda)
      const atencion = seccion(envoltura, 'Atención')
      expect(atencion.findAll('button').length).toBe(0)
      expect(atencion.findAll('.fila-de-atencion').map(texto)).toEqual([
        'Agotados Ninguno',
        'Queda poco Ninguno',
        'Precios para revisar Ninguno',
      ])
    })
  })

  describe('Para comprar', () => {
    it('RN-AN-07 / RN-AN-08: resume la lista con su total y abre "Para comprar" y "¿Necesito comprar?"', async () => {
      const tienda = new TiendaDePrueba()
      await tienda.producto(BOLSAS)
      await tienda.producto({ ...JABON, stockInicial: '2' })
      const { envoltura, router } = await abrirAyuda(tienda)
      const paraComprar = seccion(envoltura, 'Para comprar')
      expect(paraComprar.findAll('.fila-de-dato').map(texto)).toEqual([
        'Bolsas 1 unid.',
        'Jabón 4 unid.',
        'Total estimado S/ 4.85',
      ])
      expect(texto(paraComprar.get('.cuantos'))).toBe('2 productos')

      // Se busca de nuevo cada vez: al volver a Control la pantalla se monta otra vez.
      const boton = (nombre: string) =>
        seccion(envoltura, 'Para comprar')
          .findAll('button')
          .find((b) => texto(b) === nombre)!
      await boton('Ver la lista para comprar').trigger('click')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('para-comprar')

      await router.push('/control/ayuda')
      await esperarCarga()
      await boton('¿Necesito comprar?').trigger('click')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('necesito-comprar')
    })

    it('RN-UX-10: sin nada que comprar lo dice, y "¿Necesito comprar?" sigue a mano', async () => {
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' })
      const { envoltura } = await abrirAyuda(tienda)
      const paraComprar = seccion(envoltura, 'Para comprar')
      expect(texto(paraComprar)).toContain('No hace falta comprar nada por ahora')
      expect(paraComprar.findAll('button').map(texto)).toEqual(['¿Necesito comprar?'])
    })

    it('la lista larga se resume en los tres primeros y cuántos más hay', async () => {
      const tienda = new TiendaDePrueba()
      for (const nombre of ['Producto A', 'Producto B', 'Producto C', 'Producto D', 'Producto E']) {
        await tienda.producto({ nombre, compra: '1.00', venta: '2.00', minimo: '1' })
      }
      const { envoltura } = await abrirAyuda(tienda)
      const paraComprar = seccion(envoltura, 'Para comprar')
      expect(paraComprar.findAll('.fila-de-dato').map(texto)).toEqual([
        'Producto A 2 unid.',
        'Producto B 2 unid.',
        'Producto C 2 unid.',
        'Total estimado S/ 10.00',
      ])
      expect(texto(paraComprar.get('.mas'))).toBe('y 2 más')
    })
  })

  describe('Productos parados', () => {
    it('RN-AN-11: el dinero parado en cada uno, el total y la sugerencia fija', async () => {
      const tienda = new TiendaDePrueba()
      const escoba = { nombre: 'Escoba', compra: '6.00', venta: '9.00', minimo: '1' }
      const trapeador = { nombre: 'Trapeador', compra: '8.00', venta: '12.00', minimo: '1' }
      const recogedor = { nombre: 'Recogedor', compra: '3.00', venta: '5.00', minimo: '1' }
      await tienda.producto({ ...escoba, stockInicial: '5' }, '2026-07-17 08:00')
      await tienda.vender('Escoba', '1', '2026-08-31 10:00')
      await tienda.producto({ ...trapeador, stockInicial: '2' }, '2026-09-05 08:00')
      await tienda.producto({ ...recogedor, stockInicial: '3' }, '2026-10-05 08:00')
      await tienda.producto({ ...LEJIA, stockInicial: '20' }, '2026-08-01 08:00')
      await tienda.vender('Lejía 1 L', '1', '2026-10-14 10:00')

      const { envoltura } = await abrirAyuda(tienda)
      const parados = seccion(envoltura, 'Productos parados')
      expect(parados.findAll('li').map(texto)).toEqual([
        'Escoba S/ 24.00 No se vende hace 45 días · tienes 4 unid.',
        'Trapeador S/ 16.00 No se vende hace 40 días · tienes 2 unid.',
      ])
      expect(texto(parados.get('.total'))).toBe('Total de dinero parado S/ 40.00')
      expect(texto(parados.get('.aviso-en-pagina'))).toBe(
        'Ponlo a la vista u ofrécelo con descuento',
      )
    })

    it('RN-UX-10: sin productos parados lo dice', async () => {
      const { envoltura } = await abrirAyuda(new TiendaDePrueba())
      const parados = seccion(envoltura, 'Productos parados')
      expect(texto(parados)).toContain('Ningún producto está parado')
      expect(parados.find('.aviso-en-pagina').exists()).toBe(false)
    })
  })
})

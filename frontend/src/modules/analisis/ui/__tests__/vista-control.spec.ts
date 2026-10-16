import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import VistaControl from '../VistaControl.vue'
import { esperarCarga, montarVista } from '../__pruebas__/montar-vista'
import { textoLeido } from '../__pruebas__/texto-leido'
import { TiendaDePrueba } from '../__pruebas__/tienda-de-prueba'

const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }
const CARBON = { nombre: 'Carbón', unidad: 'KILO' as const, compra: '2.75', venta: '4.00' }
const JABON = { nombre: 'Jabón', compra: '1.20', venta: '2.00', minimo: '3' }
const BOLSAS = { nombre: 'Bolsas', compra: '0.05', venta: '0.10', minimo: '0' }
const CERA_ROJA = { nombre: 'Cera roja', compra: '5.00', venta: '4.50', minimo: '2' }

const texto = textoLeido

let montada: VueWrapper | undefined
afterEach(() => {
  montada?.unmount()
  montada = undefined
})

async function abrirControl(tienda: TiendaDePrueba, conDetalleDeProducto = true) {
  const montaje = await montarVista(VistaControl, {
    aplicacion: tienda.app,
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

async function elegir(s: DOMWrapper<Element>, opcion: string): Promise<void> {
  const radio = s.findAll('[role="radio"]').find((r) => texto(r) === opcion)
  if (!radio) throw new Error(`No está la opción "${opcion}"`)
  await radio.trigger('click')
  await esperarCarga()
}

describe('Control (Torre de control)', () => {
  it('04-torre-de-control: muestra las siete secciones en el orden de la spec, con el título Control', async () => {
    const { envoltura } = await abrirControl(new TiendaDePrueba())
    expect(texto(envoltura.get('h1'))).toBe('Control')
    expect(envoltura.findAll('section h2').map(texto)).toEqual([
      'Resumen',
      'Atención',
      'Para comprar',
      'Más vendidos',
      'Semana contra semana',
      'Mejor día de la semana',
      'Productos parados',
    ])
  })

  describe('Resumen', () => {
    async function tiendaDelResumen() {
      // RN-AN-02 (feature) más una venta de ayer.
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' }, '2026-08-01 08:00')
      await tienda.vender('Lejía 1 L', '2', '2026-10-14 17:00')
      await tienda.vender('Lejía 1 L', '4')
      await tienda.merma('Lejía 1 L', '1')
      await tienda.contar('Lejía 1 L', '12')
      return tienda
    }

    it('RN-AN-02 / RN-AN-03: hoy, con ganancia, ventas, costo, pérdidas y las diferencias de conteo aparte', async () => {
      const { envoltura } = await abrirControl(await tiendaDelResumen())
      const resumen = seccion(envoltura, 'Resumen')
      expect(texto(resumen.get('[role="radio"][aria-checked="true"]'))).toBe('Hoy')
      expect(texto(resumen.get('.tarjeta-de-cifra'))).toBe('Hoy ganaste S/ 2.00 Vendiste S/ 14.00')
      expect(resumen.findAll('.cifras .fila-de-dato').map(texto)).toEqual([
        'Ventas S/ 14.00',
        'Costo de lo vendido S/ 9.60',
        'Pérdidas (se dañó, se derramó o se venció) S/ 2.40',
      ])
      const aparte = resumen.get('.aparte')
      expect(texto(aparte.get('.fila-de-dato'))).toBe('Diferencias de conteo -S/ 2.40')
      expect(texto(aparte)).toContain('No cambia la ganancia')
    })

    it('RN-AN-03: al elegir otro periodo cambian las cifras', async () => {
      const { envoltura } = await abrirControl(await tiendaDelResumen())
      const resumen = seccion(envoltura, 'Resumen')
      await elegir(resumen, 'Ayer')
      expect(texto(resumen.get('.tarjeta-de-cifra'))).toBe('Ayer ganaste S/ 2.20 Vendiste S/ 7.00')
      await elegir(resumen, '7 días')
      expect(texto(resumen.get('.tarjeta-de-cifra'))).toBe(
        'En 7 días ganaste S/ 4.20 Vendiste S/ 21.00',
      )
      await elegir(resumen, '30 días')
      expect(texto(resumen.get('.tarjeta-de-cifra'))).toBe(
        'En 30 días ganaste S/ 4.20 Vendiste S/ 21.00',
      )
    })

    it('una pérdida se dice como pérdida, y un periodo sin ventas lo dice', async () => {
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' }, '2026-08-01 08:00')
      await tienda.merma('Lejía 1 L', '1')
      const { envoltura } = await abrirControl(tienda)
      const cifra = seccion(envoltura, 'Resumen').get('.tarjeta-de-cifra')
      expect(texto(cifra)).toBe('Hoy perdiste S/ 2.40 Todavía no hay ventas hoy')
      expect(cifra.classes()).toContain('tarjeta-de-cifra--peligro')
    })
  })

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
      const { envoltura } = await abrirControl(tienda)
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
      const { envoltura } = await abrirControl(await tiendaConAtencion(), false)
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
      const { envoltura } = await abrirControl(tienda)
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
      const { envoltura, router } = await abrirControl(tienda)
      const paraComprar = seccion(envoltura, 'Para comprar')
      expect(paraComprar.findAll('.fila-de-dato').map(texto)).toEqual([
        'Bolsas 1 unid.',
        'Jabón 4 unid.',
        'Total estimado S/ 4.85',
      ])
      expect(texto(paraComprar.get('.cuantos'))).toBe('2 productos')

      const boton = (nombre: string) =>
        paraComprar.findAll('button').find((b) => texto(b) === nombre)!
      await boton('Ver la lista para comprar').trigger('click')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('para-comprar')

      await router.push('/control')
      await boton('¿Necesito comprar?').trigger('click')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('necesito-comprar')
    })

    it('RN-UX-10: sin nada que comprar lo dice, y "¿Necesito comprar?" sigue a mano', async () => {
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' })
      const { envoltura } = await abrirControl(tienda)
      const paraComprar = seccion(envoltura, 'Para comprar')
      expect(texto(paraComprar)).toContain('No hace falta comprar nada por ahora')
      expect(paraComprar.findAll('button').map(texto)).toEqual(['¿Necesito comprar?'])
    })

    it('la lista larga se resume en los tres primeros y cuántos más hay', async () => {
      const tienda = new TiendaDePrueba()
      for (const nombre of ['Producto A', 'Producto B', 'Producto C', 'Producto D', 'Producto E']) {
        await tienda.producto({ nombre, compra: '1.00', venta: '2.00', minimo: '1' })
      }
      const { envoltura } = await abrirControl(tienda)
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

  describe('Más vendidos', () => {
    it('RN-AN-09: por veces vendido y por ganancia, con la cantidad vendida', async () => {
      const tienda = new TiendaDePrueba()
      for (const p of [LEJIA, CARBON, JABON]) {
        await tienda.producto({ ...p, stockInicial: '100' }, '2026-08-01 08:00')
      }
      for (const dia of ['10', '11', '12', '13', '14']) {
        await tienda.vender('Lejía 1 L', '1', `2026-10-${dia} 10:00`)
      }
      await tienda.vender('Carbón', '5', '2026-10-12 11:00')
      await tienda.vender('Carbón', '5', '2026-10-14 11:00')
      await tienda.vender('Jabón', '1', '2026-10-11 12:00')
      await tienda.vender('Jabón', '1', '2026-10-13 12:00')
      await tienda.vender('Jabón', '1', '2026-10-15 12:00')
      // Fuera de los 7 días: solo cuenta al mirar 30.
      await tienda.vender('Jabón', '10', '2026-09-20 12:00')

      const { envoltura } = await abrirControl(tienda)
      const masVendidos = seccion(envoltura, 'Más vendidos')
      const listas = () => masVendidos.findAll('ol').map((ol) => ol.findAll('li').map(texto))
      expect(masVendidos.findAll('h3').map(texto)).toEqual([
        'Los que más se venden',
        'Los que más ganancia dejan',
      ])
      expect(listas()).toEqual([
        ['Lejía 1 L 5 veces · 5 unid.', 'Jabón 3 veces · 3 unid.', 'Carbón 2 veces · 10 kg'],
        [
          'Carbón S/ 12.50 de ganancia · 10 kg',
          'Lejía 1 L S/ 5.50 de ganancia · 5 unid.',
          'Jabón S/ 2.40 de ganancia · 3 unid.',
        ],
      ])

      await elegir(masVendidos, '30 días')
      expect(listas()[0]).toEqual([
        'Lejía 1 L 5 veces · 5 unid.',
        'Jabón 4 veces · 13 unid.',
        'Carbón 2 veces · 10 kg',
      ])
    })

    it('RN-UX-10: sin ventas, "Todavía no hay ventas esta semana" (o en los últimos 30 días)', async () => {
      const { envoltura } = await abrirControl(new TiendaDePrueba())
      const masVendidos = seccion(envoltura, 'Más vendidos')
      expect(masVendidos.find('ol').exists()).toBe(false)
      expect(texto(masVendidos)).toContain('Todavía no hay ventas esta semana')
      await elegir(masVendidos, '30 días')
      expect(texto(masVendidos)).toContain('Todavía no hay ventas en los últimos 30 días')
    })
  })

  describe('Semana contra semana y Mejor día de la semana', () => {
    async function tiendaConDosSemanas() {
      const tienda = new TiendaDePrueba()
      await tienda.producto(
        { nombre: 'Detergente', compra: '1.00', venta: '2.00', stockInicial: '100' },
        '2026-09-20 08:00',
      )
      // Semana anterior (01–07/10): S/ 20.00, ganancia S/ 10.00. Esta (08–14/10): S/ 24.00,
      // ganancia S/ 12.00 menos S/ 3.00 de pérdidas = S/ 9.00. Las dos ventas, en sábado.
      await tienda.vender('Detergente', '10', '2026-10-03 10:00')
      await tienda.vender('Detergente', '12', '2026-10-10 10:00')
      await tienda.merma('Detergente', '3', '2026-10-11 10:00')
      // Hoy no cuenta en la comparación.
      await tienda.vender('Detergente', '30')
      return tienda
    }

    it('RN-AN-12: compara esta semana con la anterior en ventas y ganancia neta', async () => {
      const { envoltura } = await abrirControl(await tiendaConDosSemanas())
      const semana = seccion(envoltura, 'Semana contra semana')
      const comparaciones = semana.findAll('.comparacion')
      expect(comparaciones.map(texto)).toEqual([
        'Ventas ▲ 20 % más Esta semana S/ 24.00 Semana anterior S/ 20.00',
        'Ganancia neta ▼ 10 % menos Esta semana S/ 9.00 Semana anterior S/ 10.00',
      ])
      // La flecha se ve pero no se lee: el texto ya dice "más" o "menos" (RN-UX-04).
      const flechas = semana.findAll('.flecha')
      expect(flechas.map((f) => [f.text(), f.attributes('aria-hidden')])).toEqual([
        ['▲', 'true'],
        ['▼', 'true'],
      ])
      expect(comparaciones[0]!.get('.cambio').classes()).toContain('cambio--sube')
      expect(comparaciones[1]!.get('.cambio').classes()).toContain('cambio--baja')
    })

    it('RN-AN-13: marca el mejor día en un gráfico de barras de lunes a domingo', async () => {
      const { envoltura } = await abrirControl(await tiendaConDosSemanas())
      const mejorDia = seccion(envoltura, 'Mejor día de la semana')
      expect(texto(mejorDia)).toContain('Tu mejor día es el sábado')
      const grafico = mejorDia.get('figure.grafico-barras')
      expect(grafico.findAll('.fila .etiqueta').map(texto)).toEqual([
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
      ])
      expect(texto(grafico.get('.fila--destacada'))).toBe('Sábado S/ 14.67')
      expect(grafico.findAll('.fila--destacada')).toHaveLength(1)
    })

    it('RN-AN-12 / RN-AN-13: sin historia suficiente dice por qué', async () => {
      const { envoltura } = await abrirControl(new TiendaDePrueba())
      expect(texto(seccion(envoltura, 'Semana contra semana'))).toContain(
        'Sin datos de la semana anterior',
      )
      const mejorDia = seccion(envoltura, 'Mejor día de la semana')
      expect(texto(mejorDia)).toContain('Necesito al menos 2 semanas de ventas para saberlo')
      expect(mejorDia.find('figure').exists()).toBe(false)
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

      const { envoltura } = await abrirControl(tienda)
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
      const { envoltura } = await abrirControl(new TiendaDePrueba())
      const parados = seccion(envoltura, 'Productos parados')
      expect(texto(parados)).toContain('Ningún producto está parado')
      expect(parados.find('.aviso-en-pagina').exists()).toBe(false)
    })
  })
})

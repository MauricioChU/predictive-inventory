import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { instanteLocal } from '@/shared/domain/fecha'
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
  it('04-torre-de-control: muestra las cinco secciones en el orden de la spec (Alquiler del local, segunda), con el título Control', async () => {
    const { envoltura } = await abrirControl(new TiendaDePrueba())
    expect(texto(envoltura.get('h1'))).toBe('Control')
    expect(envoltura.findAll('section h2').map(texto)).toEqual([
      'Resumen',
      'Alquiler del local',
      'Tus mejores productos',
      'Semana contra semana',
      'Mejor día de la semana',
    ])
  })

  it('04-torre-de-control: «N cosas para mirar» cuenta productos únicos (un agotado con precio para revisar cuenta 1)', async () => {
    const tienda = new TiendaDePrueba()
    // Agotado Y con el precio por debajo del costo: dos avisos, un solo producto.
    await tienda.producto({ nombre: 'Ácido', compra: '3.00', venta: '2.00', minimo: '3' })
    const { envoltura } = await abrirControl(tienda)
    expect(texto(envoltura.get('a.ayuda'))).toBe('Ayuda inteligente 1 cosa para mirar')
  })

  it('04-torre-de-control: al final hay un botón "Ayuda inteligente" con cuántas cosas mirar, que abre su subvista', async () => {
    const tienda = new TiendaDePrueba()
    await tienda.producto({ ...LEJIA, stockInicial: '20' }, '2026-10-01 08:00')
    await tienda.producto(BOLSAS)
    await tienda.producto({ ...JABON, stockInicial: '2' })
    await tienda.producto({ ...CERA_ROJA, stockInicial: '10' })
    const { envoltura, router } = await abrirControl(tienda)
    // Agotado + queda poco + precio para revisar: 3 cosas. Atención, Para comprar y Parados ya no están aquí.
    const enlace = envoltura.get('a.ayuda')
    expect(texto(enlace)).toBe('Ayuda inteligente 3 cosas para mirar')
    expect(envoltura.findAll('section h2').map(texto)).not.toContain('Atención')
    await enlace.trigger('click')
    await esperarCarga()
    expect(router.currentRoute.value.name).toBe('ayuda-inteligente')
  })

  it('RN-AN-19: con "No pago, el local es mío" la tarjeta no se muestra y quedan las cuatro secciones', async () => {
    const tienda = new TiendaDePrueba()
    await tienda.app.tienda.actualizarConfiguracion({ alquilerDelLocal: { tipo: 'NO_PAGA' } })
    const { envoltura } = await abrirControl(tienda)
    expect(envoltura.findAll('section h2').map(texto)).toEqual([
      'Resumen',
      'Tus mejores productos',
      'Semana contra semana',
      'Mejor día de la semana',
    ])
  })

  describe('Alquiler del local', () => {
    async function tiendaConAlquiler(montoCentimos: number) {
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' }, '2026-08-01 08:00')
      await tienda.vender('Lejía 1 L', '2', '2026-10-14 17:00')
      await tienda.vender('Lejía 1 L', '4')
      await tienda.app.tienda.actualizarConfiguracion({
        alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos, dias: [20] },
      })
      return tienda
    }

    it('RN-AN-19: sin configurar pregunta "¿Pagas alquiler por tu local?" y "Configurar" abre la pantalla', async () => {
      const { envoltura, router } = await abrirControl(new TiendaDePrueba())
      const alquiler = seccion(envoltura, 'Alquiler del local')
      expect(texto(alquiler.get('.pregunta'))).toBe('¿Pagas alquiler por tu local?')
      expect(alquiler.find('[role="progressbar"]').exists()).toBe(false)
      const configurar = alquiler.findAll('button').find((b) => texto(b) === 'Configurar')!
      await configurar.trigger('click')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('alquiler-del-local')
    })

    it('RN-AN-19: con el pago por cubrir muestra cuánto llevas, la barra con su porcentaje y cuánto falta', async () => {
      const { envoltura } = await abrirControl(await tiendaConAlquiler(10000))
      const alquiler = seccion(envoltura, 'Alquiler del local')
      expect(alquiler.findAll('.linea').map(texto)).toEqual([
        'Para el pago del 20/10 llevas S/ 6.60 de S/ 100.00',
        'Te falta S/ 93.40',
      ])
      const barra = alquiler.get('[role="progressbar"]')
      expect(barra.attributes('aria-valuenow')).toBe('6')
      expect(barra.attributes('aria-valuemax')).toBe('100')
      expect(texto(alquiler.get('.barra-de-progreso .texto'))).toBe('6 %')
    })

    it('RN-AN-19: con el pago cubierto lo dice y la barra queda al 100 %', async () => {
      const { envoltura } = await abrirControl(await tiendaConAlquiler(500))
      const alquiler = seccion(envoltura, 'Alquiler del local')
      expect(alquiler.findAll('.linea').map(texto)).toEqual([
        '✓ Ya cubriste el local del 20/10',
        'Lo que ganes de más es tuyo: llevas S/ 1.60',
      ])
      expect(alquiler.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
      expect(texto(alquiler.get('.barra-de-progreso .texto'))).toBe('100 %')
    })

    it.each([
      ['2026-10-18 10:00', 'Pasado mañana pagas el local: S/ 1 200.00'],
      ['2026-10-19 10:00', 'Mañana pagas el local: S/ 1 200.00'],
      ['2026-10-20 10:00', 'Hoy pagas el local: S/ 1 200.00'],
    ])('RN-AL-10: el %s la tarjeta suma la línea del pago del local', async (cuando, frase) => {
      const tienda = await tiendaConAlquiler(120000)
      tienda.app.reloj.fijar(instanteLocal(cuando))
      const { envoltura } = await abrirControl(tienda)
      const linea = seccion(envoltura, 'Alquiler del local').get('[data-recordatorio-del-local]')
      expect(texto(linea)).toBe(frase)
      // Sin botón para cerrarla (ya no hay "Entendido").
      expect(seccion(envoltura, 'Alquiler del local').findAll('button')).toHaveLength(0)
    })

    it('RN-AL-10: fuera de la ventana la tarjeta no suma la línea', async () => {
      const { envoltura } = await abrirControl(await tiendaConAlquiler(120000))
      expect(
        seccion(envoltura, 'Alquiler del local').find('[data-recordatorio-del-local]').exists(),
      ).toBe(false)
    })

    it('RN-AN-19: "Cambiar" es un enlace que abre la pantalla del alquiler', async () => {
      const { envoltura, router } = await abrirControl(await tiendaConAlquiler(10000))
      const cambiar = seccion(envoltura, 'Alquiler del local')
        .findAll('a')
        .find((a) => texto(a) === 'Cambiar')!
      expect(cambiar.attributes('href')).toBe('/control/alquiler')
      await cambiar.trigger('click')
      await esperarCarga()
      expect(router.currentRoute.value.name).toBe('alquiler-del-local')
    })
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
      // Como Inicio: lo cobrado (principal) y debajo la ganancia real.
      expect(resumen.findAll('.tarjeta-de-cifra').map(texto)).toEqual([
        'Total vendido S/ 14.00',
        'Ganancia real S/ 2.00',
      ])
      expect(resumen.findAll('.cifras .fila-de-dato').map(texto)).toEqual([
        'Costo de lo vendido S/ 9.60',
        'Pérdidas S/ 2.40',
      ])
      const aparte = resumen.get('.aparte')
      expect(texto(aparte.get('.fila-de-dato'))).toBe('Diferencias de conteo -S/ 2.40')
      expect(texto(aparte)).toContain('No cambia la ganancia')
    })

    it('RN-AN-03: al elegir otro periodo cambian las cifras, con los mismos rótulos', async () => {
      const { envoltura } = await abrirControl(await tiendaDelResumen())
      const resumen = seccion(envoltura, 'Resumen')
      const cifras = () => resumen.findAll('.tarjeta-de-cifra').map(texto)
      await elegir(resumen, 'Ayer')
      expect(cifras()).toEqual(['Total vendido S/ 7.00', 'Ganancia real S/ 2.20'])
      await elegir(resumen, '7 días')
      expect(cifras()).toEqual(['Total vendido S/ 21.00', 'Ganancia real S/ 4.20'])
      await elegir(resumen, '30 días')
      expect(cifras()).toEqual(['Total vendido S/ 21.00', 'Ganancia real S/ 4.20'])
    })

    it('una pérdida se dice como pérdida, y un periodo sin ventas lo dice', async () => {
      const tienda = new TiendaDePrueba()
      await tienda.producto({ ...LEJIA, stockInicial: '20' }, '2026-08-01 08:00')
      await tienda.merma('Lejía 1 L', '1')
      const { envoltura } = await abrirControl(tienda)
      const cifras = seccion(envoltura, 'Resumen').findAll('.tarjeta-de-cifra')
      expect(cifras.map(texto)).toEqual([
        'Total vendido S/ 0.00 Todavía no hay ventas hoy',
        'Pérdida real S/ 2.40',
      ])
      expect(cifras[1]!.classes()).toContain('tarjeta-de-cifra--peligro')
    })

    it('sin ventas ni pérdidas solo se ve el total, con "Todavía no hay ventas hoy"', async () => {
      const { envoltura } = await abrirControl(new TiendaDePrueba())
      const cifras = seccion(envoltura, 'Resumen').findAll('.tarjeta-de-cifra')
      expect(cifras.map(texto)).toEqual(['Total vendido S/ 0.00 Todavía no hay ventas hoy'])
    })
  })

  describe('Tus mejores productos', () => {
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
      const masVendidos = seccion(envoltura, 'Tus mejores productos')
      // Un solo bloque y una sola lista a la vez: un selector alterna entre los dos top 5.
      const lista = () => masVendidos.findAll('ol li').map(texto)
      expect(masVendidos.findAll('ol')).toHaveLength(1)
      expect(texto(masVendidos.get('h3'))).toBe('Los que más se venden')
      expect(lista()).toEqual([
        'Lejía 1 L 5 veces · 5 unid.',
        'Jabón 3 veces · 3 unid.',
        'Carbón 2 veces · 10 kg',
      ])

      await elegir(masVendidos, 'Más ganancia')
      expect(masVendidos.findAll('ol')).toHaveLength(1)
      expect(texto(masVendidos.get('h3'))).toBe('Los que más ganancia dejan')
      expect(lista()).toEqual([
        'Carbón S/ 12.50 de ganancia · 10 kg',
        'Lejía 1 L S/ 5.50 de ganancia · 5 unid.',
        'Jabón S/ 2.40 de ganancia · 3 unid.',
      ])

      await elegir(masVendidos, 'Más vendidos')
      await elegir(masVendidos, '30 días')
      expect(lista()).toEqual([
        'Lejía 1 L 5 veces · 5 unid.',
        'Jabón 4 veces · 13 unid.',
        'Carbón 2 veces · 10 kg',
      ])
    })

    it('RN-UX-10: sin ventas, "Todavía no hay ventas esta semana" (o en los últimos 30 días)', async () => {
      const { envoltura } = await abrirControl(new TiendaDePrueba())
      const masVendidos = seccion(envoltura, 'Tus mejores productos')
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

    it('RN-AN-12: compara esta semana con la anterior en ventas y ganancia neta, un gráfico a la vez', async () => {
      const { envoltura } = await abrirControl(await tiendaConDosSemanas())
      const semana = seccion(envoltura, 'Semana contra semana')
      // Un selector (Ventas / Ganancia) alterna los dos gráficos: se ve uno solo.
      expect(semana.findAll('[role="radio"]').map(texto)).toEqual(['Ventas', 'Ganancia'])
      expect(semana.findAll('.comparacion')).toHaveLength(1)
      // Cada métrica: el cambio dicho con palabras y un gráfico de dos barras (esta semana y la anterior).
      let comparacion = semana.get('.comparacion')
      expect(texto(comparacion.get('.cambio'))).toBe('▲ 20 % más')
      expect(comparacion.findAll('.fila').map(texto)).toEqual([
        'Esta semana S/ 24.00',
        'Semana anterior S/ 20.00',
      ])
      // Accesible: el gráfico trae su tabla para el lector de pantalla, y la semana actual se
      // marca además del color (borde).
      expect(comparacion.findAll('table tbody tr').map(texto)).toEqual([
        'Esta semana (destacada) S/ 24.00',
        'Semana anterior S/ 20.00',
      ])
      expect(comparacion.findAll('.fila--destacada')).toHaveLength(1)
      // La flecha se ve pero no se lee: el texto ya dice "más" o "menos" (RN-UX-04).
      const flecha = semana.get('.flecha')
      expect([flecha.text(), flecha.attributes('aria-hidden')]).toEqual(['▲', 'true'])
      expect(comparacion.get('.cambio').classes()).toContain('cambio--sube')

      await elegir(semana, 'Ganancia')
      expect(semana.findAll('.comparacion')).toHaveLength(1)
      comparacion = semana.get('.comparacion')
      expect(texto(comparacion.get('h3'))).toBe('Ganancia neta')
      expect(texto(comparacion.get('.cambio'))).toBe('▼ 10 % menos')
      expect(comparacion.findAll('.fila').map(texto)).toEqual([
        'Esta semana S/ 9.00',
        'Semana anterior S/ 10.00',
      ])
      expect(comparacion.get('.cambio').classes()).toContain('cambio--baja')
    })

    it('RN-AN-13: marca el mejor día en un gráfico de barras verticales de lunes a domingo', async () => {
      const { envoltura } = await abrirControl(await tiendaConDosSemanas())
      const mejorDia = seccion(envoltura, 'Mejor día de la semana')
      expect(texto(mejorDia)).toContain('Tu mejor día es el sábado')
      // Ronda 1: vale también para una tienda con menos de 8 semanas de historia.
      expect(texto(mejorDia.get('.nota'))).toBe('Promedio por día de la semana, sin contar hoy.')
      const grafico = mejorDia.get('figure.grafico-columnas')
      expect(grafico.findAll('.columna .etiqueta').map(texto)).toEqual([
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
      ])
      expect(texto(grafico.get('.columna--destacada .etiqueta'))).toBe('Sábado')
      expect(texto(grafico.get('.columna--destacada .valor'))).toBe('S/ 14.67')
      expect(grafico.findAll('.columna--destacada')).toHaveLength(1)
      // Accesible: región con nombre que el teclado alcanza y tabla solo-lector con los siete días.
      expect(grafico.get('[role="region"]').attributes('tabindex')).toBe('0')
      expect(grafico.findAll('table tbody tr')).toHaveLength(7)
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
})

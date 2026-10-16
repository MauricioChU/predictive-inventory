import { expect } from 'vitest'
import type { Periodo, TorreDeControl } from '@/modules/analisis'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal, sumarDias } from '@/shared/domain/fecha'
import { formatearCantidad, formatearDinero, formatearNumero } from '@/shared/domain/formato'
import type { ArgumentoExtra } from '../../gherkin/registro-de-pasos'
import type { Mundo } from './mundo'
import {
  accion,
  afirmacion,
  celda,
  declaracion,
  filasDe,
  lista,
  preparacion,
  type Pasos,
} from './registro'

/** RN-AN-03: el selector de periodo del Resumen. */
const PERIODOS: Record<string, Periodo> = {
  Hoy: 'HOY',
  Ayer: 'AYER',
  'Últimos 7 días': '7_DIAS',
  'Últimos 30 días': '30_DIAS',
}

/** RN-AN-09: "7 días" / "30 días". */
const PERIODOS_DE_MAS_VENDIDOS: Record<string, 7 | 30> = { '7 días': 7, '30 días': 30 }

/** RN-AN-02: los conceptos del Resumen, como los nombra la spec 04. */
const CONCEPTOS_DEL_RESUMEN = {
  Ventas: 'ventas',
  'Costo de lo vendido': 'costoVendido',
  'Ganancia bruta': 'gananciaBruta',
  'Pérdidas por merma': 'mermas',
  'Ganancia neta': 'gananciaNeta',
  'Diferencias de conteo': 'diferenciasDeConteo',
} as const

/** Las tarjetas de Control en el orden de la spec 04, y el dato de la Torre que muestra cada una. */
const SECCIONES_DE_CONTROL: Record<string, keyof TorreDeControl> = {
  Resumen: 'resumen',
  Atención: 'atencion',
  'Para comprar': 'paraComprar',
  'Más vendidos': 'masVendidos',
  'Semana contra semana': 'semana',
  'Mejor día de la semana': 'mejorDia',
  'Productos parados': 'parados',
}

/**
 * RN-AN-06 (M10): "la lista para comprar tiene: producto, sugerido" no dice ni el stock ni la
 * venta. Se usan los mismos datos de los Ejemplos de RN-AN-06 del propio `.feature` (stock,
 * mínimo 3 y venta promedio diaria que dan exactamente esa cantidad sugerida), que además
 * dejan el orden de la tabla (Lejía queda poco, Carbón está bien).
 */
const DATOS_DE_RN_AN_06: { producto: string; sugerido: string; stock: string; vpd: string }[] = [
  { producto: 'Lejía 1 L', sugerido: '12', stock: '5', vpd: '2' },
  { producto: 'Lejía 1 L', sugerido: '11', stock: '4', vpd: '1.6' },
  { producto: 'Carbón', sugerido: '1.5', stock: '7', vpd: '0.75' },
  { producto: 'Carbón', sugerido: '0.5', stock: '6.4', vpd: '0.5' },
]

async function situacionDe(m: Mundo, nombre: string) {
  const situacion = await m.app.analisis.consultable.situacion(await m.idDe(nombre))
  if (!situacion) throw new Error(`"${nombre}" no tiene situación (¿archivado?)`)
  return situacion
}

async function prediccionDe(m: Mundo, nombre: string) {
  const { prediccion } = await situacionDe(m, nombre)
  if (!prediccion) throw new Error(`"${nombre}" no tiene predicción`)
  return prediccion
}

/** Alta de stock en ese día, como la registra Catálogo al crear el producto (RN-CAT-08). */
async function stockInicialDesde(m: Mundo, nombre: string, stock: string, fecha: string) {
  const producto = await m.producto(nombre)
  const cantidad = Cantidad.deTexto(stock, producto.unidad)
  await m.app.sinEventos(() =>
    m.enElPasado(instanteLocal(`${fecha} 08:00`), () =>
      m.historia.darDeAlta(producto, cantidad, true),
    ),
  )
}

/** Pasos de la Torre de control (04-torre-de-control, RN-AN). */
export function pasosDeTorre(pasos: Pasos): void {
  // ───────────── Historia ─────────────

  preparacion(
    pasos,
    '(que ){string} tiene stock inicial {string} desde {string}',
    (m: Mundo, nombre: string, stock: string, fecha: string) =>
      stockInicialDesde(m, nombre, stock, fecha),
  )

  preparacion(
    pasos,
    '(que )todos los productos tienen stock inicial {string} desde {string}',
    async (m: Mundo, stock: string, fecha: string) => {
      for (const producto of await m.app.catalogo.consultable.productos({ soloActivos: true })) {
        await stockInicialDesde(m, producto.nombre, stock, fecha)
      }
    },
  )

  // Ventas reales con el reloj en cada fecha, de la más antigua a la más reciente.
  preparacion(pasos, 'el historial de ventas:', async (m: Mundo, extra: ArgumentoExtra) => {
    const filas = [...filasDe(extra)].sort((a, b) =>
      celda(a, 'fecha') < celda(b, 'fecha') ? -1 : 1,
    )
    await m.app.sinEventos(async () => {
      for (const fila of filas) {
        const productoId = await m.idDe(celda(fila, 'producto'))
        await m.enElPasado(instanteLocal(celda(fila, 'fecha')), () =>
          m.app.inventario.registrarVenta({
            lineas: [{ productoId, cantidad: celda(fila, 'cantidad') }],
          }),
        )
      }
    })
  })

  declaracion(
    pasos,
    '(que ){string} tiene su primer movimiento el {string}',
    (m: Mundo, nombre: string, fecha: string) => {
      m.historia.de(nombre).primerMovimiento = fecha
    },
  )

  declaracion(
    pasos,
    '{string} vendió {string} entre {string} y {string}',
    async (m: Mundo, nombre: string, total: string, desde: string, hasta: string) => {
      const { unidad } = await m.producto(nombre)
      m.historia.de(nombre).ventas.push({ total: Cantidad.deTexto(total, unidad), desde, hasta })
    },
  )

  declaracion(
    pasos,
    '{string} vendió {string} en los últimos {string} días válidos',
    async (m: Mundo, nombre: string, total: string, dias: string) => {
      const { unidad } = await m.producto(nombre)
      m.historia.de(nombre).ventas.push({
        total: Cantidad.deTexto(total, unidad),
        desde: sumarDias(m.dia, -Number(dias)),
        hasta: sumarDias(m.dia, -1),
      })
    },
  )

  declaracion(
    pasos,
    '{string} estuvo agotado todo el día durante {string} días entre {string} y {string}',
    (m: Mundo, nombre: string, dias: string, desde: string, hasta: string) => {
      m.historia.de(nombre).agotado = { dias: Number(dias), desde, hasta }
    },
  )

  // RN-AN-14: el bloque k (0 = el más antiguo) son los 7 días que empiezan en hoy − 7·(8 − k).
  // Lo de cada bloque se vende entre su PRIMER y su ÚLTIMO día (mitad y mitad): si los bloques
  // de la tendencia se corrieran un día hacia cualquier lado, una de las dos ventas cambiaría de
  // bloque y el escenario fallaría.
  declaracion(
    pasos,
    '{string} vendió por bloques de 7 días completos, del más antiguo al más reciente: {string}',
    async (m: Mundo, nombre: string, bloques: string) => {
      const { unidad } = await m.producto(nombre)
      const paso = unidad === 'UNIDAD' ? 1000 : 1 // milésimas: 1 unidad, o 0.001 kg / L
      const valores = lista(bloques)
      valores.forEach((valor, k) => {
        const total = Cantidad.deTexto(valor, unidad).milesimas
        const primero = sumarDias(m.dia, -7 * (valores.length - k))
        const mitad = Math.floor(total / 2 / paso) * paso
        const partes = [
          { dia: primero, cantidad: mitad },
          { dia: sumarDias(primero, 6), cantidad: total - mitad },
        ]
        for (const { dia, cantidad } of partes) {
          if (cantidad === 0) continue
          m.historia
            .de(nombre)
            .ventas.push({ total: Cantidad.deMilesimas(cantidad), desde: dia, hasta: dia })
        }
      })
    },
  )

  declaracion(
    pasos,
    '(que ){string} tiene venta promedio diaria {string}',
    (m: Mundo, nombre: string, vpd: string) => {
      m.historia.de(nombre).ventaDiaria = Cantidad.deTexto(vpd, 'KILO')
    },
  )

  declaracion(
    pasos,
    '(que ){string} tiene stock {string} y venta promedio diaria {string}',
    (m: Mundo, nombre: string, stock: string, vpd: string) =>
      m.historia.declararEstado(nombre, stock, vpd),
  )

  declaracion(
    pasos,
    '(que ){string} tiene stock {string}, stock mínimo {string} y venta promedio diaria {string}',
    async (m: Mundo, nombre: string, stock: string, minimo: string, vpd: string) => {
      const respuesta = await m.app.catalogo.editarProducto({
        productoId: await m.idDe(nombre),
        stockMinimo: minimo,
      })
      if (respuesta.tipo !== 'hecho') throw new Error(`No se cambió el mínimo de "${nombre}"`)
      await m.historia.declararEstado(nombre, stock, vpd)
    },
  )

  declaracion(pasos, 'el estado de los productos:', async (m: Mundo, extra: ArgumentoExtra) => {
    for (const fila of filasDe(extra)) {
      await m.historia.declararEstado(
        celda(fila, 'producto'),
        celda(fila, 'stock'),
        celda(fila, 'vpd'),
      )
    }
  })

  // Dinero de la tienda (M13): ventas reales de productos auxiliares (historia.ts).
  preparacion(
    pasos,
    '(que )entre {string} y {string} se vendió {string} con ganancia neta {string}',
    (m: Mundo, desde: string, hasta: string, ventas: string, neta: string) =>
      m.historia.ventaDeLaTienda(desde, hasta, ventas, neta),
  )

  preparacion(pasos, '(que )hoy se vendió {string}', (m: Mundo, ventas: string) =>
    m.historia.ventaDeLaTienda(m.dia, m.dia, ventas, ventas),
  )

  preparacion(
    pasos,
    '(que )la tienda tiene su primera operación el {string}',
    (m: Mundo, dia: string) => m.historia.primeraOperacionDeLaTienda(dia),
  )

  preparacion(
    pasos,
    'en los 56 días completos anteriores a hoy se vendió {string} cada día, {string} cada sábado y nada los domingos',
    (m: Mundo, diario: string, sabado: string) =>
      m.historia.ventasPorDiaDeLaSemana(56, diario, sabado),
  )

  // ───────────── Predicción (RN-AN-04/05/06) ─────────────

  afirmacion(pasos, '{string} no tiene predicción', async (m: Mundo, nombre: string) => {
    expect((await situacionDe(m, nombre)).prediccion).toBeNull()
  })

  afirmacion(
    pasos,
    'los días válidos de {string} son {string}',
    async (m: Mundo, nombre: string, dias: string) => {
      expect((await prediccionDe(m, nombre)).diasValidos).toBe(Number(dias))
    },
  )

  // VPD = vendido ÷ días válidos, comparada como fracción exacta (sin redondear).
  afirmacion(
    pasos,
    'la venta promedio diaria de {string} es {string}',
    async (m: Mundo, nombre: string, vpd: string) => {
      const { vendido, diasValidos } = await prediccionDe(m, nombre)
      expect(Cantidad.deTexto(vpd, 'KILO').milesimas * diasValidos).toBe(vendido.milesimas)
    },
  )

  afirmacion(
    pasos,
    'los días de cobertura de {string} son {string}',
    async (m: Mundo, nombre: string, dias: string) => {
      expect((await situacionDe(m, nombre)).diasDeCobertura).toBe(Number(dias))
    },
  )

  afirmacion(
    pasos,
    '{string} tiene {string} venta en los últimos 7 días',
    async (m: Mundo, nombre: string, veces: string) => {
      const porProducto = await m.app.analisis.consultable.vecesVendido(sumarDias(m.dia, -6), m.dia)
      expect(porProducto.get(await m.idDe(nombre)) ?? 0).toBe(Number(veces))
    },
  )

  // RN-AN-05: el texto de cobertura del detalle del producto.
  afirmacion(
    pasos,
    '{string} muestra {string}',
    async (m: Mundo, nombre: string, texto: string) => {
      expect((await m.app.analisis.detalleDeProducto(await m.idDe(nombre)))?.textoCobertura).toBe(
        texto,
      )
    },
  )

  afirmacion(
    pasos,
    'la cantidad sugerida de {string} es {string}',
    async (m: Mundo, nombre: string, sugerida: string) => {
      const situacion = await situacionDe(m, nombre)
      expect(situacion.enListaParaComprar).toBe(true)
      expect(
        situacion.cantidadSugerida &&
          formatearCantidad(situacion.cantidadSugerida, situacion.unidad),
      ).toBe(sugerida)
    },
  )

  // ───────────── Para comprar (RN-AN-07/08) ─────────────

  afirmacion(pasos, 'la lista para comprar es:', async (m: Mundo, extra: ArgumentoExtra) => {
    const lista = await m.app.analisis.listaParaComprar()
    expect(
      lista.lineas.map((l) => ({
        producto: l.nombre,
        estado: l.estado,
        sugerido: formatearCantidad(l.cantidad, l.unidad),
        costo: formatearDinero(l.costoEstimado),
      })),
    ).toEqual(
      filasDe(extra).map((fila) => ({
        producto: celda(fila, 'producto'),
        estado: celda(fila, 'estado'),
        sugerido: celda(fila, 'sugerido'),
        costo: celda(fila, 'costo'),
      })),
    )
    // Control muestra la misma lista (RN-AN-15: una sola lectura).
    expect((await m.app.analisis.consultarTorre()).paraComprar).toEqual(lista)
  })

  afirmacion(pasos, 'el total estimado es {string}', async (m: Mundo, total: string) => {
    expect(formatearDinero((await m.app.analisis.listaParaComprar()).total)).toBe(total)
  })

  preparacion(
    pasos,
    '(que )la lista para comprar tiene:',
    async (m: Mundo, extra: ArgumentoExtra) => {
      const filas = filasDe(extra)
      for (const fila of filas) {
        const producto = celda(fila, 'producto')
        const sugerido = celda(fila, 'sugerido')
        const datos = DATOS_DE_RN_AN_06.find(
          (d) => d.producto === producto && d.sugerido === sugerido,
        )
        if (!datos) throw new Error(`No hay datos de RN-AN-06 para ${producto} → ${sugerido}`)
        await m.historia.declararEstado(producto, datos.stock, datos.vpd)
      }
      await m.historia.materializar()

      // El resto de los productos, fuera de la lista: con stock por encima de su mínimo (dado de
      // alta hoy, sin predicción, como recién cargado).
      const enLaTabla = new Set(await Promise.all(filas.map((f) => m.idDe(celda(f, 'producto')))))
      for (const situacion of await m.app.analisis.consultable.situaciones()) {
        if (enLaTabla.has(situacion.productoId) || !situacion.enListaParaComprar) continue
        const producto = await m.producto(situacion.nombre)
        if (await m.app.inventario.consultable.tieneOperaciones(producto.id)) {
          throw new Error(
            `"${producto.nombre}" ya tiene movimientos: no se puede sacar de la lista`,
          )
        }
        const stock = situacion.stockMinimo.sumar(Cantidad.incrementoDe(producto.unidad))
        await m.app.sinEventos(() => m.historia.darDeAlta(producto, stock, true))
      }

      const lista = await m.app.analisis.listaParaComprar()
      expect(lista.lineas.map((l) => [l.nombre, formatearNumero(l.cantidad)])).toEqual(
        filas.map((f) => [celda(f, 'producto'), celda(f, 'sugerido')]),
      )
    },
  )

  accion(pasos, 'comparto la lista', async (m: Mundo) => {
    m.texto = await m.app.analisis.textoParaCompartir()
  })

  afirmacion(pasos, 'el texto compartido es:', (m: Mundo, extra: ArgumentoExtra) => {
    expect(m.texto).toBe(extra.texto)
  })

  accion(
    pasos,
    'cambio la cantidad de {string} en la lista a {string}',
    async (m: Mundo, nombre: string, cantidad: string) => {
      await m.app.analisis.cambiarCantidadEnLista(await m.idDe(nombre), cantidad)
    },
  )

  afirmacion(
    pasos,
    'la cantidad de {string} en la lista es {string}',
    async (m: Mundo, nombre: string, cantidad: string) => {
      const productoId = await m.idDe(nombre)
      const linea = (await m.app.analisis.listaParaComprar()).lineas.find(
        (l) => l.productoId === productoId,
      )
      expect(linea && formatearNumero(linea.cantidad)).toBe(cantidad)
    },
  )

  // RN-AN-08 (M7): "Llegó mercadería" es la pantalla Recibir, prellenada con la lista de hoy.
  afirmacion(
    pasos,
    'se abre {string} con:',
    async (m: Mundo, pantalla: string, extra: ArgumentoExtra) => {
      expect(m.abierta?.pantalla).toBe(pantalla)
      const nombres = new Map(
        (await m.app.catalogo.consultable.productos()).map((p) => [p.id, p.nombre]),
      )
      expect(
        (m.abierta?.lineas ?? []).map((l) => ({
          producto: nombres.get(l.productoId),
          cantidad: formatearNumero(l.cantidad),
          costo: formatearDinero(l.costo),
        })),
      ).toEqual(
        filasDe(extra).map((fila) => ({
          producto: celda(fila, 'producto'),
          cantidad: celda(fila, 'cantidad'),
          costo: formatearDinero(Dinero.deTexto(celda(fila, 'costo'))),
        })),
      )
    },
  )

  // ───────────── Resumen y observaciones (RN-AN-02/03, RN-AN-09 a RN-AN-14) ─────────────

  afirmacion(
    pasos,
    'el resumen de {string} es:',
    async (m: Mundo, periodo: string, extra: ArgumentoExtra) => {
      const clave = PERIODOS[periodo]
      if (!clave) throw new Error(`Periodo desconocido: "${periodo}"`)
      const resumen = await m.app.analisis.consultarResumen(clave)
      for (const fila of filasDe(extra)) {
        const concepto = celda(fila, 'concepto') as keyof typeof CONCEPTOS_DEL_RESUMEN
        expect([concepto, formatearDinero(resumen[CONCEPTOS_DEL_RESUMEN[concepto]])]).toEqual([
          concepto,
          celda(fila, 'monto'),
        ])
      }
    },
  )

  afirmacion(
    pasos,
    'las ventas de {string} son {string}',
    async (m: Mundo, periodo: string, ventas: string) => {
      const clave = PERIODOS[periodo]
      if (!clave) throw new Error(`Periodo desconocido: "${periodo}"`)
      expect(formatearDinero((await m.app.analisis.consultarResumen(clave)).ventas)).toBe(ventas)
    },
  )

  afirmacion(
    pasos,
    'los más vendidos por veces en {string} son:',
    async (m: Mundo, periodo: string, extra: ArgumentoExtra) => {
      const torre = await m.app.analisis.consultarTorre({
        periodoMasVendidos: PERIODOS_DE_MAS_VENDIDOS[periodo],
      })
      expect(
        torre.masVendidos.porVeces.map((f) => ({
          producto: f.nombre,
          veces: String(f.veces),
          cantidad: formatearCantidad(f.cantidad, f.unidad),
        })),
      ).toEqual(filasDe(extra))
    },
  )

  afirmacion(
    pasos,
    'los más vendidos por ganancia en {string} son:',
    async (m: Mundo, periodo: string, extra: ArgumentoExtra) => {
      const torre = await m.app.analisis.consultarTorre({
        periodoMasVendidos: PERIODOS_DE_MAS_VENDIDOS[periodo],
      })
      expect(
        torre.masVendidos.porGanancia.map((f) => ({
          producto: f.nombre,
          ganancia: formatearDinero(f.ganancia),
        })),
      ).toEqual(filasDe(extra))
    },
  )

  afirmacion(pasos, 'los precios para revisar son:', async (m: Mundo, extra: ArgumentoExtra) => {
    const { preciosParaRevisar } = await m.app.analisis.consultarTorre()
    expect(
      preciosParaRevisar.map((p) => ({
        producto: p.nombre,
        'pérdida por unidad': formatearDinero(p.perdidaPorUnidad),
      })),
    ).toEqual(filasDe(extra))
  })

  afirmacion(pasos, 'los productos parados son:', async (m: Mundo, extra: ArgumentoExtra) => {
    const { parados } = await m.app.analisis.consultarTorre()
    expect(
      parados.productos.map((p) => ({
        producto: p.nombre,
        stock: formatearCantidad(p.stock, p.unidad),
        'dinero inmovilizado': formatearDinero(p.dineroInmovilizado),
      })),
    ).toEqual(filasDe(extra))
  })

  afirmacion(pasos, 'el total inmovilizado es {string}', async (m: Mundo, total: string) => {
    expect(formatearDinero((await m.app.analisis.consultarTorre()).parados.total)).toBe(total)
  })

  afirmacion(pasos, 'la comparación semanal muestra:', async (m: Mundo, extra: ArgumentoExtra) => {
    const { semana } = await m.app.analisis.consultarTorre()
    if (semana.tipo !== 'comparacion') throw new Error(`La semana muestra: ${semana.mensaje}`)
    expect(
      semana.filas.map((f) => ({
        concepto: f.concepto,
        'esta semana': formatearDinero(f.actual),
        'semana anterior': formatearDinero(f.anterior),
        cambio: f.cambio,
      })),
    ).toEqual(filasDe(extra))
  })

  afirmacion(
    pasos,
    'la comparación semanal muestra {string}',
    async (m: Mundo, mensaje: string) => {
      const { semana } = await m.app.analisis.consultarTorre()
      expect(semana).toEqual({ tipo: 'sin-datos', mensaje })
    },
  )

  afirmacion(
    pasos,
    'el promedio de ventas por día de la semana es:',
    async (m: Mundo, extra: ArgumentoExtra) => {
      const { mejorDia } = await m.app.analisis.consultarTorre()
      if (mejorDia.tipo !== 'calculado') throw new Error(`El mejor día dice: ${mejorDia.mensaje}`)
      expect(
        mejorDia.promedios.map((p) => ({ día: p.dia, promedio: formatearDinero(p.promedio) })),
      ).toEqual(filasDe(extra))
    },
  )

  afirmacion(pasos, 'el mejor día es {string}', async (m: Mundo, dia: string) => {
    const { mejorDia } = await m.app.analisis.consultarTorre()
    expect(mejorDia.tipo === 'calculado' ? mejorDia.mejor : mejorDia.mensaje).toBe(dia)
  })

  afirmacion(
    pasos,
    'la tendencia de {string} es {string}',
    async (m: Mundo, nombre: string, valores: string) => {
      const detalle = await m.app.analisis.detalleDeProducto(await m.idDe(nombre))
      expect((detalle?.tendencia ?? []).map(formatearNumero)).toEqual(lista(valores))
    },
  )

  // RN-AN-15 (E13): todas las tarjetas de Control salen de una lectura local; con la red
  // cortada nadie intentó un fetch.
  afirmacion(
    pasos,
    'la Torre de control muestra las secciones {string}',
    async (m: Mundo, secciones: string) => {
      const torre = await m.app.analisis.consultarTorre()
      for (const seccion of lista(secciones)) {
        const clave = SECCIONES_DE_CONTROL[seccion]
        if (!clave) throw new Error(`Control no tiene la sección "${seccion}"`)
        expect(torre[clave], seccion).toBeDefined()
      }
      expect(lista(secciones)).toEqual(Object.keys(SECCIONES_DE_CONTROL))
      if (m.sinRed) expect(m.sinRed).not.toHaveBeenCalled()
    },
  )

  // ───────────── ¿Necesito comprar? (RN-AN-16) ─────────────

  accion(pasos, 'pregunto si necesito comprar {string}', async (m: Mundo, nombre: string) => {
    m.respuesta = (await m.app.analisis.necesitoComprar(await m.idDe(nombre))).respuesta
  })

  afirmacion(pasos, 'la respuesta es {string}', (m: Mundo, respuesta: string) => {
    expect(m.respuesta).toBe(respuesta)
  })
}

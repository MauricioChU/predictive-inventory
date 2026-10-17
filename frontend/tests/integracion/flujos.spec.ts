// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { OperacionVista } from '@/modules/inventario'
import type { Unidad } from '@/shared/domain/cantidad'
import { instanteLocal } from '@/shared/domain/fecha'
import { formatearDinero, formatearNumero } from '@/shared/domain/formato'
import { PRESENTACION_DE_ESTADO } from '@/shared/ui/presentacion-estado'
import {
  ALMACENES,
  crearAplicacionDePrueba,
  type Almacen,
  type AplicacionDePrueba,
} from '../soporte/aplicacion-de-prueba'
import { crearProductoDePrueba } from '../soporte/productos-de-prueba'

/** "Dado que hoy es 2026-10-15 10:00" (como en los `.feature`). */
const HOY = instanteLocal('2026-10-15 10:00')

/**
 * Corre el mismo flujo con memoria y con Dexie (fake-indexeddb), cada uno en una aplicación
 * nueva, y exige que los dos den EXACTAMENTE lo mismo (ids e instantes incluidos: ids
 * secuenciales y un reloj sin empates). Devuelve el resultado, para las expectativas de la regla.
 */
async function enAmbosAlmacenes<T>(flujo: (app: AplicacionDePrueba) => Promise<T>): Promise<T> {
  const resultados = new Map<Almacen, T>()
  for (const almacen of ALMACENES) {
    const app = crearAplicacionDePrueba({ ahora: HOY, almacen })
    try {
      resultados.set(almacen, await flujo(app))
    } finally {
      await app.cerrar()
    }
  }
  const memoria = resultados.get('memoria') as T
  // Estricta: mismas clases, mismas propiedades (también las `undefined`), mismos ids e instantes.
  expect(resultados.get('dexie'), 'Dexie da lo mismo que memoria').toStrictEqual(memoria)
  return memoria
}

/** Una línea legible por operación del historial (del más reciente al más antiguo). */
function enTexto(historial: readonly OperacionVista[]): string[] {
  return historial.map((o) => {
    const lineas = o.lineas.map((l) => `${l.nombre} ${formatearNumero(l.cantidad)}`).join(', ')
    const total = o.total ? ` = ${formatearDinero(o.total)}` : ''
    return `${o.id} ${o.etiqueta}: ${lineas}${total}${o.anulada ? ' (anulada)' : ''}`
  })
}

/** Para las expectativas de la regla (la paridad entre almacenes compara las líneas con su id). */
function sinIds(lineas: readonly string[]): string[] {
  return lineas.map((linea) => linea.replace(/^\S+ /, ''))
}

async function stockDe(app: AplicacionDePrueba, productoId: string): Promise<string> {
  return formatearNumero(await app.inventario.consultable.stockDe(productoId))
}

const LEJIA = { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', minimo: '3' }

describe('Integración (a): crear producto con stock inicial → vender → "Queda poco" → la torre muestra la ganancia', () => {
  it('RN-CAT-08, RN-OP-10, RN-AL-03, RN-AN-02: en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      await app.tienda.actualizarConfiguracion({ notificacionesActivas: true })
      const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '5' })
      await app.esperarTareasPendientes()
      const estadoInicial = (await app.analisis.consultable.situacion(lejia))?.estado

      const { operacionId } = await app.inventario.registrarVenta({
        lineas: [{ productoId: lejia, cantidad: '3' }],
      })
      await app.esperarTareasPendientes()

      const situacion = await app.analisis.consultable.situacion(lejia)
      const torre = await app.analisis.consultarTorre()
      return {
        estadoInicial,
        estado: situacion && PRESENTACION_DE_ESTADO[situacion.estado].texto,
        stock: await stockDe(app, lejia),
        deshacer: app.inventario.deshacer.disponible(),
        operacionId,
        notificaciones: app.notificador.mostradas,
        atencion: await app.alertas.resumenDeAtencion(),
        historial: enTexto(await app.inventario.historial()),
        torre: {
          ventas: formatearDinero(torre.resumen.ventas),
          costoVendido: formatearDinero(torre.resumen.costoVendido),
          gananciaBruta: formatearDinero(torre.resumen.gananciaBruta),
          gananciaNeta: formatearDinero(torre.resumen.gananciaNeta),
          atencion: torre.atencion,
          paraComprar: torre.paraComprar.lineas.map((l) => `${l.nombre} ${l.estado}`),
          masVendidos: torre.masVendidos.porVeces.map(
            (f) => `${f.nombre}: ${f.veces} vez, ${formatearDinero(f.ganancia)}`,
          ),
        },
      }
    })

    expect(resultado).toMatchObject({
      estadoInicial: 'NORMAL',
      estado: 'Queda poco',
      stock: '2',
      deshacer: { operacionId: resultado.operacionId, segundosRestantes: 10 },
      notificaciones: [
        { texto: 'Queda poco: Lejía 1 L (2 unid.)', url: expect.stringMatching(/^\/productos\//) },
      ],
      atencion: { agotados: 0, porAcabarse: 1, contador: 1, texto: '1 por acabarse' },
      torre: {
        ventas: 'S/ 10.50',
        costoVendido: 'S/ 7.20',
        gananciaBruta: 'S/ 3.30',
        gananciaNeta: 'S/ 3.30',
        atencion: { agotados: 0, porAcabarse: 1, preciosParaRevisar: 0 },
        paraComprar: ['Lejía 1 L POR_ACABARSE'],
        masVendidos: ['Lejía 1 L: 1 vez, S/ 3.30'],
      },
    })
    expect(resultado.historial).toEqual([
      `${resultado.operacionId} Venta: Lejía 1 L -3 = S/ 10.50`,
      expect.stringMatching(/ Stock inicial: Lejía 1 L 5$/),
    ])
  })
})

describe('Integración (b): ingreso con costo distinto de un producto parado (sobrecompra)', () => {
  it('RN-OP-20, RN-OP-14, RN-AN-11: avisa, confirma el precio y registra; en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      // Historia real con fechas pasadas: stock inicial el 17/07 y una sola venta el 31/08.
      app.reloj.fijar(instanteLocal('2026-07-17 09:00'))
      const escoba = await crearProductoDePrueba(app, {
        nombre: 'Escoba',
        compra: '6.00',
        venta: '9.00',
        minimo: '1',
        stockInicial: '5',
      })
      app.reloj.fijar(instanteLocal('2026-08-31 10:00'))
      await app.inventario.registrarVenta({ lineas: [{ productoId: escoba, cantidad: '1' }] })
      app.reloj.fijar(HOY)

      const lineas = [{ productoId: escoba, cantidad: '2', costo: '6.50' }]
      const aviso = await app.inventario.registrarIngreso({ lineas })
      const precio = await app.inventario.registrarIngreso({ lineas, confirmarSobrecompra: true })
      const hecho = await app.inventario.registrarIngreso({
        lineas,
        confirmarSobrecompra: true,
        actualizarPreciosDeCompra: true,
      })
      await app.esperarTareasPendientes()

      const producto = await app.catalogo.obtenerProducto(escoba)
      return {
        aviso,
        precio,
        hecho,
        stock: await stockDe(app, escoba),
        precioCompra: producto && formatearDinero(producto.precioCompra),
        historial: enTexto(await app.inventario.historial({ tipo: 'INGRESO' })),
        deshacer: app.inventario.deshacer.disponible()?.operacionId,
      }
    })

    expect(resultado.aviso).toEqual({
      tipo: 'aviso-sobrecompra',
      avisos: [
        {
          productoId: expect.any(String),
          mensaje: 'Escoba no se vende hace 45 días y aún tienes 4 unid.',
        },
      ],
    })
    expect(resultado.precio).toMatchObject({ tipo: 'confirmar-precios' })
    expect(resultado.hecho).toMatchObject({ tipo: 'hecho' })
    expect(resultado).toMatchObject({ stock: '6', precioCompra: 'S/ 6.50' })
    expect(resultado.historial).toEqual([expect.stringMatching(/ Llegó mercadería: Escoba 2$/)])
    expect(resultado.deshacer).toBe(
      resultado.hecho.tipo === 'hecho' ? resultado.hecho.operacionId : null,
    )
  })
})

describe('Integración (c): archivar un producto con stock', () => {
  it('RN-CAT-11, RN-AL-01: retira el stock sin ofrecer Deshacer y deja de tener estado; en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '4' })
      await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '1' }] })
      app.reloj.avanzarSegundos(15) // ya no se puede deshacer la venta
      await app.esperarTareasPendientes()
      const avisosAntes = await app.infraestructura.repositorios.avisos.todos()

      const pregunta = await app.catalogo.archivarProducto({ productoId: lejia })
      const archivado = await app.catalogo.archivarProducto({
        productoId: lejia,
        confirmado: true,
      })
      await app.esperarTareasPendientes()

      return {
        pregunta,
        archivado,
        stock: await stockDe(app, lejia),
        activo: (await app.catalogo.obtenerProducto(lejia))?.activo,
        deshacer: app.inventario.deshacer.disponible(),
        historial: enTexto(await app.inventario.historial()),
        situaciones: await app.analisis.consultable.situaciones(),
        avisosAntes: avisosAntes.map((a) => a.ultimoEstadoAvisado),
        avisos: await app.infraestructura.repositorios.avisos.todos(),
        archivados: (await app.catalogo.buscarProductos({ texto: 'lejia', archivados: true })).map(
          (p) => p.nombre,
        ),
      }
    })

    expect(resultado).toMatchObject({
      pregunta: { tipo: 'confirmar', mensaje: 'Aún quedan 3 unid. ¿Las retiramos del stock?' },
      archivado: { tipo: 'hecho' },
      stock: '0',
      activo: false,
      deshacer: null,
      situaciones: [],
      avisosAntes: ['POR_ACABARSE'],
      avisos: [],
      archivados: ['Lejía 1 L'],
    })
    expect(resultado.historial[0]).toMatch(/ Producto retirado: Lejía 1 L -3$/)
  })
})

describe('Integración (d): guardar copia → vender → restaurar', () => {
  it('RN-RE-02, RN-RE-03, RN-RE-04: el stock, el historial y la configuración vuelven a los de la copia; en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      await app.tienda.completarPrimeraVez({
        nombreTienda: 'Bodega Rosita',
        tamanoDeLetra: 'GRANDE',
      })
      const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })
      const carbon = await crearProductoDePrueba(app, {
        nombre: 'Carbón',
        unidad: 'KILO' as Unidad,
        compra: '2.75',
        venta: '4.00',
        minimo: '3',
        stockInicial: '5.5',
      })
      await app.esperarTareasPendientes()
      const archivo = await app.respaldo.guardarCopia()
      await app.respaldo.marcarCopiaGuardada()
      const copia = await archivo.contenido.text()
      const sistemaAntes = await app.tienda.consultable.estadoDelSistema()

      await app.inventario.registrarVenta({
        lineas: [
          { productoId: lejia, cantidad: '4' },
          { productoId: carbon, cantidad: '1.5' },
        ],
      })
      await app.tienda.actualizarConfiguracion({ tamanoDeLetra: 'MUY_GRANDE' })
      const ventasAntesDeRestaurar = (await app.analisis.consultarResumen('HOY')).ventas

      const preparada = await app.respaldo.prepararRestauracion(copia)
      const conUnaConfirmacion = await app.respaldo
        .restaurarCopia(copia, { confirmaciones: 1 })
        .catch((error: Error) => error.message)
      await app.respaldo.restaurarCopia(copia, { confirmaciones: 2 })
      await app.esperarTareasPendientes()

      return {
        nombreDelArchivo: archivo.nombre,
        resumen: preparada.resumen.texto,
        conUnaConfirmacion,
        ventasAntesDeRestaurar: formatearDinero(ventasAntesDeRestaurar),
        stock: [await stockDe(app, lejia), await stockDe(app, carbon)],
        historial: enTexto(await app.inventario.historial()),
        ventasDeHoy: formatearDinero((await app.analisis.consultarResumen('HOY')).ventas),
        configuracion: await app.tienda.obtenerConfiguracion(),
        sistemaIgual: await app.tienda.consultable.estadoDelSistema(),
        sistemaAntes,
        recordatorio: await app.respaldo.recordatorioDeCopia(),
      }
    })

    expect(resultado).toMatchObject({
      nombreDelArchivo: 'respaldo-bodega-rosita-2026-10-15-1000.json',
      conUnaConfirmacion: 'Confirma dos veces para restaurar',
      ventasAntesDeRestaurar: 'S/ 20.00',
      stock: ['10', '5.5'],
      ventasDeHoy: 'S/ 0.00',
      configuracion: { nombreTienda: 'Bodega Rosita', tamanoDeLetra: 'GRANDE' },
      recordatorio: null,
    })
    expect(sinIds(resultado.historial)).toEqual([
      'Stock inicial: Carbón 5.5',
      'Stock inicial: Lejía 1 L 10',
    ])
    expect(resultado.resumen).toContain('2 productos')
    // El estado del sistema (dispositivo, último respaldo) no viaja en la copia: queda igual.
    expect(resultado.sistemaIgual).toEqual(resultado.sistemaAntes)
  })
})

describe('Integración (e): importar productos desde Excel', () => {
  it('RN-RE-07, RN-RE-08, RN-CAT-08: crea las filas válidas con su stock inicial y explica las otras; en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      await app.catalogo.sembrarCategoriasIniciales()
      await crearProductoDePrueba(app, { nombre: 'Escoba', compra: '6.00', venta: '9.00' })
      app.lectorDeExcel.fijarFilas([
        [
          'nombre',
          'categoría',
          'unidad',
          'precio de compra',
          'precio de venta',
          'stock mínimo',
          'stock inicial',
        ],
        ['Lejía 1 L', 'Lejías y desinfectantes', 'unid', '2.40', '3.50', '3', '12'],
        ['Carbón', 'Carbón y combustibles', 'kg', '2.75', '4.00', '3', '10.5'],
        ['Bolsa de papel', 'Empaques', 'unid', '0.10', '0.20', '50', ''],
        ['Vela', 'Empaques', 'unid', '0.50', '1.00', '5', '20'],
        ['escoba', 'Otros', 'unid', '6.00', '9.00', '1', '3'],
        ['Detergente', 'Detergentes y jabones', 'caja', '5.30', '7.90', '2', '5'],
      ])

      const previsualizacion = await app.respaldo.previsualizarImportacion(new Blob())
      const { importados } = await app.respaldo.confirmarImportacion(previsualizacion)
      await app.esperarTareasPendientes()

      const productos = await app.catalogo.buscarProductos({ texto: '' })
      return {
        validas: previsualizacion.validas.map((v) => v.fila),
        problemas: previsualizacion.conProblemas.map((p) => p.problema),
        importados,
        productos: productos.map(
          (p) => `${p.nombre} (${p.categoriaNombre}): ${formatearNumero(p.stock)}`,
        ),
        categoriasEmpaques: (await app.catalogo.listarCategorias()).filter(
          (c) => c.nombre === 'Empaques',
        ).length,
        historial: enTexto(await app.inventario.historial()),
        deshacer: app.inventario.deshacer.disponible(),
        atencion: (await app.alertas.resumenDeAtencion()).texto,
      }
    })

    expect(resultado).toMatchObject({
      validas: [2, 3, 4, 5],
      importados: 4,
      categoriasEmpaques: 1,
      deshacer: null,
    })
    expect(resultado.problemas).toEqual([
      'Fila 6: ya existe un producto llamado "Escoba"',
      expect.stringMatching(/^Fila 7: /),
    ])
    expect(resultado.productos).toEqual([
      'Bolsa de papel (Empaques): 0',
      'Carbón (Carbón y combustibles): 10.5',
      'Escoba (Otros): 0',
      'Lejía 1 L (Lejías y desinfectantes): 12',
      'Vela (Empaques): 20',
    ])
    // Del más reciente al más antiguo: las filas se importan en orden.
    expect(sinIds(resultado.historial)).toEqual([
      'Stock inicial: Vela 20',
      'Stock inicial: Carbón 10.5',
      'Stock inicial: Lejía 1 L 12',
    ])
    expect(resultado.atencion).toBe('2 agotados')
  })
})

describe('Integración (f): conteo guiado', () => {
  it('RN-OP-21, RN-OP-16: recorre, se puede seguir después, ajusta al momento y resume; en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })
      const carbon = await crearProductoDePrueba(app, {
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

      const recorrido: (string | null)[] = []
      const inicio = await app.inventario.iniciarConteoGuiado()
      recorrido.push(inicio.producto?.nombre ?? null)
      const tras10 = await app.inventario.responderConteo('10')
      recorrido.push(tras10.producto?.nombre ?? null)
      // "Seguir después" y volver: el conteo sigue donde quedó.
      const retomado = await app.inventario.conteoActual()
      const trasSaltar = await app.inventario.saltarEnConteo()
      recorrido.push(trasSaltar.producto?.nombre ?? null)
      const fin = await app.inventario.responderConteo('8')

      return {
        recorrido,
        retomado: retomado && { producto: retomado.producto?.nombre, progreso: retomado.progreso },
        fin: { terminado: fin.terminado, resumen: fin.resumen },
        stock: [await stockDe(app, lejia), await stockDe(app, carbon)],
        ajustes: enTexto(await app.inventario.historial({ tipo: 'AJUSTE' })),
        diferencias: formatearDinero(
          (await app.analisis.consultarResumen('HOY')).diferenciasDeConteo,
        ),
        enCurso: await app.inventario.conteoActual(),
      }
    })

    expect(resultado).toMatchObject({
      recorrido: ['Carbón', 'Detergente a granel', 'Lejía 1 L'],
      retomado: { producto: 'Detergente a granel', progreso: 'Llevas 1 de 3' },
      fin: {
        terminado: true,
        resumen: [
          'Contaste 2 productos. 1 con diferencia: -S/ 4.80',
          'Te faltó contar 1: Detergente a granel',
        ],
      },
      stock: ['8', '10'],
      diferencias: '-S/ 4.80',
      enCurso: null,
    })
    expect(sinIds(resultado.ajustes)).toEqual(['Conteo de stock: Lejía 1 L -2'])
  })

  it('RN-OP-18 (plan 12): deshacer la última respuesta del conteo anula su AJUSTE en la misma transacción y el producto queda en "Te faltó contar"', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })
      await app.inventario.iniciarConteoGuiado()
      const { operacionId } = await app.inventario.responderConteo('8')
      const fin = await app.inventario.deshacerRespuestaDeConteo(operacionId!)
      return {
        resumen: fin.resumen,
        stock: await stockDe(app, lejia),
        tipos: (await app.inventario.historial({ productoId: lejia })).map((o) => o.tipo),
        diferencias: formatearDinero(
          (await app.analisis.consultarResumen('HOY')).diferenciasDeConteo,
        ),
      }
    })
    expect(resultado).toEqual({
      resumen: ['No contaste ningún producto.', 'Te faltó contar 1: Lejía 1 L'],
      stock: '10',
      tipos: ['ANULACION', 'AJUSTE', 'STOCK_INICIAL'],
      diferencias: 'S/ 0.00',
    })
  })

  it('HU-OP-08 (plan 12): el detalle de una operación se lee por id, igual en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '10' })
      const { operacionId } = await app.inventario.registrarVenta({
        lineas: [{ productoId: lejia, cantidad: '2' }],
      })
      const { anulacionId } = await app.inventario.anularOperacion({ operacionId })
      const [anulacion, venta] = await app.inventario.historial({ productoId: lejia })
      return {
        venta: await app.inventario.operacion(operacionId),
        anulacion: await app.inventario.operacion(anulacionId),
        enElHistorial: { venta, anulacion },
        inexistente: await app.inventario.operacion('no-existe'),
      }
    })
    expect(resultado.venta).toEqual(resultado.enElHistorial.venta)
    expect(resultado.anulacion).toEqual(resultado.enElHistorial.anulacion)
    expect(resultado.venta?.anulada).toBe(true)
    expect(resultado.inexistente).toBeNull()
  })

  it('HU-OP-08 (plan 17): el Historial de a páginas da lo mismo que el completo, igual en memoria y en Dexie', async () => {
    const resultado = await enAmbosAlmacenes(async (app) => {
      const lejia = await crearProductoDePrueba(app, { ...LEJIA, stockInicial: '50' })
      for (let i = 0; i < 7; i += 1) {
        app.reloj.avanzarSegundos(60)
        await app.inventario.registrarVenta({ lineas: [{ productoId: lejia, cantidad: '1' }] })
      }
      // Dos ventas anotadas "ayer a las 18:30": el mismo momento, no se cortan entre páginas.
      for (let i = 0; i < 2; i += 1) {
        app.reloj.avanzarSegundos(60)
        await app.inventario.registrarVenta({
          lineas: [{ productoId: lejia, cantidad: '1' }],
          ocurridaEn: instanteLocal('2026-10-14 18:30'),
        })
      }
      const [ultima] = await app.inventario.historial({ tipo: 'VENTA' })
      await app.inventario.anularOperacion({ operacionId: ultima!.id })
      const paginas: string[][] = []
      let desde: string | undefined
      do {
        const pagina = await app.inventario.paginaDelHistorial({
          cuantas: 3,
          ...(desde ? { desde } : {}),
        })
        paginas.push(enTexto(pagina.operaciones))
        desde = pagina.siguiente ?? undefined
      } while (desde !== undefined)
      return { paginas, completo: enTexto(await app.inventario.historial()) }
    })
    expect(resultado.paginas.flat()).toEqual(resultado.completo)
    expect(resultado.paginas.length).toBeGreaterThan(2)
  })
})

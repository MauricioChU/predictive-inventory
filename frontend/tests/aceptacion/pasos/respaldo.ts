import { expect } from 'vitest'
import type { CeldaDeExcel, DatosDelRespaldo, HojaDeExcel } from '@/modules/respaldo'
import type {
  CategoriaRegistro,
  OperacionRegistro,
  ProductoRegistro,
} from '@/shared/contratos/registros'
import { Cantidad } from '@/shared/domain/cantidad'
import { diasEntre, instanteLocal, sumarDias, sumarSegundos } from '@/shared/domain/fecha'
import { normalizar } from '@/shared/domain/texto'
import type { ArgumentoExtra } from '../../gherkin/registro-de-pasos'
import { crearAplicacionDePrueba } from '../../soporte/aplicacion-de-prueba'
import { alquilerDeTextos } from './contexto'
import type { Mundo } from './mundo'
import { accion, afirmacion, celda, filasDe, lista, preparacion, type Pasos } from './registro'

/** Lo que se ve en la celda de Excel: los montos con dos decimales ("2.40"), el resto tal cual. */
function textoDeCelda(celdaDeExcel: CeldaDeExcel | undefined): string {
  if (!celdaDeExcel) return ''
  const { valor, formato } = celdaDeExcel
  if (typeof valor === 'string') return valor
  return formato === '0.00' ? valor.toFixed(2) : String(valor)
}

function hoja(m: Mundo, nombre: string): HojaDeExcel {
  const encontrada = m.archivo?.hojas?.find((h) => h.nombre === nombre)
  if (!encontrada) throw new Error(`El archivo no tiene la hoja "${nombre}"`)
  return encontrada
}

function copia(m: Mundo): {
  versionDeFormato: number
  control: { productos: number; operaciones: number; stockPorProducto: Record<string, number> }
  datos: Record<string, unknown>
} {
  if (m.textoCopia === null) throw new Error('El escenario no tiene una copia')
  return JSON.parse(m.textoCopia)
}

async function guardarCopiaDeEstaTienda(m: Mundo): Promise<string> {
  return (await m.app.respaldo.guardarCopia()).contenido.text()
}

/**
 * RN-RE-03, EXCEPCIÓN a "solo casos de uso" (M22): la copia viene de OTRO celular, con 152
 * productos y 3 840 operaciones del 01/10/2026 al 15/12/2026 (después del "hoy" del escenario:
 * RN-OP-09 no deja registrarlas aquí, y 3 840 operaciones con sus evaluaciones de avisos serían
 * lentísimas). Sus registros se generan aquí (152 STOCK_INICIAL de 100 unidades y 3 688 ventas
 * de 1, nunca stock negativo) y se cargan en la aplicación de prueba de ese otro celular con su
 * `AlmacenDeRespaldo`, como hace el test de rendimiento. El archivo de copia sí lo arma el caso
 * de uso real (`respaldo.guardarCopia()` de ese otro celular, con su control).
 */
async function copiaDeOtroCelular(
  productos: number,
  operaciones: number,
  desde: string,
  hasta: string,
): Promise<string> {
  const categoria: CategoriaRegistro = {
    id: 'cat-otros',
    nombre: 'Otros',
    nombreNormalizado: 'otros',
  }
  const creadoEn = instanteLocal(`${desde} 07:00`)
  const registros: ProductoRegistro[] = Array.from({ length: productos }, (_, i) => {
    const nombre = `Producto ${String(i + 1).padStart(3, '0')}`
    return {
      id: `otro-${i + 1}`,
      nombre,
      nombreNormalizado: normalizar(nombre),
      categoriaId: categoria.id,
      unidad: 'UNIDAD',
      precioCompra: 240,
      precioVenta: 350,
      stockMinimo: 3000,
      tieneFoto: false,
      estado: 'ACTIVO',
      creadoEn,
      actualizadoEn: creadoEn,
    }
  })
  const libro: OperacionRegistro[] = []
  const agregar = (
    tipo: 'STOCK_INICIAL' | 'VENTA',
    producto: ProductoRegistro,
    cantidad: number,
    instante: string,
  ) => {
    libro.push({
      id: `op-${libro.length + 1}`,
      tipo,
      movimientos: [
        {
          productoId: producto.id,
          cantidad,
          costoUnitario: producto.precioCompra,
          precioUnitario: tipo === 'VENTA' ? producto.precioVenta : null,
        },
      ],
      productoIds: [producto.id],
      ocurridaEn: instante,
      registradaEn: instante,
      motivo: null,
      nota: null,
      anulaA: null,
      dispositivoId: 'otro-celular',
    })
  }
  registros.forEach((producto, i) =>
    agregar('STOCK_INICIAL', producto, 100_000, sumarSegundos(instanteLocal(`${desde} 08:00`), i)),
  )
  // Ventas repartidas del día siguiente a `desde` hasta `hasta`, una cada 10 minutos desde las
  // 09:00, a cada producto por turno (a lo sumo 25 de las 100 unidades de cada uno).
  const ventas = operaciones - productos
  const dias = diasEntre(desde, hasta)
  let vendidas = 0
  for (let d = 0; d < dias; d += 1) {
    const delDia = Math.floor(ventas / dias) + (d < ventas % dias ? 1 : 0)
    const abre = instanteLocal(`${sumarDias(desde, d + 1)} 09:00`)
    for (let j = 0; j < delDia; j += 1, vendidas += 1) {
      const producto = registros[vendidas % productos]
      if (!producto) throw new Error('Producto fuera de rango')
      agregar('VENTA', producto, -1000, sumarSegundos(abre, j * 600))
    }
  }

  const otro = crearAplicacionDePrueba({ ahora: instanteLocal(`${hasta} 20:00`) })
  const datos: DatosDelRespaldo = {
    configuracion: null,
    categorias: [categoria],
    productos: registros,
    operaciones: libro,
    avisos: [],
    fotos: [],
  }
  await otro.infraestructura.almacenDeRespaldo.reemplazarTodo(datos)
  const texto = await (await otro.respaldo.guardarCopia()).contenido.text()
  await otro.cerrar()
  return texto
}

/** Pasos de Respaldo, Excel e importación (05-respaldo-e-importacion, RN-RE). */
export function pasosDeRespaldo(pasos: Pasos): void {
  accion(pasos, 'exporto a Excel', async (m: Mundo) => {
    m.archivo = await m.app.respaldo.exportarExcel()
  })

  afirmacion(pasos, 'se genera el archivo {string}', (m: Mundo, nombre: string) => {
    expect(m.archivo?.nombre).toBe(nombre)
  })

  afirmacion(pasos, 'el archivo tiene las hojas {string}', (m: Mundo, hojas: string) => {
    expect(m.archivo?.hojas?.map((h) => h.nombre)).toEqual(lista(hojas))
  })

  // RN-RE-01: la tabla nombra algunas columnas; la fila de la hoja debe coincidir en ellas.
  afirmacion(
    pasos,
    'la hoja {string} tiene la fila:',
    (m: Mundo, nombre: string, extra: ArgumentoExtra) => {
      const { columnas, filas } = hoja(m, nombre)
      const [esperada] = filasDe(extra)
      if (!esperada) throw new Error('La tabla no tiene ninguna fila')
      const comoTexto = filas.map((f) =>
        Object.fromEntries(
          Object.keys(esperada).map((columna) => [
            columna,
            textoDeCelda(f[columnas.indexOf(columna)]),
          ]),
        ),
      )
      for (const columna of Object.keys(esperada)) expect(columnas).toContain(columna)
      expect(comoTexto).toContainEqual(esperada)
    },
  )

  afirmacion(
    pasos,
    'la hoja {string} tiene {string} filas',
    (m: Mundo, nombre: string, filas: string) => {
      expect(hoja(m, nombre).filas).toHaveLength(Number(filas))
    },
  )

  accion(pasos, 'guardo una copia', async (m: Mundo) => {
    m.archivo = await m.app.respaldo.guardarCopia()
    m.textoCopia = await m.archivo.contenido.text()
  })

  afirmacion(pasos, 'la copia tiene versión de formato {string}', (m: Mundo, version: string) => {
    expect(copia(m).versionDeFormato).toBe(Number(version))
  })

  afirmacion(
    pasos,
    'el control de la copia indica {string} productos y {string} operaciones',
    (m: Mundo, productos: string, operaciones: string) => {
      const { control } = copia(m)
      expect([control.productos, control.operaciones]).toEqual([
        Number(productos),
        Number(operaciones),
      ])
    },
  )

  afirmacion(
    pasos,
    'el control de la copia indica stock {string} para {string}',
    async (m: Mundo, stock: string, nombre: string) => {
      const producto = await m.producto(nombre)
      expect(copia(m).control.stockPorProducto[producto.id]).toBe(
        Cantidad.deTexto(stock, producto.unidad).milesimas,
      )
    },
  )

  afirmacion(pasos, 'la copia no incluye existencias ni resúmenes diarios', (m: Mundo) => {
    const tablas = Object.keys(copia(m).datos)
    expect(tablas).not.toContain('existencias')
    expect(tablas).not.toContain('resumenes')
  })

  preparacion(
    pasos,
    'una copia guardada con {string} productos y {string} operaciones del {string} al {string}',
    async (m: Mundo, productos: string, operaciones: string, desde: string, hasta: string) => {
      m.textoCopia = await copiaDeOtroCelular(Number(productos), Number(operaciones), desde, hasta)
    },
  )

  // Un archivo cortado a la mitad (la descarga falló): JSON incompleto.
  preparacion(pasos, 'un archivo de copia dañado', async (m: Mundo) => {
    const completa = await guardarCopiaDeEstaTienda(m)
    m.textoCopia = completa.slice(0, Math.floor(completa.length / 2))
  })

  // RN-RE-04: una copia real de esta tienda cuyo control alguien cambió a mano.
  preparacion(
    pasos,
    'una copia guardada cuyo control indica stock {string} para {string} pero sus operaciones suman {string}',
    async (m: Mundo, falso: string, nombre: string, real: string) => {
      const producto = await m.producto(nombre)
      const respaldo = JSON.parse(await guardarCopiaDeEstaTienda(m)) as {
        control: { stockPorProducto: Record<string, number> }
        datos: DatosDelRespaldo
      }
      const suma = respaldo.datos.operaciones
        .flatMap((o) => o.movimientos)
        .filter((mov) => mov.productoId === producto.id)
        .reduce((total, mov) => total + mov.cantidad, 0)
      expect(suma).toBe(Cantidad.deTexto(real, producto.unidad).milesimas)
      respaldo.control.stockPorProducto[producto.id] = Cantidad.deTexto(
        falso,
        producto.unidad,
      ).milesimas
      m.textoCopia = JSON.stringify(respaldo)
    },
  )

  preparacion(pasos, 'una copia guardada de esta tienda', async (m: Mundo) => {
    m.textoCopia = await guardarCopiaDeEstaTienda(m)
  })

  // RN-RE-05 / RN-RE-11: una copia hecha por otra versión de la app. La "1" es de antes del costo
  // del local (su configuración no trae `alquilerDelLocal`) y la "3" de una versión futura.
  preparacion(
    pasos,
    'una copia con versión de formato {string}',
    async (m: Mundo, version: string) => {
      const respaldo = JSON.parse(await guardarCopiaDeEstaTienda(m)) as {
        datos: { configuracion: Record<string, unknown> | null }
      } & Record<string, unknown>
      if (Number(version) === 1 && respaldo.datos.configuracion) {
        delete respaldo.datos.configuracion.alquilerDelLocal
        // Esta tienda ya paga un local: al abrir la copia vieja, eso debe quedar sin configurar.
        await m.app.tienda.actualizarConfiguracion({
          alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 10000, dias: [1] },
        })
      }
      m.textoCopia = JSON.stringify({ ...respaldo, versionDeFormato: Number(version) })
    },
  )

  // RN-RE-11: la copia guarda el costo del local. Antes de restaurar se deja el local sin
  // configurar, y el paso comprueba que volvió igual que cuando se guardó la copia.
  accion(pasos, 'guardo una copia y la restauro', async (m: Mundo) => {
    const { alquilerDelLocal: guardado } = await m.app.tienda.consultable.configuracion()
    m.textoCopia = await guardarCopiaDeEstaTienda(m)
    await m.app.tienda.actualizarConfiguracion({ alquilerDelLocal: null })
    await restaurar(m, m.textoCopia)
    const { alquilerDelLocal: restaurado } = await m.app.tienda.consultable.configuracion()
    expect(restaurado).toEqual(guardado)
  })

  afirmacion(pasos, 'el costo del local está sin configurar', async (m: Mundo) => {
    const { alquilerDelLocal } = await m.app.tienda.consultable.configuracion()
    expect(alquilerDelLocal).toBeNull()
  })

  // RN-RE-11: el costo guardado en la configuración tiene el tipo, el monto en centavos y los días
  // que describe el escenario (el texto pasa por el mismo convertidor que la pantalla).
  afirmacion(
    pasos,
    'el costo del local guardado es {string} {string} los días {string}',
    async (m: Mundo, monto: string, frecuencia: string, dias: string) => {
      const { alquilerDelLocal } = await m.app.tienda.consultable.configuracion()
      expect(alquilerDelLocal).toEqual(alquilerDeTextos(frecuencia, monto, dias))
    },
  )

  // RN-RE-03: Restaurar copia muestra el resumen y pide las dos confirmaciones.
  async function prepararRestauracion(m: Mundo): Promise<string> {
    if (m.textoCopia === null) throw new Error('El escenario no tiene una copia')
    const { resumen, confirmaciones } = await m.app.respaldo.prepararRestauracion(m.textoCopia)
    m.visibles.push(resumen.texto)
    m.confirmaciones = confirmaciones
    return m.textoCopia
  }

  async function restaurar(m: Mundo, texto: string): Promise<void> {
    // El usuario confirmó las dos veces que pide RN-RE-03 ("… y confirmo las dos veces").
    await m.app.respaldo.restaurarCopia(texto, { confirmaciones: 2 })
    m.resultado = 'restaurada'
  }

  accion(pasos, 'restauro la copia', async (m: Mundo) => {
    await prepararRestauracion(m)
    m.resultado = 'esperando confirmación'
  })

  accion(pasos, 'restauro la copia y confirmo las dos veces', async (m: Mundo) => {
    await restaurar(m, await prepararRestauracion(m))
  })

  accion(pasos, 'confirmo las dos veces', async (m: Mundo) => {
    if (m.textoCopia === null || m.confirmaciones.length !== 2) {
      throw new Error('No hay una restauración esperando las dos confirmaciones')
    }
    await restaurar(m, m.textoCopia)
  })

  afirmacion(pasos, 'se pide confirmar {string} veces', (m: Mundo, veces: string) => {
    expect(m.confirmaciones).toHaveLength(Number(veces))
  })

  afirmacion(pasos, 'el catálogo tiene {string} productos', async (m: Mundo, total: string) => {
    expect(await m.app.catalogo.consultable.productos()).toHaveLength(Number(total))
  })

  // RN-RE-10: la bienvenida y su "Ya tengo una copia guardada", al nivel de la aplicación: lo que
  // decide es `primeraVezCompletada` del estado del sistema, no las pantallas (las cubren los
  // tests de pantalla y el E2E). Una instalación nueva ya parte sin completar: se comprueba. El
  // mismo texto sirve de "Dado" y de "Entonces" (Gherkin no distingue la palabra clave).
  afirmacion(pasos, '(que )la primera vez no está completada', async (m: Mundo) => {
    expect((await m.app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(false)
  })

  afirmacion(pasos, 'la primera vez está completada', async (m: Mundo) => {
    expect((await m.app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(true)
  })

  accion(pasos, 'elijo {string} en la bienvenida', async (m: Mundo, opcion: string) => {
    expect((await m.app.tienda.consultable.estadoDelSistema()).primeraVezCompletada).toBe(false)
    expect(opcion).toBe('Ya tengo una copia guardada')
    m.pantalla = 'Restaurar copia'
  })

  // Cancelar (o fallar) la restauración: no se restaura nada y se vuelve a la bienvenida.
  accion(pasos, 'cancelo la restauración', (m: Mundo) => {
    expect(m.pantalla).toBe('Restaurar copia')
    m.confirmaciones = []
    m.pantalla = 'Bienvenida'
  })

  afirmacion(pasos, 'se muestra la bienvenida', (m: Mundo) => {
    expect(m.pantalla).toBe('Bienvenida')
  })

  // RN-RE-07: el Excel que elige el usuario (el lector en memoria devuelve estas filas). La
  // columna "fila" del escenario es el número de fila de Excel (la 1 son los encabezados).
  preparacion(pasos, 'un Excel de productos con las filas:', (m: Mundo, extra: ArgumentoExtra) => {
    const [encabezados = [], ...filas] = extra.tabla?.celdas ?? []
    const columnaFila = encabezados.indexOf('fila')
    if (columnaFila < 0) throw new Error('La tabla necesita la columna "fila"')
    const sinFila = (celdas: string[]) => celdas.filter((_, i) => i !== columnaFila)
    filas.forEach((celdas, i) => expect(Number(celdas[columnaFila])).toBe(i + 2))
    m.app.lectorDeExcel.fijarFilas([sinFila(encabezados), ...filas.map(sinFila)])
  })

  accion(pasos, 'cargo el Excel', async (m: Mundo) => {
    m.previa = await m.app.respaldo.previsualizarImportacion(new Blob())
  })

  afirmacion(
    pasos,
    'la vista previa muestra {string} filas válidas y {string} filas con problema',
    (m: Mundo, validas: string, conProblema: string) => {
      expect([m.previa?.validas.length, m.previa?.conProblemas.length]).toEqual([
        Number(validas),
        Number(conProblema),
      ])
    },
  )

  afirmacion(pasos, 'la vista previa explica:', (m: Mundo, extra: ArgumentoExtra) => {
    expect(m.previa?.conProblemas).toEqual(
      filasDe(extra).map((f) => ({
        fila: Number(celda(f, 'fila')),
        problema: celda(f, 'problema'),
      })),
    )
  })

  accion(pasos, 'confirmo la importación', async (m: Mundo) => {
    if (!m.previa) throw new Error('No hay una vista previa que confirmar')
    await m.app.respaldo.confirmarImportacion(m.previa)
    m.resultado = 'importada'
  })

  afirmacion(pasos, 'existe la categoría {string}', async (m: Mundo, nombre: string) => {
    expect(await m.app.catalogo.importacion.categoriaPorNombre(nombre)).not.toBeNull()
    expect((await m.app.catalogo.listarCategorias()).map((c) => c.nombre)).toContain(nombre)
  })

  accion(pasos, 'descargo la plantilla de productos', async (m: Mundo) => {
    m.archivo = await m.app.respaldo.descargarPlantilla()
  })

  afirmacion(pasos, 'el archivo tiene las columnas {string}', (m: Mundo, columnas: string) => {
    expect(m.archivo?.hojas?.[0]?.columnas).toEqual(lista(columnas))
  })

  // RN-RE-09: abrir la app la primera vez pidió el almacenamiento persistente (una vez).
  afirmacion(pasos, 'se solicita almacenamiento persistente', async (m: Mundo) => {
    expect(m.app.almacenamiento.solicitudes).toBe(1)
    const estado = await m.app.tienda.consultable.estadoDelSistema()
    expect(estado.almacenamientoPersistente).toBe('CONCEDIDO')
  })

  // RN-RE-06 (plan 19): el recordatorio se muestra en Ajustes, en el enlace Guardar copia.
  afirmacion(pasos, 'Ajustes muestra {string}', async (m: Mundo, texto: string) => {
    expect(await m.lineasDeAjustes()).toContain(texto)
  })

  afirmacion(pasos, 'Ajustes no muestra recordatorio de copia', async (m: Mundo) => {
    expect(await m.lineasDeAjustes()).toEqual([])
  })
}

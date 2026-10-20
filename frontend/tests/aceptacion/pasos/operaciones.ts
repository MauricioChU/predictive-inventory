import { expect } from 'vitest'
import { mensajeDeLoQueQueda, type OperacionVista } from '@/modules/inventario'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import { formatearDinero, formatearNumero } from '@/shared/domain/formato'
import type { ArgumentoExtra } from '../../gherkin/registro-de-pasos'
import { operacionDe } from './catalogo'
import type { Mundo } from './mundo'
import { accion, afirmacion, celda, filasDe, lista, preparacion, type Pasos } from './registro'

async function vistaDe(m: Mundo, operacionId: string | null): Promise<OperacionVista> {
  if (!operacionId) throw new Error('El escenario no registró esa operación')
  const vista = (await m.app.inventario.historial()).find((o) => o.id === operacionId)
  if (!vista) throw new Error(`No está la operación ${operacionId} en el historial`)
  return vista
}

async function lineasDeLaTabla(m: Mundo, extra: ArgumentoExtra) {
  return Promise.all(
    filasDe(extra).map(async (fila) => ({
      productoId: await m.idDe(celda(fila, 'producto')),
      cantidad: celda(fila, 'cantidad'),
      ...(fila.costo === undefined ? {} : { costo: fila.costo }),
    })),
  )
}

/** Lo que dice un botón de la app (paso "toco …"). */
async function tocar(m: Mundo, boton: string): Promise<void> {
  switch (boton) {
    case 'Deshacer': // RN-OP-18: anula sin pedir motivo.
      await m.app.inventario.deshacer.deshacer()
      m.resultado = 'deshecha'
      return
    case 'Registrar igual': // RN-OP-20: el aviso de sobrecompra no bloquea.
      if (!m.pendiente) throw new Error('No hay un aviso de sobrecompra abierto')
      await m.pendiente()
      return
    case 'Seguir después': // RN-OP-21: cada respuesta ya quedó guardada.
      expect(await m.app.inventario.conteoActual()).not.toBeNull()
      m.conteo = null
      m.pantalla = 'Inicio'
      return
    case 'Registrar llegada': // RN-AN-08: abre "Llegó mercadería" con la lista de hoy.
      m.abierta = {
        pantalla: 'Llegó mercadería',
        lineas: await m.app.analisis.lineasParaRegistrarLlegada(),
      }
      m.pantalla = m.abierta.pantalla
      return
    case 'Sí, avísame': // RN-AL-08: el botón de la pantalla que explica los avisos.
      expect(m.pantalla).toBe('Avisos en tu celular')
      await m.app.alertas.solicitarPermiso()
      return
    default:
      throw new Error(`El paso no sabe qué hace el botón "${boton}"`)
  }
}

/** Pasos de Operaciones (02-operaciones, RN-OP) y del resumen de hoy (RN-AN-02). */
export function pasosDeOperaciones(pasos: Pasos): void {
  accion(
    pasos,
    '(que )(luego )vendo {string} de {string}',
    async (m: Mundo, cantidad: string, nombre: string) => {
      await m.vender([{ productoId: await m.idDe(nombre), cantidad }])
    },
  )

  accion(
    pasos,
    'vendo {string} de {string} con fecha {string}',
    async (m: Mundo, cantidad: string, nombre: string, fecha: string) => {
      await m.vender([{ productoId: await m.idDe(nombre), cantidad }], instanteLocal(fecha))
    },
  )

  accion(
    pasos,
    'vendo {string} de {string} a precio especial {string}',
    async (m: Mundo, cantidad: string, nombre: string, precio: string) => {
      await m.vender([{ productoId: await m.idDe(nombre), cantidad, precioEspecial: precio }])
    },
  )

  accion(
    pasos,
    'vendo {string} de {string} y {string} más a precio especial {string}',
    async (m: Mundo, cantidad: string, nombre: string, otras: string, precio: string) => {
      const productoId = await m.idDe(nombre)
      await m.vender([
        { productoId, cantidad },
        { productoId, cantidad: otras, precioEspecial: precio },
      ])
    },
  )

  accion(pasos, 'vendo:', async (m: Mundo, extra: ArgumentoExtra) => {
    await m.vender(await lineasDeLaTabla(m, extra))
  })

  accion(pasos, '(que )llega mercadería:', async (m: Mundo, extra: ArgumentoExtra) => {
    const lineas = (await lineasDeLaTabla(m, extra)).map((l) => ({ ...l, costo: l.costo ?? '' }))
    await m.ingresar({ lineas })
  })

  // RN-OP-07: el carrito de Vender (dominio puro), con los datos del producto.
  accion(
    pasos,
    'agrego al carrito {string} de {string}',
    async (m: Mundo, cantidad: string, nombre: string) => {
      const producto = await m.producto(nombre)
      m.carrito.agregar(
        {
          id: producto.id,
          nombre: producto.nombre,
          unidad: producto.unidad,
          precioVenta: producto.precioVenta,
        },
        Cantidad.deTexto(cantidad, producto.unidad),
      )
    },
  )

  accion(
    pasos,
    'registro una merma de {string} de {string} con motivo {string}',
    async (m: Mundo, cantidad: string, nombre: string, motivo: string) => {
      await m.app.inventario.registrarMerma({ productoId: await m.idDe(nombre), cantidad, motivo })
      m.resultado = 'registrada'
    },
  )

  accion(
    pasos,
    'registro una merma de {string} de {string} con motivo {string} y nota {string}',
    async (m: Mundo, cantidad: string, nombre: string, motivo: string, nota: string) => {
      const productoId = await m.idDe(nombre)
      await m.app.inventario.registrarMerma({ productoId, cantidad, motivo, nota })
      m.resultado = 'registrada'
    },
  )

  accion(
    pasos,
    'cuento {string} de {string}',
    async (m: Mundo, contado: string, nombre: string) => {
      const respuesta = await m.app.inventario.contarStock({
        productoId: await m.idDe(nombre),
        contado,
      })
      if (respuesta.tipo === 'sin-cambios') {
        m.visibles.push(respuesta.mensaje)
        m.resultado = 'sin cambios'
      } else {
        m.resultado = 'registrada'
      }
    },
  )

  accion(pasos, 'anulo la última venta', async (m: Mundo) => {
    if (!m.ultimaVenta) throw new Error('El escenario no registró ninguna venta')
    const { anulacionId } = await m.app.inventario.anularOperacion({ operacionId: m.ultimaVenta })
    m.ultimaAnulacion = anulacionId
    m.resultado = 'anulada'
  })

  accion(pasos, 'anulo la última anulación', async (m: Mundo) => {
    if (!m.ultimaAnulacion) throw new Error('El escenario no anuló nada')
    await m.app.inventario.anularOperacion({ operacionId: m.ultimaAnulacion })
    m.resultado = 'anulada'
  })

  accion(pasos, 'anulo otra vez esa venta', async (m: Mundo) => {
    if (!m.ultimaVenta) throw new Error('El escenario no registró ninguna venta')
    await m.app.inventario.anularOperacion({ operacionId: m.ultimaVenta })
    m.resultado = 'anulada'
  })

  accion(pasos, 'anulo el último ingreso', async (m: Mundo) => {
    if (!m.ultimoIngreso) throw new Error('El escenario no registró ninguna llegada')
    await m.app.inventario.anularOperacion({ operacionId: m.ultimoIngreso })
    m.resultado = 'anulada'
  })

  accion(
    pasos,
    'confirmo',
    async (m: Mundo) => {
      if (!m.confirmacion) throw new Error('No hay nada que confirmar')
      await m.confirmacion.aceptar()
    },
    { revisa: true },
  )

  accion(
    pasos,
    'rechazo la confirmación',
    async (m: Mundo) => {
      if (!m.confirmacion) throw new Error('No hay nada que rechazar')
      await m.confirmacion.rechazar()
    },
    { revisa: true },
  )

  // "Registrar igual" contesta el aviso de sobrecompra que dejó la llegada de mercadería.
  accion(pasos, 'toco {string}', (m: Mundo, boton: string) => tocar(m, boton), {
    revisa: (boton: string) => boton === 'Registrar igual',
  })

  accion(pasos, 'reviso los datos', async (m: Mundo) => {
    m.revision = await m.app.inventario.revisarDatos()
  })

  // RN-OP-19, EXCEPCIÓN a "solo casos de uso": el escenario altera la existencia guardada por
  // fuera de la app (eso es lo que Revisar datos debe corregir), así que se escribe en el
  // repositorio de existencias de la composición.
  preparacion(
    pasos,
    '(que )la existencia guardada de {string} fue alterada a {string}',
    async (m: Mundo, nombre: string, cantidad: string) => {
      const producto = await m.producto(nombre)
      const { uow, repositorios } = m.app.infraestructura
      await uow.ejecutar(() =>
        repositorios.existencias.fijar(producto.id, Cantidad.deTexto(cantidad, producto.unidad)),
      )
    },
  )

  // RN-OP-22: lo que dice cada línea del panel de venta (cuánto queda tras la venta).
  accion(
    pasos,
    'pongo {string} de {string} en el panel de venta',
    async (m: Mundo, cantidad: string, nombre: string) => {
      const producto = await m.producto(nombre)
      const vista = await m.app.catalogo.obtenerProducto(producto.id)
      if (!vista) throw new Error(`No existe ${nombre}`)
      const mensaje = mensajeDeLoQueQueda(
        vista.stock,
        Cantidad.deTexto(cantidad, vista.unidad),
        vista.unidad,
      )
      if (mensaje) m.visibles.push(mensaje)
    },
  )

  // RN-OP-21: el conteo guiado. Cada paso muestra su progreso ("Llevas 1 de 3").
  accion(pasos, 'empiezo a contar todo', async (m: Mundo) => {
    m.conteo = await m.app.inventario.iniciarConteoGuiado()
    m.visibles.push(m.conteo.progreso)
  })

  accion(pasos, 'respondo {string}', async (m: Mundo, contado: string) => {
    m.conteo = await m.app.inventario.responderConteo(contado)
    m.visibles.push(m.conteo.progreso)
  })

  accion(pasos, 'salto el producto', async (m: Mundo) => {
    m.conteo = await m.app.inventario.saltarEnConteo()
    m.visibles.push(m.conteo.progreso)
  })

  accion(pasos, 'continúo el conteo', async (m: Mundo) => {
    m.conteo = await m.app.inventario.conteoActual()
    if (!m.conteo) throw new Error('No hay un conteo en curso')
    m.visibles.push(m.conteo.progreso)
  })

  afirmacion(pasos, 'el producto a contar es {string}', (m: Mundo, nombre: string) => {
    expect(m.conteo?.producto?.nombre).toBe(nombre)
  })

  afirmacion(pasos, 'el resumen del conteo dice {string}', (m: Mundo, linea: string) => {
    expect(m.conteo?.resumen ?? []).toContain(linea)
  })

  afirmacion(
    pasos,
    'el resultado es {string}',
    (m: Mundo, esperado: string) => {
      expect(m.resultado).toBe(esperado)
    },
    { revisa: true },
  )

  afirmacion(
    pasos,
    'el stock de {string} es {string}',
    async (m: Mundo, nombre: string, stock: string) => {
      const cantidad = await m.app.inventario.consultable.stockDe(await m.idDe(nombre))
      expect(formatearNumero(cantidad)).toBe(stock)
    },
  )

  // ADR-0002: la existencia guardada es la suma del libro (anulaciones incluidas).
  afirmacion(
    pasos,
    'el stock de {string} es igual a la suma de sus movimientos',
    async (m: Mundo, nombre: string) => {
      const productoId = await m.idDe(nombre)
      const suma = (await m.app.inventario.historial({ productoId }))
        .flatMap((o) => o.lineas.filter((l) => l.productoId === productoId))
        .reduce((total, l) => total + l.cantidad.milesimas, 0)
      expect((await m.app.inventario.consultable.stockDe(productoId)).milesimas).toBe(suma)
    },
  )

  afirmacion(
    pasos,
    'existe una operación {string} de {string} para {string}',
    async (m: Mundo, tipo: string, cantidad: string, nombre: string) => {
      await operacionDe(m, tipo, cantidad, nombre)
    },
  )

  afirmacion(
    pasos,
    'el historial de {string} tiene las operaciones {string}',
    async (m: Mundo, nombre: string, tipos: string) => {
      const historial = await m.app.inventario.historial({ productoId: await m.idDe(nombre) })
      // El historial va del más reciente al más antiguo; el escenario las nombra en orden.
      expect(historial.map((o) => o.tipo).reverse()).toEqual(lista(tipos))
    },
  )

  afirmacion(pasos, 'la venta aparece como anulada', async (m: Mundo) => {
    expect((await vistaDe(m, m.ultimaVenta)).anulada).toBe(true)
  })

  afirmacion(pasos, 'el carrito tiene {string} línea', (m: Mundo, lineas: string) => {
    expect(m.carrito.lineas).toHaveLength(Number(lineas))
  })

  afirmacion(
    pasos,
    'la línea de {string} tiene cantidad {string}',
    (m: Mundo, nombre: string, cantidad: string) => {
      const linea = m.carrito.lineas.find((l) => l.producto.nombre === nombre)
      expect(linea && formatearNumero(linea.cantidad)).toBe(cantidad)
    },
  )

  afirmacion(pasos, 'la venta tiene estas líneas:', async (m: Mundo, extra: ArgumentoExtra) => {
    const venta = await vistaDe(m, m.ultimaVenta)
    const comoTexto = (d: Dinero | null) => (d === null ? null : formatearDinero(d))
    expect(
      venta.lineas.map((l) => ({
        producto: l.nombre,
        precio: comoTexto(l.precioUnitario),
        costo: comoTexto(l.costoUnitario),
        importe: comoTexto(l.importe),
        ganancia: comoTexto(l.ganancia),
      })),
    ).toEqual(
      filasDe(extra).map((fila) => ({
        producto: celda(fila, 'producto'),
        precio: formatearDinero(Dinero.deTexto(celda(fila, 'precio'))),
        costo: formatearDinero(Dinero.deTexto(celda(fila, 'costo'))),
        importe: formatearDinero(Dinero.deTexto(celda(fila, 'importe'))),
        ganancia: formatearDinero(Dinero.deTexto(celda(fila, 'ganancia'))),
      })),
    )
  })

  afirmacion(pasos, 'el total de la venta es {string}', async (m: Mundo, total: string) => {
    const { total: real } = await vistaDe(m, m.ultimaVenta)
    expect(real && formatearDinero(real)).toBe(total)
  })

  afirmacion(pasos, 'la ganancia de la venta es {string}', async (m: Mundo, ganancia: string) => {
    const { ganancia: real } = await vistaDe(m, m.ultimaVenta)
    expect(real && formatearDinero(real)).toBe(ganancia)
  })

  afirmacion(pasos, 'se muestra {string}', async (m: Mundo, texto: string) => {
    expect(await m.textosVisibles()).toContain(texto)
  })

  // RN-OP-09 / RN-OP-22: cuándo quedó anotada la venta ("Ahora" es la hora del reloj).
  afirmacion(pasos, 'la venta ocurrió el {string}', async (m: Mundo, fecha: string) => {
    const { ocurridaEn } = await vistaDe(m, m.ultimaVenta)
    // Al minuto: el reloj de la prueba avanza unos milisegundos entre pasos.
    expect(ocurridaEn.slice(0, 16)).toBe(instanteLocal(fecha).slice(0, 16))
  })

  // RN-OP-18: el aviso de 10 s (`ServicioDeDeshacer.disponible()`, la fuente del botón).
  afirmacion(pasos, 'se ofrece {string}', (m: Mundo, boton: string) => {
    expect(boton).toBe('Deshacer')
    expect(m.app.inventario.deshacer.disponible()?.operacionId).toBe(m.ultimaVenta)
  })

  afirmacion(pasos, 'no se ofrece {string}', (m: Mundo, boton: string) => {
    expect(boton).toBe('Deshacer')
    expect(m.app.inventario.deshacer.disponible()).toBeNull()
  })

  afirmacion(
    pasos,
    'se avisa {string}',
    (m: Mundo, aviso: string) => {
      expect(m.avisos).toContain(aviso)
    },
    { revisa: true },
  )

  afirmacion(
    pasos,
    'se ofrecen las opciones {string}',
    (m: Mundo, opciones: string) => {
      expect([...m.opciones]).toEqual(lista(opciones))
    },
    { revisa: true },
  )

  afirmacion(
    pasos,
    'no se muestra ningún aviso de sobrecompra',
    (m: Mundo) => {
      expect(m.avisos).toEqual([])
      expect(m.resultado).toBe('registrada')
    },
    { revisa: true },
  )

  afirmacion(pasos, 'se informa {string}', (m: Mundo, mensaje: string) => {
    expect(m.revision?.mensaje).toBe(mensaje)
  })

  afirmacion(
    pasos,
    'se pide confirmar con el mensaje {string}',
    (m: Mundo, mensaje: string) => {
      expect(m.confirmacion?.mensajes ?? []).toContain(mensaje)
    },
    { revisa: true },
  )

  // RN-AN-02, periodo Hoy (lo que Inicio y la Torre de control muestran de hoy).
  const deHoy = (
    texto: string,
    concepto: keyof Awaited<ReturnType<Mundo['app']['analisis']['consultarResumen']>>,
  ) =>
    afirmacion(pasos, texto, async (m: Mundo, monto: string) => {
      const resumen = await m.app.analisis.consultarResumen('HOY')
      expect(formatearDinero(resumen[concepto])).toBe(monto)
    })
  deHoy('las ventas de hoy son {string}', 'ventas')
  deHoy('la ganancia bruta de hoy es {string}', 'gananciaBruta')
  deHoy('la ganancia neta de hoy es {string}', 'gananciaNeta')
  deHoy('las pérdidas por merma de hoy son {string}', 'mermas')
  deHoy('las diferencias de conteo de hoy son {string}', 'diferenciasDeConteo')
}

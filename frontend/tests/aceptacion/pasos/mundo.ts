import { vi, type MockInstance } from 'vitest'
import { abrirApp, pedirAlmacenamientoPersistente, type InicioDeLaApp } from '@/app/abrir-app'
import type { Notificacion } from '@/modules/alertas'
import { ProcesadorDeFotosCanvas } from '@/modules/catalogo'
import {
  Carrito,
  OPCIONES_DE_SOBRECOMPRA,
  type DatosDeIngreso,
  type DatosDeVenta,
  type EstadoDelConteo,
  type ResultadoDeRevision,
  type ResultadoDelVuelto,
} from '@/modules/inventario'
import type { ArchivoGenerado, HojaDeExcel, Previsualizacion } from '@/modules/respaldo'
import type { Respuesta } from '@/shared/application/respuesta'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import type { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { diaDe, instanteLocal, sumarSegundos, type Dia, type Instante } from '@/shared/domain/fecha'
import { normalizar } from '@/shared/domain/texto'
import {
  crearAplicacionDePrueba,
  type Almacen,
  type AplicacionDePrueba,
} from '../../soporte/aplicacion-de-prueba'
import { entornoDeFotosSimulado } from '../../soporte/fotos-simuladas'
import { PlanDeHistoria } from './historia'

/** Una decisión que la pantalla le pide al usuario (RN-CAT-05, RN-CAT-11, RN-OP-14). */
export interface Confirmacion {
  mensajes: string[]
  aceptar(): Promise<void>
  rechazar(): Promise<void>
}

/** Lo que abrió "Registrar llegada" (RN-AN-08): la pantalla y sus líneas prellenadas. */
export interface PantallaAbierta {
  pantalla: string
  lineas: { productoId: string; cantidad: Cantidad; costo: Dinero }[]
}

/**
 * El estado de UN escenario (cada fila de Ejemplos tiene el suyo): la aplicación de prueba real
 * (`crearAplicacion` con sus seis módulos) y lo que "la pantalla" vio o tiene a mano.
 *
 * Convención de `resultado` (paso "el resultado es …"): "creado" (producto), "registrada"
 * (venta, ingreso, merma, conteo con ajuste), "editado", "archivado", "creada"/"eliminada"
 * (categoría), "restaurada" (copia), o "error: " + el mensaje del ErrorDeDominio. Solo se
 * captura un `ErrorDeDominio`: cualquier otro error es un defecto y hace fallar el paso.
 */
/** Los resultados que alguien tiene que revisar (ver `Mundo.sinRevisar`). */
const RESULTADOS_POR_REVISAR = /^(error: |confirmar|aviso de sobrecompra|reactivar: )/

export class Mundo {
  /** Día de negocio del escenario ("hoy es …", "pasa al día …"). */
  dia: Dia = '2026-01-01'
  categorias: string[] = []

  resultado: string | null = null
  /**
   * Un resultado que alguien tiene que mirar: un error de dominio o una pregunta sin contestar
   * (confirmar, sobrecompra, reactivar). Lo deja la acción y lo da por visto el primer paso que
   * revisa el resultado; cualquier otro paso (o el final del escenario) falla.
   */
  sinRevisar: string | null = null
  confirmacion: Confirmacion | null = null
  reactivar: { productoId: string; nombre: string } | null = null
  /** Productos que había antes de la última acción que crea uno (RN-CAT-02). */
  cantidadAntes = 0
  busqueda: string[] = []
  /** El último producto que creó el escenario sin nombrarlo (RN-CAT-14). */
  ultimoProductoCreado: string | null = null

  avisos: string[] = []
  opciones: readonly string[] = []
  pendiente: (() => Promise<void>) | null = null
  ultimaVenta: string | null = null
  ultimaAnulacion: string | null = null
  ultimoIngreso: string | null = null

  readonly carrito = new Carrito()
  total: Dinero | null = null
  vuelto: ResultadoDelVuelto | null = null
  conteo: EstadoDelConteo | null = null
  revision: ResultadoDeRevision | null = null

  /**
   * La "pantalla simulada": los textos que mostró la última acción (vuelto, "El stock ya
   * estaba correcto", progreso del conteo, resumen de una copia). Se vacía al empezar cada
   * acción.
   */
  visibles: string[] = []
  /** Pedidos de permiso de notificaciones que había al empezar la última acción. */
  solicitudesDePermisoAntes = 0
  /** Notificaciones que ya se habían enviado al empezar la última acción. */
  notificacionesAntes = 0
  ultimaNotificacion: Notificacion | null = null
  inicio: InicioDeLaApp | null = null
  pantalla: string | null = null
  abierta: PantallaAbierta | null = null

  texto: string | null = null
  respuesta: string | null = null
  archivo: (ArchivoGenerado & { hojas?: HojaDeExcel[] }) | null = null
  textoCopia: string | null = null
  confirmaciones: readonly string[] = []
  previa: Previsualizacion | null = null

  /** "No hay conexión a internet": cualquier `fetch` falla y queda registrado. */
  sinRed: MockInstance<typeof fetch> | null = null

  readonly historia: PlanDeHistoria
  private readonly ids = new Map<string, string>()
  private productosSinNombre = 0
  private auxiliares = 0
  private readonly instantesDelPasado = new Set<Instante>()

  constructor(readonly app: AplicacionDePrueba) {
    this.historia = new PlanDeHistoria(this)
  }

  // ───────────── Reloj ─────────────

  /** "Hoy es …" / "pasa al día …": el próximo `ahora()` es exactamente ese instante. */
  fijarHoy(textoLocal: string): void {
    const instante = instanteLocal(textoLocal)
    this.app.reloj.fijar(instante)
    this.dia = diaDe(instante)
  }

  /**
   * Viaje en el tiempo para fabricar historia con los casos de uso reales: el reloj de prueba
   * va al instante pedido, corre `trabajo` (sin `ocurridaEn`: RN-OP-09 solo limita las fechas
   * que se ESCRIBEN, no el reloj) y vuelve exactamente a donde estaba. Dos viajes nunca
   * empiezan en el mismo instante (cada operación conserva un `registradaEn` propio).
   */
  async enElPasado<T>(instante: Instante, trabajo: () => Promise<T>): Promise<T> {
    let cuando = instante
    while (this.instantesDelPasado.has(cuando)) cuando = sumarSegundos(cuando, 1)
    this.instantesDelPasado.add(cuando)
    const marca = this.app.reloj.ahora()
    if (Date.parse(cuando) >= Date.parse(marca)) {
      throw new Error(`${cuando} no es anterior al "hoy" del escenario (${marca})`)
    }
    this.app.reloj.fijar(cuando)
    try {
      return await trabajo()
    } finally {
      // Lo que sale tras confirmar (eventos, Deshacer) también ocurre en el pasado.
      await this.app.esperarTareasPendientes()
      this.app.reloj.fijar(marca)
    }
  }

  // ───────────── Productos y categorías ─────────────

  recordar(nombre: string, productoId: string): void {
    this.ids.set(normalizar(nombre), productoId)
  }

  /** El producto con ese nombre (creado por el escenario, importado o restaurado). */
  async producto(nombre: string): Promise<ProductoResumido> {
    const id = this.ids.get(normalizar(nombre))
    const producto = id
      ? await this.app.catalogo.consultable.producto(id)
      : ((await this.app.catalogo.consultable.productos()).find(
          (p) => normalizar(p.nombre) === normalizar(nombre),
        ) ?? null)
    if (!producto) throw new Error(`El escenario no tiene un producto llamado "${nombre}"`)
    this.recordar(producto.nombre, producto.id)
    return producto
  }

  async idDe(nombre: string): Promise<string> {
    return (await this.producto(nombre)).id
  }

  /** La categoría con ese nombre; si no existe, se crea (sin sembrar las diez iniciales). */
  async categoriaId(nombre: string): Promise<string> {
    const existente = await this.app.catalogo.importacion.categoriaPorNombre(nombre)
    return existente ?? this.app.catalogo.crearCategoria(nombre)
  }

  /** La primera categoría declarada en el escenario, o "Otros". */
  async categoriaPorDefecto(): Promise<string> {
    return this.categoriaId(this.categorias[0] ?? 'Otros')
  }

  /** Nombre para un producto que el escenario no nombra ("Producto 1", "Producto 2", …). */
  nombreSinNombre(): string {
    this.productosSinNombre += 1
    return `Producto ${this.productosSinNombre}`
  }

  /** Nombre de un producto auxiliar de historia ("Historia 1", …): ver `historia.ts`. */
  nombreAuxiliar(): string {
    this.auxiliares += 1
    return `Historia ${this.auxiliares}`
  }

  // ───────────── Acciones ─────────────

  /** Al empezar cada acción: la pantalla anterior ya no se ve. */
  empezarAccion(): void {
    this.visibles = []
    this.resultado = null
    this.solicitudesDePermisoAntes = this.app.notificador.solicitudes
    this.notificacionesAntes = this.app.notificador.mostradas.length
  }

  /** Al terminar una acción: un error o una pregunta abierta quedan por revisar. */
  terminarAccion(): void {
    if (this.resultado !== null && RESULTADOS_POR_REVISAR.test(this.resultado)) {
      this.sinRevisar = this.resultado
    }
  }

  /**
   * Antes de cada paso: si la acción anterior dejó algo por revisar, solo puede seguir un paso
   * que lo revisa ("el resultado es …", "se avisa …", "se pide confirmar …", "confirmo"…).
   */
  exigirRevisado(revisa: boolean): void {
    const pendiente = this.sinRevisar
    if (pendiente === null) return
    this.sinRevisar = null
    if (!revisa) {
      throw new Error(`El paso anterior terminó en "${pendiente}" y este paso no lo revisa`)
    }
  }

  /**
   * Corre la acción; un `ErrorDeDominio` queda como resultado ("error: …"). Después espera
   * siempre lo que sale tras confirmar (avisos, Deshacer, eventos), fuera del `await` del caso
   * de uso.
   */
  async actuar(trabajo: () => Promise<unknown>): Promise<void> {
    try {
      await trabajo()
    } catch (error) {
      if (!esErrorDeDominio(error)) throw error
      this.resultado = `error: ${error.message}`
    } finally {
      await this.app.esperarTareasPendientes()
    }
  }

  /**
   * Atiende una `Respuesta` de Catálogo como lo haría la pantalla: hecho, pedir confirmación
   * (que repite la llamada con `confirmado: true`) u ofrecer reactivar (RN-CAT-02).
   */
  async atender<T>(
    pedir: (confirmado: boolean) => Promise<Respuesta<T>>,
    hecho: string,
    alHacer: (valor: T) => void = () => undefined,
  ): Promise<void> {
    const respuesta = await pedir(false)
    this.recibir(respuesta, pedir, hecho, alHacer)
  }

  private recibir<T>(
    respuesta: Respuesta<T>,
    pedir: (confirmado: boolean) => Promise<Respuesta<T>>,
    hecho: string,
    alHacer: (valor: T) => void,
  ): void {
    this.confirmacion = null
    switch (respuesta.tipo) {
      case 'hecho':
        this.resultado = hecho
        alHacer(respuesta.valor)
        return
      case 'confirmar':
        this.resultado = `confirmar: ${respuesta.mensaje}`
        this.confirmacion = {
          mensajes: [respuesta.mensaje],
          aceptar: () =>
            this.actuar(async () => this.recibir(await pedir(true), pedir, hecho, alHacer)),
          rechazar: async () => {
            this.confirmacion = null
            this.resultado = 'cancelado'
          },
        }
        return
      case 'reactivar':
        this.reactivar = { productoId: respuesta.productoId, nombre: respuesta.nombre }
        this.resultado = `reactivar: ${respuesta.nombre}`
    }
  }

  /** Vender (HU-OP-01). */
  async vender(lineas: DatosDeVenta['lineas'], ocurridaEn?: Instante): Promise<void> {
    const datos: DatosDeVenta = ocurridaEn === undefined ? { lineas } : { lineas, ocurridaEn }
    const { operacionId } = await this.app.inventario.registrarVenta(datos)
    this.ultimaVenta = operacionId
    this.resultado = 'registrada'
  }

  /**
   * Llegó mercadería (HU-OP-03), con sus dos preguntas: el aviso de sobrecompra (RN-OP-20,
   * "Registrar igual") y la actualización del precio de compra (RN-OP-14).
   */
  async ingresar(datos: DatosDeIngreso): Promise<void> {
    this.avisos = []
    this.opciones = []
    this.pendiente = null
    this.confirmacion = null
    const respuesta = await this.app.inventario.registrarIngreso(datos)
    switch (respuesta.tipo) {
      case 'hecho':
        this.ultimoIngreso = respuesta.operacionId
        this.resultado = 'registrada'
        return
      case 'aviso-sobrecompra':
        this.resultado = 'aviso de sobrecompra'
        this.avisos = respuesta.avisos.map((a) => a.mensaje)
        this.opciones = OPCIONES_DE_SOBRECOMPRA
        this.pendiente = () =>
          this.actuar(() => this.ingresar({ ...datos, confirmarSobrecompra: true }))
        return
      case 'confirmar-precios':
        this.resultado = 'confirmar precios'
        this.confirmacion = {
          mensajes: respuesta.cambios.map((c) => c.mensaje),
          aceptar: () =>
            this.actuar(() => this.ingresar({ ...datos, actualizarPreciosDeCompra: true })),
          rechazar: () =>
            this.actuar(() => this.ingresar({ ...datos, actualizarPreciosDeCompra: false })),
        }
    }
  }

  /**
   * "Abro la app": lo mismo que hace el arranque (src/app/arranque.ts), sin DOM (la letra no se
   * aplica a ningún <html>): abrir los datos, "montar" y pedir el almacenamiento persistente
   * (RN-RE-09). El arranque real no espera ese pedido; aquí se espera para que el escenario sea
   * determinista.
   */
  async abrirLaApp(): Promise<void> {
    this.inicio = await abrirApp(this.app, { aplicarTamanoDeLetra: () => undefined })
    this.pantalla = 'Inicio'
    await pedirAlmacenamientoPersistente(this.app)
  }

  // ───────────── Lo que muestran las pantallas ─────────────

  /**
   * Las líneas de Inicio (M12: todavía no hay pantalla): el aviso de atención (RN-AL-06a), el
   * recordatorio de copia (RN-RE-06; el de la última apertura, si la hubo) y el resumen del día
   * (RN-AL-09).
   */
  async lineasDeInicio(): Promise<string[]> {
    const atencion = await this.app.alertas.resumenDeAtencion()
    const recordatorio = this.inicio
      ? this.inicio.recordatorioDeCopia
      : await this.app.respaldo.recordatorioDeCopia()
    return [
      atencion.texto,
      ...(recordatorio === null ? [] : [recordatorio]),
      ...(this.inicio?.resumenDelDia?.lineas ?? []),
    ]
  }

  /**
   * Lo que "se muestra": lo que mostró la última acción y los mensajes de la Torre de control
   * (Control), que es la pantalla que muestra "Necesito al menos 2 semanas de ventas…" sin que
   * el escenario haga nada (RN-AN-13).
   */
  async textosVisibles(): Promise<string[]> {
    const torre = await this.app.analisis.consultarTorre()
    const deControl = [
      torre.semana.tipo === 'sin-datos' ? torre.semana.mensaje : null,
      torre.mejorDia.tipo === 'insuficiente' ? torre.mejorDia.mensaje : null,
    ].filter((texto): texto is NonNullable<typeof texto> => texto !== null)
    return [...this.visibles, ...deControl]
  }
}

const ALMACEN: Almacen = process.env.ACEPTACION_ALMACEN === 'dexie' ? 'dexie' : 'memoria'

let mundoActual: Mundo | null = null

/**
 * Un mundo por escenario. El primer paso de todos es "hoy es …", que fija el reloj. Las fotos
 * pasan por el procesador REAL del navegador (`ProcesadorDeFotosCanvas`), con
 * `createImageBitmap` y el lienzo simulados (RN-CAT-14). `ACEPTACION_ALMACEN=dexie` corre lo
 * mismo sobre Dexie (fake-indexeddb).
 */
export function crearMundo(): Mundo {
  mundoActual = new Mundo(
    crearAplicacionDePrueba({
      ahora: instanteLocal('2026-01-01 00:00'),
      almacen: ALMACEN,
      procesadorDeFotos: new ProcesadorDeFotosCanvas(entornoDeFotosSimulado()),
    }),
  )
  return mundoActual
}

/** Para `afterEach`: deshace los espías (sin red) y cierra la aplicación del escenario. */
export async function cerrarMundo(): Promise<void> {
  vi.restoreAllMocks()
  const mundo = mundoActual
  mundoActual = null
  await mundo?.app.cerrar()
  if (mundo?.sinRevisar) {
    throw new Error(`El escenario terminó sin revisar "${mundo.sinRevisar}"`)
  }
}

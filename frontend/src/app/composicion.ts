import {
  crearModuloAlertas,
  type ModuloAlertas,
  type Notificador,
  type RepositorioDeAvisos,
} from '@/modules/alertas'
import {
  crearModuloAnalisis,
  type ModuloAnalisis,
  type RepositorioDeListaDeCompras,
  type RepositorioDeResumenes,
} from '@/modules/analisis'
import {
  crearModuloCatalogo,
  type ModuloCatalogo,
  type ProcesadorDeFotos,
  type RepositorioDeCategorias,
  type RepositorioDeFotos,
  type RepositorioDeProductos,
} from '@/modules/catalogo'
import {
  crearModuloInventario,
  type ModuloInventario,
  type RepositorioDeConteo,
  type RepositorioDeExistencias,
  type RepositorioDeOperaciones,
} from '@/modules/inventario'
import {
  crearModuloRespaldo,
  type AlmacenamientoPersistente,
  type AlmacenDeRespaldo,
  type GeneradorDeExcel,
  type LectorDeExcel,
  type ModuloRespaldo,
} from '@/modules/respaldo'
import {
  crearModuloTienda,
  type ModuloTienda,
  type RepositorioDeConfiguracion,
} from '@/modules/tienda'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import type { BusDeEventos, ManejadorDeEvento, TipoDeEvento } from '@/shared/domain/eventos'
import type { GeneradorDeIds } from '@/shared/domain/ids'
import type { Reloj } from '@/shared/domain/reloj'

/** Un adaptador por puerto de repositorio de cada módulo, todos sobre la misma base. */
export interface Repositorios {
  productos: RepositorioDeProductos
  categorias: RepositorioDeCategorias
  fotos: RepositorioDeFotos
  operaciones: RepositorioDeOperaciones
  existencias: RepositorioDeExistencias
  conteo: RepositorioDeConteo
  resumenes: RepositorioDeResumenes
  listaDeCompras: RepositorioDeListaDeCompras
  avisos: RepositorioDeAvisos
  configuracion: RepositorioDeConfiguracion
}

/**
 * La unidad de trabajo de la composición. Además del puerto, deja esperar las acciones
 * `alConfirmar` que corrieron fuera de una transacción (nadie más las espera): lo hacen tanto
 * la de Dexie como la de memoria de las pruebas.
 */
export interface UnidadDeTrabajoDeLaApp extends UnidadDeTrabajo {
  esperarAcciones(): Promise<void>
}

/** Todo lo que la composición necesita del mundo exterior (Dexie y el navegador, o dobles). */
export interface Infraestructura {
  uow: UnidadDeTrabajoDeLaApp
  reloj: Reloj
  ids: GeneradorDeIds
  bus: BusDeEventos
  repositorios: Repositorios
  almacenDeRespaldo: AlmacenDeRespaldo
  notificador: Notificador
  procesadorDeFotos: ProcesadorDeFotos
  generadorDeExcel: GeneradorDeExcel
  lectorDeExcel: LectorDeExcel
  almacenamiento: AlmacenamientoPersistente
}

/** Los seis módulos ya cableados entre sí: lo único que ven las pantallas (`useAplicacion()`). */
export interface Aplicacion {
  catalogo: ModuloCatalogo
  inventario: ModuloInventario
  analisis: ModuloAnalisis
  alertas: ModuloAlertas
  respaldo: ModuloRespaldo
  tienda: ModuloTienda
  bus: BusDeEventos
  /**
   * Avisa cuando los datos cambiaron en bloque SIN un evento de dominio: después de
   * `inventario.revisarDatos()`, `inventario.reconstruirExistencias()` y
   * `respaldo.restaurarCopia()` (los estados de stock y la configuración pueden haber
   * cambiado). Como los suscriptores del bus, el manejador debe ser "dispara y olvida".
   * Devuelve la función para cancelar.
   */
  alCambiarEnBloque(manejador: () => void): () => void
  /**
   * Para pruebas y pasos Gherkin: espera las evaluaciones de avisos encoladas y las acciones
   * `alConfirmar` sueltas, en bucle hasta que no se publique nada nuevo mientras se espera
   * (una acción puede publicar un evento que encola otra evaluación).
   */
  esperarTareasPendientes(): Promise<void>
}

/**
 * Cablea los seis módulos con referencias perezosas (cada módulo recibe a los otros como
 * `() => …`, así el orden de creación no importa) y activa los avisos (RN-AL-02):
 *
 * - Inventario actualiza la proyección de Análisis en la misma unidad de trabajo (ADR-0002).
 * - El `Reconstructor` de Respaldo es `inventario.reconstruirExistencias()`, que también
 *   reconstruye las proyecciones (RN-RE-04).
 * - Alertas escucha los eventos del bus. Tras revisar datos, reconstruir o restaurar una copia
 *   (sin evento de dominio) la composición vuelve a evaluar los avisos y avisa a quien escuche
 *   `alCambiarEnBloque` (p. ej. el estado global, que recarga la letra y el contador).
 * - Pedir el permiso de notificaciones (RN-AL-08) guarda la respuesta en la configuración de
 *   la tienda (`notificacionesActivas`), que es la otra mitad de RN-AL-06c.
 */
export function crearAplicacion(infra: Infraestructura): Aplicacion {
  const { uow, reloj, ids, repositorios: r } = infra

  // Cuenta las publicaciones: si durante una espera se publicó algo, hay que volver a esperar.
  let publicaciones = 0
  const bus: BusDeEventos = {
    publicar(evento) {
      publicaciones += 1
      return infra.bus.publicar(evento)
    },
    suscribir<T extends TipoDeEvento>(tipo: T, manejador: ManejadorDeEvento<T>) {
      return infra.bus.suscribir(tipo, manejador)
    },
  }

  const tienda = crearModuloTienda({ repositorio: r.configuracion, uow, ids, bus })

  const analisis = crearModuloAnalisis({
    resumenes: r.resumenes,
    listaDeCompras: r.listaDeCompras,
    uow,
    reloj,
    catalogo: () => catalogo.consultable,
    inventario: () => inventarioBase.consultable,
    tienda: () => tienda.consultable,
  })

  const catalogo = crearModuloCatalogo({
    productos: r.productos,
    categorias: r.categorias,
    fotos: r.fotos,
    procesadorDeFotos: infra.procesadorDeFotos,
    uow,
    reloj,
    ids,
    bus,
    inventario: () => inventarioBase.consultable,
    ventas: () => analisis.consultable,
  })

  const inventarioBase = crearModuloInventario({
    operaciones: r.operaciones,
    existencias: r.existencias,
    conteo: r.conteo,
    uow,
    reloj,
    ids,
    bus,
    catalogo: () => catalogo.consultable,
    analisis: () => analisis.consultable,
    tienda: () => tienda.consultable,
    proyecciones: () => [analisis.proyeccion],
  })

  const alertasBase = crearModuloAlertas({
    avisos: r.avisos,
    notificador: infra.notificador,
    uow,
    reloj,
    bus,
    analisis: () => analisis.consultable,
    tienda: () => tienda.consultable,
  })

  const catalogoParaRespaldo = { ...catalogo.consultable, importacion: catalogo.importacion }
  const respaldoBase = crearModuloRespaldo({
    almacen: infra.almacenDeRespaldo,
    // Dentro de la unidad de trabajo de la restauración: la versión SIN el aviso de cambio en
    // bloque, que va recién cuando la restauración entera confirmó.
    reconstructor: { reconstruirTodo: () => inventarioBase.reconstruirExistencias() },
    generadorDeExcel: infra.generadorDeExcel,
    lectorDeExcel: infra.lectorDeExcel,
    almacenamiento: infra.almacenamiento,
    uow,
    reloj,
    catalogo: () => catalogoParaRespaldo,
    inventario: () => inventarioBase.consultable,
    analisis: () => analisis.consultable,
    tienda: () => tienda.consultable,
  })

  alertasBase.escucharEventos()

  /**
   * RN-AL-06c / RN-AL-08: el canal del sistema exige permiso del navegador Y la configuración
   * activa. Lo que el usuario contesta en "Sí, avísame" es su decisión: se guarda en la
   * configuración (sin esto, conceder el permiso nunca activaba las notificaciones).
   */
  const alertas: ModuloAlertas = {
    ...alertasBase,
    async solicitarPermiso() {
      const concedido = await alertasBase.solicitarPermiso()
      const { notificacionesActivas } = await tienda.obtenerConfiguracion()
      if (notificacionesActivas !== concedido) {
        await tienda.actualizarConfiguracion({ notificacionesActivas: concedido })
      }
      return concedido
    },
  }

  const manejadoresDeCambio = new Set<() => void>()

  /** Tras confirmar (la unidad de trabajo más externa, si la hay): re-evaluar y avisar. */
  function trasCambioEnBloque(): void {
    uow.alConfirmar(() => {
      // Encola y vuelve, como el suscriptor de Alertas: quien revisó o restauró no espera.
      void alertas.evaluarAvisos()
      // Una copia: lo que un manejador agregue o cancele aquí no cambia esta entrega.
      for (const manejador of Array.from(manejadoresDeCambio)) {
        try {
          manejador()
        } catch (error) {
          console.error('Falló un manejador de cambios en bloque:', error)
        }
      }
    })
  }

  const inventario: ModuloInventario = {
    ...inventarioBase,
    async revisarDatos() {
      const resultado = await inventarioBase.revisarDatos()
      trasCambioEnBloque()
      return resultado
    },
    async reconstruirExistencias() {
      await inventarioBase.reconstruirExistencias()
      trasCambioEnBloque()
    },
  }

  const respaldo: ModuloRespaldo = {
    ...respaldoBase,
    async restaurarCopia(texto, datos) {
      await respaldoBase.restaurarCopia(texto, datos)
      trasCambioEnBloque()
    },
  }

  async function esperarTareasPendientes(): Promise<void> {
    let antes: number
    do {
      antes = publicaciones
      await alertas.esperarEvaluacionesPendientes()
      await uow.esperarAcciones()
    } while (antes !== publicaciones)
  }

  return {
    catalogo,
    inventario,
    analisis,
    alertas,
    respaldo,
    tienda,
    bus,
    alCambiarEnBloque(manejador) {
      manejadoresDeCambio.add(manejador)
      return () => {
        manejadoresDeCambio.delete(manejador)
      }
    },
    esperarTareasPendientes,
  }
}

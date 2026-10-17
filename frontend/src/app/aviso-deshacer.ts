import { computed, inject, ref, type ComputedRef, type InjectionKey } from 'vue'
import { SEGUNDOS_PARA_DESHACER } from '@/modules/inventario'
import { esErrorDeDominio } from '@/shared/domain/errores'
import type { Anunciador } from '@/shared/ui/anunciador'

/**
 * RN-OP-18: "Deshacer" se ofrece durante 10 s — fijo, nadie lo cambia (ni pantallas ni pruebas).
 * M9 (plan 12): es LA constante del módulo de inventario (la que usa `deshacer.disponible()`),
 * reexportada para LayoutApp: el aviso que se ve y la regla nunca se desfasan.
 */
export { SEGUNDOS_PARA_DESHACER }

export interface OpcionesAvisoDeshacer {
  mensaje: string
  alDeshacer: () => void
}

/** Instancia activa de un aviso: incluye un `id` único por llamada a `mostrar()`, usado como
 * `:key` del `<AvisoDeshacer>` para forzar una instancia (y un temporizador) nuevos (Q1). */
export interface AvisoDeshacerActivo extends OpcionesAvisoDeshacer {
  id: number
}

/**
 * Plan 12, r1 #2 (RN-UX-11): cuánto queda a la vista lo que se deshizo (o por qué no se pudo),
 * si nadie lo cierra antes.
 */
export const SEGUNDOS_DEL_RESULTADO_DE_DESHACER = 6

/** Qué pasó al tocar "Deshacer": se ve donde estaba el aviso, esté donde esté la persona. */
export interface ResultadoDeDeshacer {
  /** exito = se deshizo; atencion = no se pudo (el mensaje del dominio). */
  tono: 'exito' | 'atencion'
  /** "Deshiciste la venta de S/ 7.00. Lo que estás cargando sigue aquí." */
  titulo: string
  /** Qué hacer, si no se pudo. */
  texto?: string
}

/**
 * Plan 17: lo que se muestra (con `mostrarResultado`) cuando un Deshacer que no es de inventario
 * (quitar de Para comprar, eliminar una categoría, archivar o reactivar) no se pudo hacer. Un
 * error del dominio dice por qué; cualquier otro se registra y se dice en palabras simples.
 */
export function resultadoDeDeshacerFallido(error: unknown): ResultadoDeDeshacer {
  const titulo = 'No pudimos deshacer'
  if (esErrorDeDominio(error)) {
    const texto = error.message.endsWith('.') ? error.message : `${error.message}.`
    return { tono: 'atencion', titulo, texto }
  }
  console.error('No se pudo deshacer:', error)
  return {
    tono: 'atencion',
    titulo,
    texto: 'Vuelve a intentarlo. Si sigue pasando, cierra la app y ábrela otra vez.',
  }
}

export interface ResultadoDeDeshacerActivo extends ResultadoDeDeshacer {
  id: number
}

export interface ContextoAvisoDeshacer {
  /** Solo lectura: nadie fuera de este módulo puede mutar el aviso activo (Q1). */
  activo: ComputedRef<AvisoDeshacerActivo | undefined>
  mostrar: (opciones: OpcionesAvisoDeshacer) => void
  cerrar: () => void
  /** Plan 12, r1 #2: el resultado del último Deshacer (LayoutApp lo dibuja en el pie). */
  resultado: ComputedRef<ResultadoDeDeshacerActivo | undefined>
  /** Lo muestra y lo anuncia; se cierra solo a los SEGUNDOS_DEL_RESULTADO_DE_DESHACER. */
  mostrarResultado: (resultado: ResultadoDeDeshacer) => void
  cerrarResultado: () => void
}

/** LayoutApp provee este contexto para que cualquier pantalla pueda pedir un aviso Deshacer global (RN-OP-18). */
export const CLAVE_AVISO_DESHACER: InjectionKey<ContextoAvisoDeshacer> = Symbol('aviso-deshacer')

let contadorId = 0

function textoAnuncio(mensaje: string): string {
  return `${mensaje}. Puedes deshacer durante ${SEGUNDOS_PARA_DESHACER} segundos.`
}

/** El anuncio lo hace el anunciador compartido (ver app/anunciador.ts). Este módulo solo
 * guarda el identificador de SU anuncio, para que al cerrarse retire únicamente ese mensaje
 * y nunca borre un anuncio más nuevo de otra pantalla (N4). */
export function crearContextoAvisoDeshacer(anunciador: Anunciador): ContextoAvisoDeshacer {
  const estado = ref<AvisoDeshacerActivo>()
  const resultado = ref<ResultadoDeDeshacerActivo>()
  let idAnuncio: number | undefined
  let temporizadorDelResultado: ReturnType<typeof setTimeout> | undefined

  function retirarAnuncio() {
    if (idAnuncio !== undefined) anunciador.limpiar(idAnuncio)
    idAnuncio = undefined
  }

  function cerrarResultado() {
    if (temporizadorDelResultado !== undefined) clearTimeout(temporizadorDelResultado)
    temporizadorDelResultado = undefined
    resultado.value = undefined
  }

  return {
    activo: computed(() => estado.value),
    mostrar(opciones: OpcionesAvisoDeshacer) {
      contadorId += 1
      // Cada llamada obtiene un id distinto: LayoutApp lo usa como :key para montar una
      // instancia de <AvisoDeshacer> completamente nueva (con su propio temporizador de 10 s),
      // en vez de reutilizar la anterior (que cerraría el aviso nuevo a mitad de camino).
      // Solo los campos conocidos: aunque alguien colara otra opción (p. ej. "segundos"),
      // no llega al aviso (RN-OP-18: siempre SEGUNDOS_PARA_DESHACER).
      estado.value = { mensaje: opciones.mensaje, alDeshacer: opciones.alDeshacer, id: contadorId }
      cerrarResultado() // un aviso nuevo reemplaza al resultado de un Deshacer anterior
      retirarAnuncio() // el aviso anterior (si lo había) queda reemplazado
      idAnuncio = anunciador.anunciar(textoAnuncio(opciones.mensaje))
    },
    cerrar() {
      estado.value = undefined
      retirarAnuncio()
    },
    resultado: computed(() => resultado.value),
    mostrarResultado(nuevo: ResultadoDeDeshacer) {
      cerrarResultado()
      contadorId += 1
      resultado.value = { ...nuevo, id: contadorId }
      anunciador.anunciar(nuevo.texto ? `${nuevo.titulo}. ${nuevo.texto}` : nuevo.titulo)
      temporizadorDelResultado = setTimeout(
        cerrarResultado,
        SEGUNDOS_DEL_RESULTADO_DE_DESHACER * 1000,
      )
    },
    cerrarResultado,
  }
}

export function useAvisoDeshacer(): ContextoAvisoDeshacer {
  const contexto = inject(CLAVE_AVISO_DESHACER)
  if (!contexto) throw new Error('useAvisoDeshacer debe usarse dentro de LayoutApp')
  return contexto
}

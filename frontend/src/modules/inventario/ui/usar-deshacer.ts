import { onBeforeUnmount, readonly, ref } from 'vue'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { useAvisoDeshacer } from '@/app/aviso-deshacer'
import { useAnunciador } from '@/shared/ui/anunciador'
import { SEGUNDOS_PARA_DESHACER } from '../application/deshacer'
import { errorParaMostrar } from './mensajes-de-error'

export interface OfertaDeDeshacer {
  /** Lo que dice el aviso: "Venta registrada". */
  mensaje: string
  /** Cómo se deshace. Por defecto, el Deshacer del módulo (anula la operación ofrecida). */
  ejecutar?: () => Promise<void>
  /**
   * Corre después de deshacer, esté o no abierta la pantalla que lo ofreció, y devuelve qué se
   * deshizo para mostrarlo: "Deshiciste la venta de S/ 7.00. Tus productos volvieron al
   * carrito." Con `pantallaAbierta` la pantalla sabe si puede cambiar lo que muestra.
   */
  alDeshacer: (contexto: { pantallaAbierta: boolean }) => string
}

/**
 * RN-OP-18: después de registrar, el aviso Deshacer (10 s, el de LayoutApp). El aviso es
 * global: si la persona ya se fue a otra pantalla igual puede deshacer. r1 #2 (RN-UX-11): el
 * resultado, bueno o malo, se ve y se anuncia en el pie de LayoutApp, esté donde esté la
 * persona (`mostrarResultado`, una sola vez para toda la app).
 */
export function usarDeshacer() {
  const aplicacion = useAplicacion()
  const aviso = useAvisoDeshacer()
  const anunciador = useAnunciador()
  let idAnuncio: number | undefined
  let abierta = true
  /** Con `enPantalla`: lo que queda de los 10 s, para el botón de la pantalla de éxito. */
  const restante = ref<number>()
  let temporizador: ReturnType<typeof setInterval> | undefined
  let alDeshacerAqui: (() => void) | undefined

  /** Retira la oferta de la pantalla (vence, se usa o la persona se va). */
  function cancelar(): void {
    if (temporizador !== undefined) clearInterval(temporizador)
    temporizador = undefined
    alDeshacerAqui = undefined
    restante.value = undefined
    if (idAnuncio !== undefined) anunciador.limpiar(idAnuncio)
    idAnuncio = undefined
  }

  onBeforeUnmount(() => {
    abierta = false
    cancelar() // la oferta en pantalla no sigue en otra vista
  })

  async function deshacer(oferta: OfertaDeDeshacer): Promise<void> {
    try {
      await (oferta.ejecutar ?? (() => aplicacion.inventario.deshacer.deshacer()))()
    } catch (causa) {
      const error = errorParaMostrar(causa, 'deshacer')
      aviso.mostrarResultado({ tono: 'atencion', titulo: error.mensaje, texto: error.ayuda })
      return
    }
    aviso.mostrarResultado({
      tono: 'exito',
      titulo: oferta.alDeshacer({ pantallaAbierta: abierta }),
    })
  }

  return {
    /**
     * Por defecto, el aviso global de abajo. Con `enPantalla`, la pantalla dibuja el botón
     * (`restante`, `deshacerAqui`) y la oferta muere si se va de ella o vence.
     */
    ofrecer(oferta: OfertaDeDeshacer, opciones: { enPantalla?: boolean } = {}): void {
      if (!opciones.enPantalla) {
        aviso.mostrar({ mensaje: oferta.mensaje, alDeshacer: () => void deshacer(oferta) })
        return
      }
      cancelar()
      // Un aviso global de una operación anterior (de cualquier pantalla) ya no vale.
      aviso.cerrar()
      // Con reloj real: si el celular se suspende, al volver la cuenta ya está al día (RN-OP-18).
      const vence = Date.now() + SEGUNDOS_PARA_DESHACER * 1000
      restante.value = SEGUNDOS_PARA_DESHACER
      // El título ya lo anuncia la pantalla de éxito: aquí solo lo de deshacer.
      idAnuncio = anunciador.anunciar(`Puedes deshacer durante ${SEGUNDOS_PARA_DESHACER} segundos.`)
      alDeshacerAqui = () => {
        cancelar()
        void deshacer(oferta)
      }
      temporizador = setInterval(() => {
        if (restante.value === undefined) return
        restante.value = Math.ceil((vence - Date.now()) / 1000)
        if (restante.value <= 0) cancelar()
      }, 250)
    },
    restante: readonly(restante),
    deshacerAqui(): void {
      alDeshacerAqui?.()
    },
    cancelar,
  }
}

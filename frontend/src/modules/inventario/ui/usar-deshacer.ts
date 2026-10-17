import { onBeforeUnmount } from 'vue'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { useAvisoDeshacer } from '@/app/aviso-deshacer'
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
  let abierta = true
  onBeforeUnmount(() => {
    abierta = false
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
    ofrecer(oferta: OfertaDeDeshacer): void {
      aviso.mostrar({ mensaje: oferta.mensaje, alDeshacer: () => void deshacer(oferta) })
    },
  }
}

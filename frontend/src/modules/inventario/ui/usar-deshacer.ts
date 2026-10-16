import { onBeforeUnmount, ref } from 'vue'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { useAvisoDeshacer } from '@/app/aviso-deshacer'
import { useAnunciador } from '@/shared/ui/anunciador'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'

export interface OfertaDeDeshacer {
  /** Lo que dice el aviso: "Venta registrada". */
  mensaje: string
  /** Lo que se anuncia al deshacer: "Deshiciste la venta". */
  deshecho: string
  /** Solo si la pantalla sigue abierta cuando se deshizo (p. ej. volver a poner el carrito). */
  alDeshacer?: () => void
}

/**
 * RN-OP-18: después de registrar, el aviso Deshacer (10 s, el de LayoutApp). Deshacer es anular
 * sin pedir motivo, con el caso de uso del módulo. El aviso es global: si la persona ya se fue
 * a otra pantalla igual puede deshacer; el resultado se anuncia siempre y, si esta pantalla
 * sigue abierta, también se ve (`error`, o lo que haga `alDeshacer`).
 */
export function usarDeshacer() {
  const aplicacion = useAplicacion()
  const aviso = useAvisoDeshacer()
  const anunciador = useAnunciador()
  const error = ref<ErrorParaMostrar | null>(null)
  let abierta = true
  onBeforeUnmount(() => {
    abierta = false
  })

  async function deshacer(oferta: OfertaDeDeshacer): Promise<void> {
    try {
      await aplicacion.inventario.deshacer.deshacer()
      anunciador.anunciar(oferta.deshecho)
      if (abierta) {
        error.value = null
        oferta.alDeshacer?.()
      }
    } catch (causa) {
      const mostrado = errorParaMostrar(causa, 'deshacer')
      anunciador.anunciar(mostrado.mensaje)
      if (abierta) error.value = mostrado
    }
  }

  return {
    error,
    ofrecer(oferta: OfertaDeDeshacer): void {
      error.value = null
      aviso.mostrar({ mensaje: oferta.mensaje, alDeshacer: () => void deshacer(oferta) })
    },
  }
}

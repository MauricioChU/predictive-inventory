import { computed, reactive, type ComputedRef } from 'vue'

/** El evento `beforeinstallprompt` de Chromium (no está en lib.dom.d.ts). */
interface EventoDeInstalacion extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: string }>
}

function esEventoDeInstalacion(evento: Event): evento is EventoDeInstalacion {
  return typeof (evento as Partial<EventoDeInstalacion>).prompt === 'function'
}

const estado = reactive({
  /** El pedido de instalación guardado (el navegador lo ofrece una sola vez). */
  pedido: null as EventoDeInstalacion | null,
  /** Abierta como app instalada (o se acaba de instalar). */
  instalada: false,
  /** La persona tocó "Ahora no": no vuelve hasta la próxima vez que abra la app. */
  cerrada: false,
})

let escuchando = false

/** Abierta desde el ícono de la pantalla principal (Android/Chrome) o desde el de iOS. */
function abiertaComoApp(ventana: Window): boolean {
  const navegador = ventana.navigator as Navigator & { standalone?: boolean }
  return Boolean(ventana.matchMedia?.('(display-mode: standalone)').matches) || navegador.standalone === true
}

/**
 * RN-UX-13: el navegador ofrece instalar la app con `beforeinstallprompt` una sola vez, temprano y
 * en cualquier pantalla. Por eso se escucha desde que arranca la app (lo llama el archivo de
 * rutas), no al montar Inicio. Se guarda el pedido (y se evita la barrita propia de Chrome) para
 * que Inicio muestre su tarjeta con el botón Instalar. Llamarla más de una vez no hace nada.
 */
export function escucharInstalacion(ventana: Window | undefined = globalThis.window): void {
  if (escuchando || ventana === undefined) return
  escuchando = true
  estado.instalada = abiertaComoApp(ventana)
  ventana.addEventListener('beforeinstallprompt', (evento) => {
    if (!esEventoDeInstalacion(evento)) return
    evento.preventDefault()
    estado.pedido = evento
  })
  ventana.addEventListener('appinstalled', () => {
    estado.instalada = true
    estado.pedido = null
  })
}

export interface Instalacion {
  /** Se muestra la tarjeta "Instala la app en tu celular". */
  mostrar: ComputedRef<boolean>
  /** El navegador ofrece el botón de instalar; si no, se muestran los pasos. */
  sePuedeInstalar: ComputedRef<boolean>
  instalar(): Promise<void>
  cerrar(): void
}

export function usarInstalacion(): Instalacion {
  escucharInstalacion()
  return {
    mostrar: computed(() => !estado.instalada && !estado.cerrada),
    sePuedeInstalar: computed(() => estado.pedido !== null),
    async instalar() {
      const pedido = estado.pedido
      if (!pedido) return
      // El pedido solo sirve una vez, la acepte o no.
      estado.pedido = null
      await pedido.prompt()
      const { outcome } = await pedido.userChoice
      if (outcome === 'accepted') estado.instalada = true
    },
    cerrar() {
      estado.cerrada = true
    },
  }
}

/** Para las pruebas: como si la app recién se abriera (vuelve a mirar la ventana). */
export function olvidarInstalacionParaPruebas(): void {
  estado.pedido = null
  estado.cerrada = false
  estado.instalada = typeof window === 'undefined' ? false : abiertaComoApp(window)
}

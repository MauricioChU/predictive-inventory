import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * `true` mientras la ventana mide `minimoPx` o más de ancho (por defecto 1024 px: el mismo corte
 * de LayoutApp.vue, donde la navegación pasa al costado). Se mantiene al día si la ventana
 * cambia de tamaño. Sin `matchMedia` (p. ej. jsdom) vale `false`: la versión de celular.
 */
export function usarPantallaAncha(minimoPx = 1024): Ref<boolean> {
  const ancha = ref(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return ancha
  const consulta = window.matchMedia(`(min-width: ${minimoPx}px)`)
  ancha.value = consulta.matches
  const alCambiar = (evento: { matches: boolean }): void => {
    ancha.value = evento.matches
  }
  consulta.addEventListener('change', alCambiar)
  onBeforeUnmount(() => consulta.removeEventListener('change', alCambiar))
  return ancha
}

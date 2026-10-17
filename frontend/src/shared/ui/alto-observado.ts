import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * El alto REAL de `elemento` (px), al día con ResizeObserver: cambia con la letra elegida y si
 * el texto del botón pasa a dos líneas. Lo usan las pantallas con la acción principal pegada
 * abajo (Productos y su formulario, plan 11) para que lo que recibe el foco quede por encima de
 * ella (WCAG 2.4.11), sin adivinar alturas. Vale 0 sin ResizeObserver (p. ej. jsdom) o mientras
 * el elemento no existe.
 *
 * PENDIENTE DE UNIFICAR: hace lo mismo que `usarAltoComoVariable` (src/app/alto-como-variable.ts:
 * el alto del pie de LayoutApp publicado como variable CSS en <html>), pero devuelve el alto
 * como `ref` para que cada pantalla lo ponga donde lo necesita. Cuando el plan 12 mueva aquel a
 * src/shared/ui, quedarse con UNO solo (el controlador lo unifica).
 */
export function usarAltoObservado(elemento: Readonly<Ref<HTMLElement | null | undefined>>) {
  const alto = ref(0)
  if (typeof ResizeObserver === 'undefined') return alto
  const observador = new ResizeObserver(([entrada]) => {
    alto.value = Math.ceil(entrada?.target.getBoundingClientRect().height ?? 0)
  })
  const detener = watch(
    elemento,
    (nuevo, anterior) => {
      if (anterior) observador.unobserve(anterior)
      if (nuevo) observador.observe(nuevo)
      else alto.value = 0
    },
    { immediate: true, flush: 'post' },
  )
  onBeforeUnmount(() => {
    detener()
    observador.disconnect()
  })
  return alto
}

import { nextTick } from 'vue'

/**
 * RN-UX-15: al cambiar de paso dentro de una pantalla (Cobrar, éxito, volver al carrito) el foco
 * va al título nuevo, como cuando el router cambia de pantalla: el lector de pantalla lo lee y
 * el Tab sigue desde ahí. Foco programático sin desplazar (el título ya está arriba).
 */
export async function enfocarTitulo(): Promise<void> {
  await nextTick()
  const titulo = document.querySelector<HTMLElement>('#contenido h1')
  if (!titulo) return
  if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1')
  titulo.focus()
}

/** Lleva el foco (y la vista) al primer campo marcado con error dentro de `contenedor`. */
export async function enfocarPrimerError(contenedor: string): Promise<void> {
  await nextTick()
  document.querySelector<HTMLElement>(`${contenedor} [aria-invalid="true"]`)?.focus()
}

/** RN-UX-11: una vibración corta al registrar, si el celular la permite. */
export function vibrar(): void {
  try {
    navigator.vibrate?.(60)
  } catch {
    // Sin vibración no pasa nada: la pantalla de éxito ya lo dice.
  }
}

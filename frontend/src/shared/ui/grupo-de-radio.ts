import { computed } from 'vue'

/** Flecha → cuánto se mueve la selección (patrón "radio group" de WAI-ARIA APG). */
const PASOS: Readonly<Record<string, 1 | -1>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

/**
 * Comportamiento compartido de SelectorSegmentado y BotonesDeOpcion (role="radiogroup" con
 * botones role="radio"):
 * - un solo punto de tabulación ("roving tabindex"): la opción elegida, o la primera si
 *   ninguna lo está, así el Tab entra al grupo y sale de él de un solo paso;
 * - las flechas eligen la opción siguiente/anterior (dando la vuelta en los extremos) y le
 *   pasan el foco; no desplazan la página; con Alt, Ctrl o Meta no hacen nada (atajos);
 * - un toque (o Enter/Espacio, que en un <button> son un click) elige; tocar la ya elegida no
 *   emite nada.
 * Con TalkBack no hay flechas: se recorre deslizando y se elige con doble toque (un click).
 */
export function usarGrupoDeRadio<V>(
  opciones: () => readonly { valor: V }[],
  elegida: () => V | null | undefined,
  elegir: (valor: V) => void,
) {
  const indiceElegido = computed(() => opciones().findIndex((o) => o.valor === elegida()))
  const indiceEnfocable = computed(() => Math.max(0, indiceElegido.value))

  return {
    estaElegida: (indice: number): boolean => indice === indiceElegido.value,
    tabindex: (indice: number): 0 | -1 => (indice === indiceEnfocable.value ? 0 : -1),
    alTocar(indice: number) {
      const opcion = opciones()[indice]
      if (opcion && indice !== indiceElegido.value) elegir(opcion.valor)
    },
    alTeclear(evento: KeyboardEvent, indice: number) {
      // Alt/Ctrl/Meta + flecha son atajos del sistema o del navegador (p. ej. Alt+← = atrás):
      // no se tocan ni se bloquean.
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return
      const paso = PASOS[evento.key]
      const total = opciones().length
      if (paso === undefined || total === 0) return
      evento.preventDefault()
      const siguiente = (indice + paso + total) % total
      const opcion = opciones()[siguiente]
      if (!opcion) return
      if (siguiente !== indiceElegido.value) elegir(opcion.valor)
      const grupo = (evento.currentTarget as HTMLElement | null)?.closest('[role="radiogroup"]')
      grupo?.querySelectorAll<HTMLElement>('[role="radio"]')[siguiente]?.focus()
    },
  }
}

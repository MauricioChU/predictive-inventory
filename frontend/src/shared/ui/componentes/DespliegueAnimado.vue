<script setup lang="ts">
/**
 * Despliegue: lo que aparece (un formulario en línea) abre en alto con una curva lenta que se
 * frena al final; el contenido se aclara y baja un poco, y empieza un instante después, cuando la
 * caja ya tiene lugar. Al cerrar, al revés y más rápido: el contenido se va primero y la caja se
 * recoge. Lo de abajo se desliza con la caja, sin saltos. Con `abierto` falso el contenido no
 * existe (sin él en el DOM, sin foco ni lectura). Al terminar de abrir se lleva a la vista (`scrollIntoView` nearest). Con "reducir movimiento" del sistema (o sin
 * Web Animations) pasa al instante.
 * El contenido va en el slot, sin relleno propio en la caja de afuera: la altura se mide en ella.
 */
defineProps<{ abierto: boolean }>()

/** Tokens de tokens.css (--duracion-despliegue[-sale], --curva-despliegue), leídos al animar. */
function ajustes(entrando: boolean): { duration: number; easing: string } {
  const estilo = getComputedStyle(document.documentElement)
  const nombre = entrando ? '--duracion-despliegue' : '--duracion-despliegue-sale'
  const duracion = Number.parseFloat(estilo.getPropertyValue(nombre))
  return {
    duration: Number.isFinite(duracion) ? duracion : entrando ? 320 : 220,
    easing: estilo.getPropertyValue('--curva-despliegue').trim() || 'ease-out',
  }
}

function sinMovimiento(el: Element): boolean {
  return (
    typeof el.animate !== 'function' ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  )
}

function animar(el: Element, hecho: () => void, entrando: boolean): void {
  if (sinMovimiento(el)) {
    if (entrando && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    }
    hecho()
    return
  }
  const caja = el as HTMLElement
  const contenido = caja.firstElementChild as HTMLElement | null
  const { duration, easing } = ajustes(entrando)
  const alto = `${caja.scrollHeight}px`
  const cerrado = { height: '0px' }
  const abierto = { height: alto }
  caja.style.overflow = 'hidden'
  const animacionCaja = caja.animate(entrando ? [cerrado, abierto] : [abierto, cerrado], {
    duration,
    easing,
    fill: 'both',
  })
  // El contenido: entra con un fundido y una leve bajada que arranca a ~30 % del tiempo (la caja
  // ya tiene lugar); sale en el primer ~55 %, antes de que la caja termine de cerrarse.
  const animacionContenido = contenido?.animate(
    entrando
      ? [
          { opacity: 0, transform: 'translateY(-0.5rem)' },
          { opacity: 1, transform: 'translateY(0)' },
        ]
      : [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-0.25rem)' },
        ],
    entrando
      ? { duration: duration * 0.75, delay: duration * 0.25, easing, fill: 'both' }
      : { duration: duration * 0.55, easing: 'ease-in', fill: 'both' },
  )
  const todas = [animacionCaja, animacionContenido].filter((a) => a !== undefined)
  const terminar = (): void => {
    caja.style.overflow = ''
    // Al abrir, soltar las animaciones: si el formulario cambia de alto después (un aviso de
    // error), la caja lo sigue y no queda fija en el alto medido.
    if (entrando) {
      todas.forEach((a) => a.cancel())
      // Ya abierto, se lleva a la vista dentro del área que se desplaza (el panel o la página);
      // el pie fijo se respeta con su scroll-padding. Sin movimiento: al instante.
      if (typeof caja.scrollIntoView === 'function') {
        caja.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
    hecho()
  }
  // `finished` se rechaza si alguna se cancela (el elemento se quitó a la mitad): igual se cierra.
  void Promise.all(todas.map((a) => a.finished)).then(terminar, terminar)
}
</script>

<template>
  <Transition
    :css="false"
    @enter="(el, hecho) => animar(el as Element, hecho, true)"
    @leave="(el, hecho) => animar(el as Element, hecho, false)"
  >
    <div v-if="abierto" class="despliegue">
      <div class="despliegue-contenido"><slot /></div>
    </div>
  </Transition>
</template>

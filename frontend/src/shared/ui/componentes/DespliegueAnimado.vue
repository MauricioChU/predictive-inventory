<script setup lang="ts">
/**
 * Despliegue: lo que aparece (un formulario en línea) crece en alto y se aclara; al irse, se
 * recoge. Con `abierto` falso el contenido no existe (sin él en el DOM, sin foco ni lectura).
 * Con "reducir movimiento" del sistema (o sin Web Animations) pasa al instante.
 * El contenido va en el slot, sin relleno propio en la caja de afuera: la altura se mide en ella.
 */
defineProps<{ abierto: boolean }>()

/** `--duracion-despliegue` y `--curva-despliegue` (tokens.css), leídos en el momento de animar. */
function ajustes(): { duration: number; easing: string } {
  const estilo = getComputedStyle(document.documentElement)
  const duracion = Number.parseFloat(estilo.getPropertyValue('--duracion-despliegue'))
  return {
    duration: Number.isFinite(duracion) ? duracion : 280,
    easing: estilo.getPropertyValue('--curva-despliegue').trim() || 'ease',
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
    hecho()
    return
  }
  const caja = el as HTMLElement
  const alto = `${caja.scrollHeight}px`
  const cerrado = { height: '0px', opacity: 0 }
  const abierto = { height: alto, opacity: 1 }
  caja.style.overflow = 'hidden'
  const animacion = caja.animate(entrando ? [cerrado, abierto] : [abierto, cerrado], {
    ...ajustes(),
    fill: 'both',
  })
  const terminar = (): void => {
    caja.style.overflow = ''
    hecho()
  }
  animacion.onfinish = terminar
  animacion.oncancel = terminar
}
</script>

<template>
  <Transition
    :css="false"
    @enter="(el, hecho) => animar(el as Element, hecho, true)"
    @leave="(el, hecho) => animar(el as Element, hecho, false)"
  >
    <div v-if="abierto" class="despliegue"><slot /></div>
  </Transition>
</template>

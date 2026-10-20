<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from 'vue'
import { CircleCheck } from 'lucide-vue-next'
import { pegarCifras } from '../texto-sin-cortes'
import { CLAVE_ANUNCIADOR } from '../anunciador'

const props = defineProps<{ titulo: string; detalle?: string }>()

const refEncabezado = ref<HTMLHeadingElement>()
// Hallazgo 4: el anunciador es opcional a propósito (segundo argumento de inject): si alguien
// monta este componente solo (p. ej. un test, o un uso futuro fuera de LayoutApp) sin proveerlo,
// el componente no falla — simplemente no anuncia nada y sigue mostrando su contenido visual.
const anunciador = inject(CLAVE_ANUNCIADOR, undefined)
let idAnuncio: number | undefined

onMounted(() => {
  idAnuncio = anunciador?.anunciar(
    props.detalle ? `${props.titulo}. ${props.detalle}` : props.titulo,
  )
  const encabezado = refEncabezado.value
  if (!encabezado) return
  if (!encabezado.hasAttribute('tabindex')) encabezado.setAttribute('tabindex', '-1')
  encabezado.focus({ preventScroll: true })
})

// m7 (ronda 4): al irse, retira SU mensaje de la región viva para no dejar texto viejo. Si
// otra pantalla ya anunció algo más nuevo, el anunciador no lo toca (N4).
onUnmounted(() => {
  if (idAnuncio !== undefined) anunciador?.limpiar(idAnuncio)
})
</script>

<template>
  <!--
    Hallazgo 4: sin role="status" (ver nota de la Ronda 1: insertar contenido "ya lleno" con
    role="status" no es confiable). En su lugar, al montarse anuncia el resultado con el
    anunciador global de LayoutApp (si hay uno provisto) y mueve el foco a su propio <h1> —
    así un lector de pantalla lo nota de las dos formas: el anuncio y, al enfocar el título,
    leerlo directamente.
  -->
  <div class="pantalla-exito aparece">
    <CircleCheck aria-hidden="true" class="icono" />
    <h1 ref="refEncabezado">{{ titulo }}</h1>
    <!-- Plan 12: "Total S/ 46.80" nunca se parte (RN-UX-09). -->
    <p v-if="detalle" class="detalle">{{ pegarCifras(detalle) }}</p>
    <slot />
  </div>
</template>

<style scoped>
/* Al centro del alto libre (sobre la navegación y el aviso Deshacer), con la animación
   compartida de aparecer (base.css): el ✓ crece y el resto sube suave. */
.pantalla-exito {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-block-size: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
  box-sizing: border-box;
  gap: var(--espacio-3);
  padding: var(--espacio-6) var(--espacio-4);
  text-align: center;
  color: var(--color-exito);
}
.icono {
  width: 4.5rem;
  height: 4.5rem;
  animation: exito-icono var(--duracion-hoja) var(--curva-hoja-entrar) both;
}
@keyframes exito-icono {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}
h1 {
  font-size: 1.375rem;
  margin: 0;
  color: var(--color-texto);
}
h1:focus {
  /* Foco programático, no interactivo (el usuario no lo tocó): sin anillo visible. */
  outline: none;
}
.detalle {
  margin: 0;
  color: var(--color-texto-suave);
}
</style>

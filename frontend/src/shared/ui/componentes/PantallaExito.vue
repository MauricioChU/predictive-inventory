<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from 'vue'
import { CircleCheck, Undo2 } from 'lucide-vue-next'
import { pegarCifras } from '../texto-sin-cortes'
import { CLAVE_ANUNCIADOR } from '../anunciador'

const props = withDefaults(
  defineProps<{
    titulo: string
    detalle?: string
    /** Al centro del alto libre (por defecto, en todas). `false` si la pantalla pone algo
     * debajo y centra el conjunto ella misma (Producto guardado y sus botones). */
    alCentro?: boolean
    /** RN-OP-18: con esto, el botón Deshacer va arriba a la derecha de la pantalla, con lo que
     * queda de los 10 s. Al vencer, quien la monta lo quita (pasa `undefined`). */
    segundosParaDeshacer?: number
    /** El título sigue ahí para el lector (y recibe el foco), pero no se ve: lo muestra quien
     * la contiene (el título de una hoja). */
    tituloOculto?: boolean
  }>(),
  { detalle: undefined, alCentro: true, segundosParaDeshacer: undefined, tituloOculto: false },
)
const emit = defineEmits<{ deshacer: [] }>()

const refEncabezado = ref<HTMLHeadingElement>()
// Hallazgo 4: el anunciador es opcional a propósito (segundo argumento de inject): si alguien
// monta este componente solo (p. ej. un test, o un uso futuro fuera de LayoutApp) sin proveerlo,
// el componente no falla — simplemente no anuncia nada y sigue mostrando su contenido visual.
const anunciador = inject(CLAVE_ANUNCIADOR, undefined)
let idAnuncio: number | undefined

onMounted(() => {
  // Al registrar desde abajo de una lista larga, la página quedaba scrolleada: el ✓ y Deshacer
  // (arriba) no se veían. Con el resultado a la vista, se empieza desde arriba.
  document.documentElement.scrollTop = 0
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
  <div
    class="pantalla-exito aparece"
    :class="{
      'pantalla-exito--al-centro': alCentro,
      'pantalla-exito--con-deshacer': segundosParaDeshacer !== undefined,
    }"
  >
    <!-- Sin anuncio propio de la cuenta (aria-hidden): el aviso de que se puede deshacer lo
         hace quien ofrece, una sola vez. -->
    <button
      v-if="segundosParaDeshacer !== undefined"
      type="button"
      class="deshacer"
      @click="emit('deshacer')"
    >
      <Undo2 aria-hidden="true" class="icono-deshacer" />
      <span>Deshacer</span>
      <span class="contador" aria-hidden="true">({{ segundosParaDeshacer }})</span>
    </button>
    <CircleCheck aria-hidden="true" class="icono" />
    <h1 ref="refEncabezado" :class="{ 'solo-lector': tituloOculto }">{{ titulo }}</h1>
    <!-- Plan 12: "Total S/ 46.80" nunca se parte (RN-UX-09). -->
    <p v-if="detalle" class="detalle">{{ pegarCifras(detalle) }}</p>
    <slot />
  </div>
</template>

<style scoped>
/* Con alCentro, al centro del alto libre (sobre la navegación y el aviso Deshacer), con la animación
   compartida de aparecer (base.css): el ✓ crece y el resto sube suave. */
.pantalla-exito {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  gap: var(--espacio-3);
  padding: var(--espacio-4) var(--espacio-4) var(--espacio-3);
  text-align: center;
  color: var(--color-exito);
}
.pantalla-exito--con-deshacer {
  /* Lugar para el botón: el ✓ y el título nunca quedan debajo de él. */
  padding-block-start: calc(var(--alto-toque) + var(--espacio-4));
}
.deshacer {
  position: absolute;
  inset-block-start: var(--espacio-2);
  inset-inline-end: var(--espacio-4);
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-2);
  min-block-size: var(--alto-toque);
  padding: var(--espacio-1) var(--espacio-3);
  border: 2px solid var(--color-texto);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  color: var(--color-texto);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.icono-deshacer {
  inline-size: 1.2em;
  block-size: 1.2em;
  flex: none;
}
.contador {
  font-weight: 400;
}
.pantalla-exito--al-centro {
  /* `safe`: si algo no entra, empieza arriba (nunca queda cortado por arriba). */
  justify-content: safe center;
  /* Alto fijo = el libre (ventana menos pie y relleno de <main>): así el resumen de lo
     registrado se achica y se desplaza por dentro en vez de alargar la página. */
  block-size: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--relleno-bloque, var(--espacio-4)));
}
.icono {
  flex: none;
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

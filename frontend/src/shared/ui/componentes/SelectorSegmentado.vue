<script setup lang="ts" generic="V extends string | number">
import { useId } from 'vue'
import { usarGrupoDeRadio } from '../grupo-de-radio'

const props = withDefaults(
  defineProps<{
    opciones: readonly { valor: V; etiqueta: string }[]
    modelValue: V
    /** Nombre del grupo ("Mostrar"). Siempre existe: el lector de pantalla lo necesita. */
    etiqueta: string
    /** Oculta la etiqueta a la vista (sigue nombrando al grupo para el lector de pantalla). */
    etiquetaOculta?: boolean
  }>(),
  { etiquetaOculta: false },
)
const emit = defineEmits<{ 'update:modelValue': [valor: V] }>()

const idEtiqueta = useId()
const grupo = usarGrupoDeRadio(
  () => props.opciones,
  () => props.modelValue,
  (valor) => emit('update:modelValue', valor),
)
</script>

<template>
  <div class="selector-segmentado">
    <span :id="idEtiqueta" class="etiqueta" :class="{ 'solo-lector': etiquetaOculta }">
      {{ etiqueta }}
    </span>
    <div role="radiogroup" :aria-labelledby="idEtiqueta" class="opciones">
      <button
        v-for="(opcion, indice) in opciones"
        :key="String(opcion.valor)"
        type="button"
        role="radio"
        class="opcion"
        :aria-checked="grupo.estaElegida(indice) ? 'true' : 'false'"
        :tabindex="grupo.tabindex(indice)"
        @click="grupo.alTocar(indice)"
        @keydown="grupo.alTeclear($event, indice)"
      >
        <span class="texto" :data-texto="opcion.etiqueta">{{ opcion.etiqueta }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.etiqueta {
  display: block;
  font-weight: 700;
  margin-bottom: var(--espacio-2);
}
/* Si no caben en una fila (320 px con letra Muy grande) se envuelven en dos o más: cada fila
   se reparte el ancho (flex 1 1 auto) y ningún segmento pasa del ancho del grupo. */
.opciones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--separacion-toque);
}
.opcion {
  flex: 1 1 auto;
  min-width: var(--alto-toque);
  max-width: 100%;
  min-height: var(--alto-toque);
  padding: var(--espacio-2) var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  color: var(--color-texto);
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.2;
  text-align: center;
  /* Solo parte una palabra si ella sola no cabe en todo el ancho. */
  overflow-wrap: break-word;
  cursor: pointer;
}
@media (hover: hover) {
  .opcion:hover {
    background: var(--color-superficie);
  }
}
/* RN-UX-04: la elegida no se distingue solo por el color: fondo, borde más grueso (sombra
   interior: no cambia el tamaño) y negrita. */
.opcion[aria-checked='true'] {
  background: var(--color-primario-suave);
  border-color: var(--color-primario);
  box-shadow: inset 0 0 0 2px var(--color-primario);
  color: var(--color-primario);
  font-weight: 700;
}
/* La negrita ensancha el texto: una copia invisible en negrita reserva ese ancho desde el
   principio, así elegir otra opción no mueve ni reacomoda los segmentos. */
.texto {
  display: inline-grid;
}
.texto::after {
  content: attr(data-texto);
  content: attr(data-texto) / '';
  font-weight: 700;
  height: 0;
  overflow: hidden;
  visibility: hidden;
}
</style>

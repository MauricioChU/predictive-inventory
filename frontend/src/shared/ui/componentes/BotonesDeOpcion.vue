<script setup lang="ts" generic="V extends string | number">
import { useId, type Component } from 'vue'
import { Circle, CircleCheck } from 'lucide-vue-next'
import { usarGrupoDeRadio } from '../grupo-de-radio'

const props = withDefaults(
  defineProps<{
    opciones: readonly { valor: V; etiqueta: string; icono?: Component }[]
    /** `null` mientras no se haya elegido nada (p. ej. el motivo de una merma). */
    modelValue: V | null
    /** Pregunta o nombre del grupo, visible ("¿Qué pasó?", "¿Cómo se vende?"). */
    etiqueta: string
    error?: string
  }>(),
  { error: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [valor: V] }>()

const id = useId()
const idEtiqueta = `${id}-etiqueta`
const idError = `${id}-error`
const grupo = usarGrupoDeRadio(
  () => props.opciones,
  () => props.modelValue,
  (valor) => emit('update:modelValue', valor),
)
</script>

<template>
  <div class="botones-de-opcion">
    <p :id="idEtiqueta" class="etiqueta">{{ etiqueta }}</p>
    <div
      role="radiogroup"
      class="opciones"
      :aria-labelledby="idEtiqueta"
      :aria-describedby="error ? idError : undefined"
      :aria-invalid="error ? 'true' : undefined"
    >
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
        <component :is="opcion.icono" v-if="opcion.icono" aria-hidden="true" class="icono" />
        <span class="texto">{{ opcion.etiqueta }}</span>
        <!-- RN-UX-04: la marca (círculo vacío / con ✓) dice "elegida" sin depender del color. -->
        <CircleCheck
          v-if="grupo.estaElegida(indice)"
          aria-hidden="true"
          class="marca marca--elegida"
        />
        <Circle v-else aria-hidden="true" class="marca" />
      </button>
    </div>
    <p v-if="error" :id="idError" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.etiqueta {
  font-weight: 700;
  margin: 0 0 var(--espacio-2);
}
.opciones {
  display: flex;
  flex-direction: column;
  gap: var(--separacion-toque);
}
/* Opción grande, a todo el ancho, como un botón principal (RN-UX-02: ≥ 56 px). Relleno,
   separaciones e íconos medidos para que a 320 px con letra Muy grande al texto le queden
   ~140 px: una palabra como "derramó" entra entera (antes se partía "derram|ó"). */
.opcion {
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
  width: 100%;
  min-height: var(--alto-boton-principal);
  padding: var(--espacio-2) var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-fondo);
  color: var(--color-texto);
  font-size: 1.125rem;
  font-weight: 400;
  line-height: 1.25;
  text-align: left;
  overflow-wrap: break-word;
  cursor: pointer;
}
@media (hover: hover) {
  .opcion:hover {
    background: var(--color-superficie);
  }
}
.opcion[aria-checked='true'] {
  background: var(--color-primario-suave);
  border-color: var(--color-primario);
  box-shadow: inset 0 0 0 2px var(--color-primario);
  color: var(--color-primario);
  font-weight: 700;
}
.opciones[aria-invalid='true'] .opcion:not([aria-checked='true']) {
  border-color: var(--color-peligro);
}
.texto {
  flex: 1;
  min-width: 0;
}
.icono,
.marca {
  width: 1.25em;
  height: 1.25em;
  min-width: 24px;
  min-height: 24px;
  flex: none;
}
.marca {
  /* RN-UX-03: ícono ≥ 4.5:1 también sobre el fondo de :hover (superficie). */
  color: var(--color-texto-suave);
}
.marca--elegida {
  color: var(--color-primario);
}
.error {
  color: var(--color-peligro);
  font-weight: 700;
  margin: var(--espacio-2) 0 0;
}
</style>

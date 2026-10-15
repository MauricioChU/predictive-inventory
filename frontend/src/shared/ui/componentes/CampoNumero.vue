<script setup lang="ts">
import { computed, useId } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    etiqueta: string
    modelValue: string
    paso?: number
    minimo?: number
    decimales?: boolean
    error?: string
    sufijo?: string
  }>(),
  { paso: 1, minimo: 0, decimales: false, error: undefined, sufijo: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [valor: string] }>()
const id = useId()
const idError = `${id}-error`
const valorNumerico = computed(() => Number(props.modelValue.replace(',', '.')) || 0)

function cambiar(delta: number) {
  const siguiente = Math.round((valorNumerico.value + delta) * 1000) / 1000
  if (siguiente < props.minimo) return
  emit('update:modelValue', String(siguiente))
}
</script>

<template>
  <div class="campo-numero">
    <label :for="id" class="etiqueta">{{ etiqueta }}</label>
    <div class="fila">
      <button type="button" class="paso" aria-label="Quitar uno" @click="cambiar(-paso)">
        <Minus aria-hidden="true" />
      </button>
      <input
        :id="id"
        :value="modelValue"
        :inputmode="decimales ? 'decimal' : 'numeric'"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? idError : undefined"
        autocomplete="off"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <span v-if="sufijo" class="sufijo">{{ sufijo }}</span>
      <button type="button" class="paso" aria-label="Agregar uno" @click="cambiar(paso)">
        <Plus aria-hidden="true" />
      </button>
    </div>
    <p v-if="error" :id="idError" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.etiqueta {
  display: block;
  font-weight: 700;
  margin-bottom: var(--espacio-2);
}
.fila {
  display: flex;
  align-items: stretch;
  gap: var(--separacion-toque);
}
input {
  flex: 1;
  min-width: 0;
  min-height: var(--alto-toque);
  text-align: center;
  font-size: 1.25rem;
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
}
.paso {
  inline-size: var(--alto-toque);
  block-size: var(--alto-toque);
  flex: none;
  display: grid;
  place-items: center;
  border: 2px solid var(--color-primario);
  border-radius: var(--radio-chico);
  background: var(--color-primario-suave);
  color: var(--color-primario);
  cursor: pointer;
}
.sufijo {
  align-self: center;
  font-weight: 700;
}
.error {
  color: var(--color-peligro);
  font-weight: 700;
  margin: var(--espacio-2) 0 0;
}
</style>

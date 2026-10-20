<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    etiqueta: string
    modelValue: string
    paso?: number
    minimo?: number
    /** Tope: "+" se deshabilita al llegar (p. ej. no separar más unidades de las que hay). */
    maximo?: number
    decimales?: boolean
    error?: string
    sufijo?: string
    /** La etiqueta solo para el lector de pantalla (la línea compacta del panel de venta, donde
     * el nombre del producto y su precio ya dicen qué se cuenta). Sigue siendo el <label>. */
    etiquetaOculta?: boolean
  }>(),
  {
    paso: 1,
    minimo: 0,
    maximo: undefined,
    decimales: false,
    error: undefined,
    sufijo: undefined,
    etiquetaOculta: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [valor: string] }>()
const id = useId()
const idError = `${id}-error`
const idSufijo = `${id}-sufijo`
const valorNumerico = computed(() => Number(props.modelValue.replace(',', '.')) || 0)

/** Redondea a milésimas enteras: evita los restos de coma flotante (2.3 - 0.1 = 2.1999…). */
const redondear = (valor: number): number => Math.round(valor * 1000) / 1000
// M10: botón "−" también deshabilitado de verdad (antes solo lo bloqueaba cambiar(), así que
// seguía pareciendo activo para quien usa el dedo o el mouse). La condición es "el próximo
// paso bajaría del mínimo" (valor - paso < minimo), no solo "ya estoy en el mínimo": con un
// paso distinto de 1 (p. ej. 0.5) se puede estar POR ENCIMA del mínimo y que el siguiente
// paso de todos modos lo cruce. m9: con el MISMO redondeo que usa cambiar(); sin él, mínimo
// 2.2, paso 0.1 y valor 2.3 se deshabilitaba (2.3 - 0.1 = 2.1999… < 2.2) aunque cambiar()
// sí habría aceptado bajar a 2.2.
const enMinimo = computed(() => redondear(valorNumerico.value - props.paso) < props.minimo)
const enMaximo = computed(
  () => props.maximo !== undefined && redondear(valorNumerico.value + props.paso) > props.maximo,
)
const describedBy = computed(() => {
  const ids = [props.sufijo ? idSufijo : null, props.error ? idError : null].filter(
    (valor): valor is string => valor !== null,
  )
  return ids.length > 0 ? ids.join(' ') : undefined
})

const refBotonMenos = ref<HTMLButtonElement>()
const refBotonMas = ref<HTMLButtonElement>()

// M10: si el botón "−" tenía el foco y se deshabilita (el navegador le quita el foco al
// deshabilitar un control), el foco no debe perderse (ir a <body>). N3 (ronda 4): va al botón
// "+", no al input — en Android, enfocar el input abre el teclado numérico sobre media
// pantalla sin que la persona lo haya pedido. Se usa el flush por defecto ("pre"), que corre
// ANTES de que Vue aplique el `disabled` al DOM real, así `document.activeElement` todavía es
// el botón en ese momento.
watch(enMinimo, (ahoraDeshabilitado) => {
  if (ahoraDeshabilitado && document.activeElement === refBotonMenos.value) {
    refBotonMas.value?.focus()
  }
})

// Igual con "+" al llegar al tope: el foco pasa a "−".
watch(enMaximo, (ahoraDeshabilitado) => {
  if (ahoraDeshabilitado && document.activeElement === refBotonMas.value) {
    refBotonMenos.value?.focus()
  }
})

function cambiar(delta: number) {
  const siguiente = redondear(valorNumerico.value + delta)
  if (siguiente < props.minimo) return
  if (props.maximo !== undefined && siguiente > props.maximo) return
  emit('update:modelValue', String(siguiente))
}
</script>

<template>
  <div class="campo-numero">
    <label :for="id" :class="etiquetaOculta ? 'solo-lector' : 'etiqueta'">{{ etiqueta }}</label>
    <div class="fila">
      <button
        ref="refBotonMenos"
        type="button"
        class="paso"
        aria-label="Quitar uno"
        :disabled="enMinimo"
        :aria-disabled="enMinimo ? 'true' : undefined"
        @click="cambiar(-paso)"
      >
        <Minus aria-hidden="true" />
      </button>
      <input
        :id="id"
        :value="modelValue"
        :inputmode="decimales ? 'decimal' : 'numeric'"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        autocomplete="off"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <!-- M10: el sufijo (p. ej. "kg") se asocia al input por aria-describedby, si no un
           lector de pantalla solo anuncia el número y pierde la unidad. -->
      <span v-if="sufijo" :id="idSufijo" class="sufijo">{{ sufijo }}</span>
      <button
        ref="refBotonMas"
        type="button"
        class="paso"
        aria-label="Agregar uno"
        :disabled="enMaximo"
        :aria-disabled="enMaximo ? 'true' : undefined"
        @click="cambiar(paso)"
      >
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
.paso:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

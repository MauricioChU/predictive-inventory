<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    abierto: boolean
    titulo: string
    mensaje: string
    textoConfirmar: string
    textoCancelar?: string
    peligro?: boolean
  }>(),
  { textoCancelar: 'Cancelar', peligro: false },
)
const emit = defineEmits<{ confirmar: []; cancelar: [] }>()

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement>()
const botonCancelar = ref<HTMLButtonElement>()

watch(
  () => props.abierto,
  async (abierto) => {
    await nextTick()
    if (abierto) {
      if (!dialogo.value?.open) dialogo.value?.showModal()
      botonCancelar.value?.focus()
    } else {
      dialogo.value?.close()
    }
  },
  { immediate: true },
)

function alCancelarNativo(evento: Event) {
  evento.preventDefault()
  emit('cancelar')
}
</script>

<template>
  <dialog
    ref="dialogo"
    class="dialogo-confirmacion"
    :aria-labelledby="idTitulo"
    @cancel="alCancelarNativo"
  >
    <h2 :id="idTitulo">{{ titulo }}</h2>
    <p>{{ mensaje }}</p>
    <div class="acciones">
      <button ref="botonCancelar" type="button" class="cancelar" @click="emit('cancelar')">
        {{ textoCancelar }}
      </button>
      <button
        type="button"
        class="confirmar"
        :class="{ 'confirmar--peligro': peligro }"
        @click="emit('confirmar')"
      >
        {{ textoConfirmar }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.dialogo-confirmacion {
  border: none;
  border-radius: var(--radio);
  padding: var(--espacio-5);
  max-width: min(90vw, 420px);
  box-shadow: 0 10px 40px rgb(0 0 0 / 0.25);
}
.dialogo-confirmacion::backdrop {
  background: rgb(0 0 0 / 0.45);
}
h2 {
  margin: 0 0 var(--espacio-3);
  font-size: 1.2rem;
}
p {
  margin: 0 0 var(--espacio-5);
  color: var(--color-texto-suave);
}
.acciones {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
.cancelar,
.confirmar {
  min-height: var(--alto-toque);
  border-radius: var(--radio-chico);
  font-weight: 700;
  cursor: pointer;
}
.cancelar {
  border: 2px solid var(--color-borde);
  background: var(--color-fondo);
  color: var(--color-texto);
}
.confirmar {
  border: 2px solid var(--color-primario);
  background: var(--color-primario);
  color: var(--color-primario-texto);
}
.confirmar--peligro {
  border-color: var(--color-peligro);
  background: var(--color-peligro);
}
</style>

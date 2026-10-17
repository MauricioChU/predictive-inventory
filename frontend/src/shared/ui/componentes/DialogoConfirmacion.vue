<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { pegarCifras } from '../texto-sin-cortes'

const props = withDefaults(
  defineProps<{
    abierto: boolean
    titulo: string
    mensaje: string
    textoConfirmar: string
    textoCancelar?: string
    peligro?: boolean
    /**
     * Qué opción recibe el foco al abrirse (la que elige Enter). Por defecto Cancelar: lo
     * seguro cuando se confirma algo riesgoso. "confirmar" cuando la spec fija esa opción por
     * defecto (RN-OP-14: "¿Actualizar el precio de compra…?", por defecto sí).
     */
    enfocar?: 'cancelar' | 'confirmar'
    /**
     * Qué hace el cierre nativo (Escape, o "atrás" en Android). Por defecto es Cancelar. Con
     * "cerrar" (plan 12, r1 M1) emite `cerrar`: se cierra SIN responder, para cuando las dos
     * opciones hacen algo (p. ej. las dos respuestas de RN-OP-14 registran la llegada).
     */
    cierreNativo?: 'cancelar' | 'cerrar'
  }>(),
  { textoCancelar: 'Cancelar', peligro: false, enfocar: 'cancelar', cierreNativo: 'cancelar' },
)
const emit = defineEmits<{ confirmar: []; cancelar: []; cerrar: [] }>()

const idTitulo = useId()
const dialogo = ref<HTMLDialogElement>()
const botonCancelar = ref<HTMLButtonElement>()
const botonConfirmar = ref<HTMLButtonElement>()

watch(
  () => props.abierto,
  async (abierto) => {
    await nextTick()
    if (abierto) {
      if (!dialogo.value?.open) dialogo.value?.showModal()
      ;(props.enfocar === 'confirmar' ? botonConfirmar : botonCancelar).value?.focus()
    } else {
      dialogo.value?.close()
    }
  },
  { immediate: true },
)

function alCancelarNativo(evento: Event) {
  evento.preventDefault()
  if (props.cierreNativo === 'cerrar') emit('cerrar')
  else emit('cancelar')
}
</script>

<template>
  <dialog
    ref="dialogo"
    class="dialogo-confirmacion"
    :aria-labelledby="idTitulo"
    @cancel="alCancelarNativo"
  >
    <!-- Plan 12: "S/ 2.60" o "1 L" nunca se parten en dos líneas (RN-UX-09). -->
    <h2 :id="idTitulo">{{ pegarCifras(titulo) }}</h2>
    <p>{{ pegarCifras(mensaje) }}</p>
    <div class="acciones">
      <button ref="botonCancelar" type="button" class="cancelar" @click="emit('cancelar')">
        {{ textoCancelar }}
      </button>
      <button
        ref="botonConfirmar"
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

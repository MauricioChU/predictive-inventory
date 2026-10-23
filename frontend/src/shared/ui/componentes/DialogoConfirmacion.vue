<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { pegarCifras } from '../texto-sin-cortes'

const props = withDefaults(
  defineProps<{
    abierto: boolean
    titulo: string
    /** El texto del diálogo. Con el slot por defecto (contenido propio, p. ej. una lista) puede ir vacío. */
    mensaje?: string
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
  {
    mensaje: '',
    textoCancelar: 'Cancelar',
    peligro: false,
    enfocar: 'cancelar',
    cierreNativo: 'cancelar',
  },
)
const emit = defineEmits<{ confirmar: []; cancelar: []; cerrar: [] }>()

const idTitulo = useId()
/** Plan 17: el mensaje es la descripción del diálogo (el lector la dice junto al título). */
const idMensaje = useId()
const dialogo = ref<HTMLDialogElement>()
const botonCancelar = ref<HTMLButtonElement>()
const botonConfirmar = ref<HTMLButtonElement>()

/** Quien tenía el foco al abrirse (p. ej. el botón "Archivar producto"). */
let abridor: HTMLElement | null = null

/**
 * Plan 17 (patrón de diálogo de WAI-ARIA): al cerrarse, el foco vuelve a quien lo abrió, si
 * sigue en la pantalla y si el foco quedó en el diálogo (o perdido en <body>). Si la pantalla ya
 * lo llevó a otro lado (p. ej. al resultado), no se toca.
 */
function cerrarYDevolverFoco(): void {
  const elemento = dialogo.value
  const activo = document.activeElement
  const focoPerdido = !activo || activo === document.body || !!elemento?.contains(activo)
  elemento?.close()
  if (focoPerdido && abridor?.isConnected) abridor.focus()
  abridor = null
}

watch(
  () => props.abierto,
  async (abierto) => {
    await nextTick()
    if (abierto) {
      if (!dialogo.value?.open) {
        const activo = document.activeElement
        abridor =
          activo instanceof HTMLElement &&
          activo !== document.body &&
          !dialogo.value?.contains(activo)
            ? activo
            : null
        dialogo.value?.showModal()
      }
      ;(props.enfocar === 'confirmar' ? botonConfirmar : botonCancelar).value?.focus()
    } else if (dialogo.value?.open) {
      cerrarYDevolverFoco()
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
    class="dialogo-confirmacion dialogo-animado"
    :inert="!abierto"
    :aria-hidden="abierto ? undefined : 'true'"
    :aria-labelledby="idTitulo"
    :aria-describedby="mensaje || $slots.default ? idMensaje : undefined"
    @cancel="alCancelarNativo"
  >
    <!-- Mientras se va (animación de salida) ya no cuenta para teclado ni lector: inert + aria-hidden. -->
    <!-- Plan 12: "S/ 2.60" o "1 L" nunca se parten en dos líneas (RN-UX-09). -->
    <h2 :id="idTitulo">{{ pegarCifras(titulo) }}</h2>
    <p v-if="mensaje" :id="idMensaje">{{ pegarCifras(mensaje) }}</p>
    <!-- Contenido propio (una lista): es la descripción del diálogo. -->
    <div v-if="$slots.default" :id="idMensaje" class="contenido">
      <slot />
    </div>
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
.contenido {
  margin: 0 0 var(--espacio-5);
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

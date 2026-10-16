<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Banknote, CircleCheck, Coins, TriangleAlert } from 'lucide-vue-next'
import type { Billete } from '../tipos-de-productos'
import CampoNumero from './CampoNumero.vue'

const props = withDefaults(
  defineProps<{
    /** "S/ 14.63" */
    textoTotal: string
    billetes: readonly Billete[]
    /** v-model: con cuánto paga, tal como se escribe ("20", "25,50"). */
    modelValue: string
    /** "Vuelto S/ 5.37" / "Faltan S/ 4.63": lo calcula quien lo usa. */
    mensaje?: string
    /** Acompaña al mensaje con ícono y color; el texto ya lo dice solo (RN-UX-04). */
    tonoMensaje?: 'normal' | 'exito' | 'atencion'
    /** Pausa de escritura tras la cual se anuncia el mensaje (ms). Al tocar un billete o
     * "Exacto" se anuncia en el acto. */
    esperaAnuncioMs?: number
  }>(),
  { mensaje: '', tonoMensaje: 'normal', esperaAnuncioMs: 600 },
)
const emit = defineEmits<{ 'update:modelValue': [valor: string]; exacto: [] }>()

const id = useId()
const idPregunta = `${id}-pregunta`
const ICONOS = { normal: Coins, exito: CircleCheck, atencion: TriangleAlert } as const
const iconoDelMensaje = computed(() => ICONOS[props.tonoMensaje])
/** Un monto nunca se parte de su "S/" al envolver ("Vuelto S/" | "5.37" se lee mal): espacio
 * duro entre los dos. Solo en lo que se ve; la región viva lleva el texto tal cual. */
const mensajeVisible = computed(() => props.mensaje.replace(/S\/ /g, 'S/\u00a0'))

/*
  Ronda 1: el mensaje se VE al instante, pero se ANUNCIA (región viva aparte) recién cuando la
  persona deja de escribir el monto: si no, TalkBack leería "Faltan S/ 13.63", "Faltan S/
  4.63"… en cada tecla. Un toque (billete o "Exacto") es una decisión: se anuncia en el acto.
*/
const anunciado = ref(props.mensaje)
let temporizador: ReturnType<typeof setTimeout> | undefined
/** El próximo cambio de mensaje viene de un toque (vale solo para ese cambio). */
let anunciarEnElActo = false

function cancelarAnuncio() {
  if (temporizador === undefined) return
  clearTimeout(temporizador)
  temporizador = undefined
}

watch(
  () => props.mensaje,
  (mensaje) => {
    cancelarAnuncio()
    if (anunciarEnElActo || mensaje === '') {
      anunciado.value = mensaje
      return
    }
    temporizador = setTimeout(() => {
      temporizador = undefined
      anunciado.value = mensaje
    }, props.esperaAnuncioMs)
  },
)
onBeforeUnmount(cancelarAnuncio)

/** Un toque: la pantalla recalcula el mensaje en su handler (sincrónico) y el watcher, que corre
 * antes de este nextTick, lo anuncia sin esperar. */
function alTocar(accion: () => void) {
  anunciarEnElActo = true
  accion()
  void nextTick(() => {
    anunciarEnElActo = false
  })
}
</script>

<template>
  <div class="selector-de-billetes">
    <p class="total">
      <span class="etiqueta-total">Total a cobrar</span>
      <span class="valor-total">{{ textoTotal }}</span>
    </p>

    <div class="pago" role="group" :aria-labelledby="idPregunta">
      <p :id="idPregunta" class="pregunta">¿Con cuánto paga?</p>
      <div class="billetes">
        <button
          v-for="billete in billetes"
          :key="billete.valor"
          type="button"
          class="billete"
          @click="alTocar(() => emit('update:modelValue', billete.valor))"
        >
          <Banknote aria-hidden="true" class="icono" />
          <span>{{ billete.etiqueta }}</span>
        </button>
        <button
          type="button"
          class="billete billete--exacto"
          @click="alTocar(() => emit('exacto'))"
        >
          <Coins aria-hidden="true" class="icono" />
          <span>Exacto</span>
        </button>
      </div>
      <CampoNumero
        class="monto"
        etiqueta="Paga con (S/)"
        decimales
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>

    <!-- Lo que se ve, al instante. Oculto al lector: él lo recibe de la región de abajo. -->
    <p class="mensaje" :class="`mensaje--${tonoMensaje}`" aria-hidden="true">
      <template v-if="mensaje">
        <component :is="iconoDelMensaje" aria-hidden="true" class="icono-mensaje" />
        <span>{{ mensajeVisible }}</span>
      </template>
    </p>
    <!-- RN-UX-15: la región viva existe desde el principio y solo cambia su texto (tras la pausa
         de escritura, o en el acto con un toque): así se anuncia el vuelto o lo que falta. -->
    <p class="solo-lector" aria-live="polite" aria-atomic="true">{{ anunciado }}</p>
  </div>
</template>

<style scoped>
.selector-de-billetes {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-4);
}
.total {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0 var(--espacio-3);
  margin: 0;
}
.etiqueta-total {
  font-weight: 700;
  color: var(--color-texto-suave);
}
.valor-total {
  font-size: clamp(1.1rem, 12cqi, 1.75rem);
  font-weight: 700;
  white-space: nowrap;
}
.pago {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
}
.monto {
  /* En PC no se estira a todo el ancho de la columna. */
  max-inline-size: 22rem;
}
.pregunta {
  margin: 0;
  font-weight: 700;
}
/* Celular: 2 columnas y "Exacto" a todo el ancho; con lugar (≥ 38rem, que sigue la letra
   elegida), los 5 en una fila. */
.billetes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--separacion-toque);
}
.billete--exacto {
  grid-column: 1 / -1;
}
@container (min-width: 38rem) {
  .billetes {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .billete--exacto {
    grid-column: auto;
  }
}
.billete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-2);
  min-block-size: var(--alto-boton-principal);
  min-inline-size: 0;
  padding-inline: var(--espacio-2);
  border: 2px solid var(--color-primario);
  border-radius: var(--radio);
  background: var(--color-primario-suave);
  color: var(--color-primario);
  font-size: 1.1rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 80ms ease-out;
}
.billete:active {
  transform: scale(0.97);
}
.billete--exacto {
  background: var(--color-primario);
  color: var(--color-primario-texto);
}
.icono {
  inline-size: 1.3em;
  block-size: 1.3em;
  flex: none;
}
/* Muy angosto (celular con letra Grande o Muy grande): sin el dibujo del billete, que no deja
   lugar para "S/ 100" en una sola línea. El texto basta (RN-UX-04 pide texto en los íconos,
   no íconos en los textos). */
@container (max-width: 15rem) {
  .billete .icono {
    display: none;
  }
}
.mensaje {
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
  min-block-size: 2.5rem;
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  overflow-wrap: break-word;
}
.mensaje--exito {
  color: var(--color-exito);
}
.mensaje--atencion {
  color: var(--color-advertencia);
}
.icono-mensaje {
  inline-size: 1.2em;
  block-size: 1.2em;
  flex: none;
}
</style>

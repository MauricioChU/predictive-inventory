<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Undo2 } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ mensaje: string; segundos?: number }>(), { segundos: 10 })
const emit = defineEmits<{ deshacer: []; cerrar: [] }>()

const restante = ref(props.segundos)
let temporizador: ReturnType<typeof setInterval> | undefined

function detener() {
  if (temporizador === undefined) return
  clearInterval(temporizador)
  temporizador = undefined
}

onMounted(() => {
  temporizador = setInterval(() => {
    restante.value -= 1
    if (restante.value <= 0) {
      detener()
      emit('cerrar')
    }
  }, 1000)
})

onUnmounted(detener)

function alDeshacer() {
  detener()
  emit('deshacer')
}
</script>

<template>
  <!--
    Q2: este componente es puramente visual. El anuncio para lectores de pantalla lo hace
    LayoutApp con una región aria-live persistente (ver app/aviso-deshacer.ts `anuncio`), para
    no insertar contenido ya anunciado de golpe ni repetir el anuncio en cada segundo que
    cambia `restante`. Por eso el número regresivo va con aria-hidden.
  -->
  <div class="aviso-deshacer">
    <p class="mensaje">{{ mensaje }}</p>
    <button type="button" class="deshacer" @click="alDeshacer">
      <Undo2 aria-hidden="true" class="icono" />
      <span>Deshacer</span>
      <span class="contador" aria-hidden="true">({{ restante }})</span>
    </button>
  </div>
</template>

<style scoped>
.aviso-deshacer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-4);
  padding: var(--espacio-3) var(--espacio-4);
  border-radius: var(--radio);
  background: var(--color-texto);
  color: var(--color-fondo);
}
.mensaje {
  margin: 0;
  font-weight: 700;
}
.deshacer {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-1);
  min-height: var(--alto-toque);
  padding-inline: var(--espacio-3);
  border: 2px solid var(--color-fondo);
  border-radius: var(--radio-chico);
  background: transparent;
  color: var(--color-fondo);
  font-weight: 700;
  cursor: pointer;
  flex: none;
}
.icono {
  width: 1.2em;
  height: 1.2em;
}
.contador {
  font-weight: 400;
}

/* M5: el foco azul estándar casi no se ve sobre este fondo oscuro (~2.3:1). */
.aviso-deshacer :focus-visible {
  outline-color: var(--color-foco-sobre-oscuro);
}
</style>

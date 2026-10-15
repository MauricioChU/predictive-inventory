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
    Q2: este componente es puramente visual. El anuncio para lectores de pantalla lo hace el
    anunciador compartido (app/anunciador.ts) en la región aria-live persistente de LayoutApp;
    el contexto del aviso (app/aviso-deshacer.ts, `mostrar`) le pasa el mensaje. Así no se
    inserta contenido ya anunciado de golpe ni se repite el anuncio en cada segundo que cambia
    `restante`. Por eso el número regresivo va con aria-hidden.
  -->
  <div class="aviso-deshacer">
    <div class="cuerpo">
      <p class="mensaje">{{ mensaje }}</p>
      <button type="button" class="deshacer" @click="alDeshacer">
        <Undo2 aria-hidden="true" class="icono" />
        <span>Deshacer</span>
        <span class="contador" aria-hidden="true">({{ restante }})</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/*
  N5 (ronda 4): a 320–360 px con letra Muy grande el botón (flex: none) dejaba al mensaje sin
  espacio y, con el overflow-wrap:anywhere global, el mensaje se partía en una letra por línea
  y la barra inferior crecía a casi toda la pantalla. Ahora:
  - el aviso es contenedor de consulta: si es angosto (< 26rem, que sigue la letra elegida)
    apila el mensaje arriba y el botón Deshacer debajo, a todo el ancho;
  - el mensaje se envuelve por palabras (break-word solo parte una palabra que sola no cabe);
  - el alto máximo lo fija quien lo monta (--aviso-alto-maximo, 40dvh si nadie lo dice): si
    el mensaje fuera larguísimo se desplaza adentro y el botón sigue siempre visible.
*/
.aviso-deshacer {
  container-type: inline-size;
  border-radius: var(--radio);
  background: var(--color-texto);
  color: var(--color-fondo);
  overflow-wrap: break-word;
}
.cuerpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  gap: var(--espacio-3) var(--espacio-4);
  padding: var(--espacio-3) var(--espacio-4);
  max-height: var(--aviso-alto-maximo, 40dvh);
}
.mensaje {
  margin: 0;
  font-weight: 700;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
}
.deshacer {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0 var(--espacio-2);
  min-height: var(--alto-toque);
  min-width: 0;
  max-width: 100%;
  padding: var(--espacio-1) var(--espacio-3);
  border: 2px solid var(--color-fondo);
  border-radius: var(--radio-chico);
  background: transparent;
  color: var(--color-fondo);
  font-weight: 700;
  cursor: pointer;
}
.icono {
  width: 1.2em;
  height: 1.2em;
  flex: none;
}
.contador {
  font-weight: 400;
}

@container (max-width: 26rem) {
  .cuerpo {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    padding: var(--espacio-3);
  }
  .deshacer {
    width: 100%;
  }
}

/* M5: el foco azul estándar casi no se ve sobre este fondo oscuro (~2.3:1). */
.aviso-deshacer :focus-visible {
  outline-color: var(--color-foco-sobre-oscuro);
}
</style>

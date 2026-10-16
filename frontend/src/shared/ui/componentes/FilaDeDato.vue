<script setup lang="ts">
import { computed } from 'vue'
import { pegarCifras } from '../texto-sin-cortes'

const props = withDefaults(
  defineProps<{
    etiqueta: string
    /** Valor ya formateado: "12 unid.", "S/ 1.20", "Lejía 1 L". */
    textoValor: string
    /** Fila importante (p. ej. "Total"): letra más grande y negrita, no solo color. */
    destacado?: boolean
  }>(),
  { destacado: false },
)
const valor = computed(() => pegarCifras(props.textoValor))
</script>

<template>
  <dl class="fila-de-dato" :class="{ 'fila-de-dato--destacado': destacado }">
    <!-- Cada fila es su propio <dl> (dt + dd): válido sin depender de que quien la usa la
         envuelva en otra lista. -->
    <dt class="etiqueta">{{ etiqueta }}</dt>
    <dd class="valor">{{ valor }}</dd>
  </dl>
</template>

<style scoped>
/*
  RN-UX-09: etiqueta a la izquierda y valor a la derecha mientras quepan en una línea; si no
  caben (320 px con letra Muy grande, o un valor largo), el valor baja a su propia línea y se
  queda a la derecha, como en una boleta. Nada se sale: los dos se envuelven por palabras y un
  monto nunca se parte (pegarCifras).
*/
.fila-de-dato {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espacio-1) var(--espacio-4);
  margin: 0;
  padding-block: var(--espacio-2);
  border-bottom: 1px solid color-mix(in srgb, var(--color-borde) 40%, transparent);
  overflow-wrap: break-word;
}
.etiqueta {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--color-texto-suave);
}
.valor {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  margin: 0 0 0 auto;
  text-align: right;
  font-weight: 700;
  color: var(--color-texto);
}
.fila-de-dato--destacado .etiqueta {
  color: var(--color-texto);
  font-weight: 700;
}
.fila-de-dato--destacado .valor {
  font-size: 1.25rem;
}
</style>

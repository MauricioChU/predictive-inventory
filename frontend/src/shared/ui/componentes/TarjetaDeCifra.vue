<script setup lang="ts">
import { computed } from 'vue'
import { largoSinCorte, pegarCifras } from '../texto-sin-cortes'

const props = withDefaults(
  defineProps<{
    /** "Hoy ganaste". */
    titulo: string
    /** Cifra ya formateada: "S/ 48.20". */
    textoValor: string
    /** "Vendiste S/ 162.50". */
    textoDetalle?: string
    /** Solo cambia el aspecto: lo que significa la cifra lo dice el texto (RN-UX-04). */
    tono?: 'normal' | 'exito' | 'peligro'
  }>(),
  { textoDetalle: undefined, tono: 'normal' },
)

const valor = computed(() => pegarCifras(props.textoValor))
const medida = computed(() => ({ '--caracteres': String(largoSinCorte(props.textoValor)) }))
</script>

<template>
  <div class="tarjeta-de-cifra" :class="`tarjeta-de-cifra--${tono}`">
    <!-- Título y cifra en UN párrafo: el lector de pantalla lee "Hoy ganaste S/ 48.20" de una
         vez, no dos datos sueltos. El espacio explícito los separa también al leerlos. -->
    <p class="cifra">
      <span class="titulo">{{ titulo }}</span
      >{{ ' ' }}<span class="valor" :style="medida">{{ valor }}</span>
    </p>
    <p v-if="textoDetalle" class="detalle">{{ pegarCifras(textoDetalle) }}</p>
  </div>
</template>

<style scoped>
.tarjeta-de-cifra {
  /* La cifra ajusta su letra al ancho real de la tarjeta (cqi), no al del viewport. */
  container-type: inline-size;
  padding: var(--espacio-4);
  border-radius: var(--radio);
  border-left: 6px solid var(--color-primario);
  background: var(--color-superficie);
  color: var(--color-texto);
  overflow-wrap: break-word;
}
.cifra {
  margin: 0;
}
.titulo {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-texto-suave);
}
/*
  RN-UX-09: la cifra va en letra muy grande (hasta 2rem), pero el monto entero ("S/ 12 345.67")
  nunca se parte (pegarCifras) ni se sale de la tarjeta: la letra baja lo justo para que el
  trozo más largo (--caracteres letras, ~0.62em cada una en negrita) entre en el ancho de la
  tarjeta (100cqi). Sin consultas de contenedor, queda en 1.5rem y, como último recurso, el
  trozo se parte.
*/
.valor {
  display: block;
  font-size: 1.5rem;
  font-size: clamp(1rem, calc(100cqi / (max(var(--caracteres), 1) * 0.62)), 2rem);
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.detalle {
  margin: var(--espacio-2) 0 0;
  color: var(--color-texto-suave);
}
.tarjeta-de-cifra--exito {
  border-left-color: var(--color-exito);
  background: var(--color-exito-suave);
}
.tarjeta-de-cifra--exito .valor {
  color: var(--color-exito);
}
.tarjeta-de-cifra--peligro {
  border-left-color: var(--color-peligro);
  background: var(--color-peligro-suave);
}
.tarjeta-de-cifra--peligro .valor {
  color: var(--color-peligro);
}
</style>

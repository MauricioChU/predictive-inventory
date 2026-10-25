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
    /** Menos alto (Inicio entra en una pantalla): menos relleno y el detalle más pegado. */
    compacta?: boolean
    /** Título a la izquierda y cifra a la derecha, en una sola línea (si no caben, una bajo la otra). */
    enLinea?: boolean
    /** Más relleno y cifra más grande (solo si hay alto de sobra): sustituye a la compacta. */
    alta?: boolean
    /** La cifra principal de una pantalla (Inicio: lo vendido hoy): título arriba y la cifra mucho más grande. */
    principal?: boolean
  }>(),
  {
    textoDetalle: undefined,
    tono: 'normal',
    compacta: false,
    enLinea: false,
    alta: false,
    principal: false,
  },
)

const valor = computed(() => pegarCifras(props.textoValor))
const medida = computed(() => ({ '--caracteres': String(largoSinCorte(props.textoValor)) }))
</script>

<template>
  <div
    class="tarjeta-de-cifra"
    :class="[
      `tarjeta-de-cifra--${tono}`,
      {
        'tarjeta-de-cifra--compacta': compacta,
        'tarjeta-de-cifra--en-linea': enLinea,
        'tarjeta-de-cifra--alta': alta,
        'tarjeta-de-cifra--principal': principal,
      },
    ]"
  >
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
  /* Ocupa el ancho de su contenedor (con container-type, sin ancho propio colapsaría en un
     flex o grid que se ajusta a su contenido). */
  inline-size: 100%;
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
  Límites a 320 px con letra Muy grande (tarjeta de ~218 px útiles): caben ~7 letras en 2rem y
  ~14 en el piso de 1rem. El monto más grande de la app, "S/ 99 999.99" (12 letras), va a
  ~29 px sin partirse; un trozo de más de ~14 letras se partiría.
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
.tarjeta-de-cifra--compacta {
  padding-block: var(--espacio-2);
}
.tarjeta-de-cifra--compacta .valor {
  line-height: 1.05;
}
.tarjeta-de-cifra--compacta .detalle {
  margin-block-start: 0;
}
.tarjeta-de-cifra--en-linea .cifra {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0 var(--espacio-2);
}
.tarjeta-de-cifra--en-linea .valor {
  font-size: 1.4rem;
}
/* Cifra secundaria (Inicio: la ganancia bajo el total): una línea baja, sin aire de más. */
.tarjeta-de-cifra--compacta.tarjeta-de-cifra--en-linea {
  padding-block: var(--espacio-1);
}
/* Más alta, con la cifra más grande: ocupa el aire que sobra (Inicio con ventas, sin detalle). */
.tarjeta-de-cifra--alta {
  padding-block: var(--espacio-3);
}
.tarjeta-de-cifra--alta .valor {
  font-size: 1.5rem;
}
/* Cifra principal: la más grande de la pantalla (hasta 2.5rem), el monto entero sin partirse. */
.tarjeta-de-cifra--principal {
  padding-block: var(--espacio-2);
}
.tarjeta-de-cifra--principal .titulo {
  line-height: 1.2;
}
.tarjeta-de-cifra--principal .valor {
  font-size: 2rem;
  font-size: clamp(1.25rem, calc(100cqi / (max(var(--caracteres), 1) * 0.62)), 2.5rem);
  line-height: 1.05;
}
.tarjeta-de-cifra--principal .detalle {
  margin-block-start: var(--espacio-1);
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

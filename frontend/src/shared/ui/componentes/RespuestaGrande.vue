<script setup lang="ts">
import { computed, inject, onUnmounted, watch } from 'vue'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-vue-next'
import { CLAVE_ANUNCIADOR } from '../anunciador'
import { largoSinCorte, pegarCifras } from '../texto-sin-cortes'

const props = defineProps<{
  /**
   * La frase de RN-AN-16: "Sí, compra ~12 unid.", "No hace falta: te alcanza para ~20 días".
   * Se anuncia al aparecer y cada vez que cambia. Para volver a anunciar una frase idéntica
   * (otro producto con la misma respuesta), cambia la :key del componente: se monta de nuevo.
   */
  texto: string
  /** atencion = hay que comprar · exito = alcanza · peligro = no compres. El texto lo dice igual. */
  tono: 'atencion' | 'exito' | 'peligro'
}>()

// Mismo lenguaje visual que InsigniaEstado: ⚠ queda poco, ✓ bien, ✕ no.
const ICONOS = { atencion: TriangleAlert, exito: CircleCheck, peligro: CircleX } as const
const icono = computed(() => ICONOS[props.tono])
const frase = computed(() => pegarCifras(props.texto))
const medida = computed(() => ({ '--caracteres': String(largoSinCorte(props.texto)) }))

// RN-UX-15: la frase se anuncia con el anunciador global de LayoutApp (opcional, como en
// PantallaExito: montado suelto no falla) al aparecer y cada vez que cambia. Al cambiar o al
// irse retira SOLO su anuncio anterior, nunca uno más nuevo de otra pantalla.
const anunciador = inject(CLAVE_ANUNCIADOR, undefined)
let idAnuncio: number | undefined

function retirar() {
  if (idAnuncio !== undefined) anunciador?.limpiar(idAnuncio)
  idAnuncio = undefined
}

watch(
  () => props.texto,
  (texto) => {
    retirar()
    idAnuncio = anunciador?.anunciar(texto)
  },
  { immediate: true },
)
onUnmounted(retirar)
</script>

<template>
  <div class="respuesta-grande" :class="`respuesta-grande--${tono}`">
    <!-- Sin aria-live propio: el anuncio va por la región global (ver arriba). -->
    <component :is="icono" aria-hidden="true" class="icono" />
    <p class="texto" :style="medida">{{ frase }}</p>
  </div>
</template>

<style scoped>
.respuesta-grande {
  /* Ocupa el ancho de su contenedor (con container-type, sin ancho propio colapsaría en un
     flex o grid que se ajusta a su contenido). */
  inline-size: 100%;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--espacio-3);
  padding: var(--espacio-5) var(--espacio-4);
  border: 3px solid currentcolor;
  border-radius: var(--radio);
  overflow-wrap: break-word;
}
.icono {
  width: 3rem;
  height: 3rem;
  flex: none;
}
/*
  Letra muy grande (hasta 2rem) en el color del texto (contraste máximo, RN-UX-03). Baja lo
  justo para que el trozo más largo que no se parte ("~12 unid.", "alcanza") entre en el ancho
  de la caja; nunca por debajo de 1.25rem. Sin consultas de contenedor, 1.75rem.
  Límites a 320 px con letra Muy grande (caja de ~218 px útiles): caben ~7 letras seguidas en
  2rem y ~11 en el piso de 1.25rem. Las frases de RN-AN-16 tienen trozos de 7 a 10 letras
  ("alcanza", "~12 días", "~120 unid."); uno de más de ~11 letras se partiría.
*/
.texto {
  width: 100%;
  margin: 0;
  font-size: 1.75rem;
  font-size: clamp(1.25rem, calc(100cqi / (max(var(--caracteres), 1) * 0.62)), 2rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-texto);
}
.respuesta-grande--atencion {
  color: var(--color-advertencia);
  background: var(--color-advertencia-suave);
}
.respuesta-grande--exito {
  color: var(--color-exito);
  background: var(--color-exito-suave);
}
.respuesta-grande--peligro {
  color: var(--color-peligro);
  background: var(--color-peligro-suave);
}
</style>

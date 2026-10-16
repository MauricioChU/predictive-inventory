<script setup lang="ts">
import { ref, useId, type Component } from 'vue'
import { ChevronDown, CircleCheck } from 'lucide-vue-next'
import { formatearEntero, plural } from '@/shared/domain/formato'

defineProps<{
  /** "Agotados", "Queda poco", "Precios para revisar". */
  etiqueta: string
  cantidad: number
  icono: Component
  /** Solo el aspecto: lo que significa lo dice la etiqueta (RN-UX-04). */
  tono: 'peligro' | 'atencion'
}>()

const abierta = ref(false)
const idLista = useId()
</script>

<template>
  <!--
    Atención (04-torre-de-control): cada grupo dice cuántos productos tiene y "abre su lista".
    Es un botón que muestra u oculta la lista justo debajo (aria-expanded), sin cambiar de
    pantalla. Sin productos no hay nada que abrir: es una línea de texto, no un botón.
  -->
  <div class="fila-de-atencion" :class="`fila-de-atencion--${tono}`">
    <button
      v-if="cantidad > 0"
      type="button"
      class="cabecera"
      :aria-expanded="abierta ? 'true' : 'false'"
      :aria-controls="idLista"
      @click="abierta = !abierta"
    >
      <component :is="icono" aria-hidden="true" class="icono" />
      <span class="textos">
        <span class="etiqueta">{{ etiqueta }}</span>
        {{ ' '
        }}<span class="cantidad"
          >{{ formatearEntero(cantidad) }} {{ plural(cantidad, 'producto', 'productos') }}</span
        >
      </span>
      <ChevronDown aria-hidden="true" class="chevron" />
    </button>
    <p v-else class="cabecera cabecera--sin-productos">
      <CircleCheck aria-hidden="true" class="icono icono--bien" />
      <span class="textos">
        <span class="etiqueta">{{ etiqueta }}</span>
        {{ ' ' }}<span class="cantidad">Ninguno</span>
      </span>
    </p>
    <div v-if="cantidad > 0" v-show="abierta" :id="idLista" class="lista">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.fila-de-atencion {
  --tono: var(--color-advertencia);
  --tono-suave: var(--color-advertencia-suave);
}
.fila-de-atencion--peligro {
  --tono: var(--color-peligro);
  --tono-suave: var(--color-peligro-suave);
}
/* Ícono · textos · flecha en una fila; si no caben, la etiqueta y la cantidad se acomodan en
   dos líneas en el medio, pero el ícono y la flecha quedan a los lados (nunca sueltos). */
.cabecera {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--espacio-3);
  inline-size: 100%;
  min-block-size: var(--alto-toque);
  margin: 0;
  padding: var(--espacio-2) var(--espacio-3);
  border: 2px solid var(--tono);
  border-left-width: 6px;
  border-radius: var(--radio-chico);
  background: var(--tono-suave);
  color: var(--color-texto);
  text-align: start;
  overflow-wrap: break-word;
}
button.cabecera {
  cursor: pointer;
}
.cabecera--sin-productos {
  border-color: color-mix(in srgb, var(--color-borde) 45%, transparent);
  background: var(--color-fondo);
}
.icono {
  inline-size: 1.4em;
  block-size: 1.4em;
  flex: none;
  color: var(--tono);
}
.icono--bien {
  color: var(--color-exito);
}
.cabecera--sin-productos {
  grid-template-columns: auto minmax(0, 1fr);
}
.textos {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 var(--espacio-3);
  min-inline-size: 0;
}
.etiqueta {
  font-weight: 700;
}
.cantidad {
  font-weight: 700;
  white-space: nowrap;
}
.chevron {
  inline-size: 1.4em;
  block-size: 1.4em;
  flex: none;
  color: var(--tono);
  transition: transform 150ms ease-out;
}
.cabecera[aria-expanded='true'] .chevron {
  transform: rotate(180deg);
}
.lista {
  padding: var(--espacio-2) 0 0 var(--espacio-3);
}
</style>

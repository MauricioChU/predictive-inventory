<script setup lang="ts">
import { ref, type Component } from 'vue'
import { usarAltoObservado } from '../alto-observado'
import BotonPrincipal from './BotonPrincipal.vue'

withDefaults(
  defineProps<{
    /** "Total" */
    etiqueta: string
    /** "S/ 14.63" */
    textoTotal: string
    /** "Cobrar" */
    textoAccion: string
    icono?: Component
    deshabilitado?: boolean
  }>(),
  { icono: undefined, deshabilitado: false },
)
const emit = defineEmits<{ accion: [] }>()

// Plan 12 (WCAG 2.4.11): publica su alto real en <html> (--alto-barra-de-total) mientras está
// montada. LayoutApp lo suma a scroll-padding-bottom: el elemento que recibe el foco por teclado
// (p. ej. el "+" de una línea del carrito) nunca queda escondido debajo de esta barra.
const refBarra = ref<HTMLElement>()
usarAltoObservado(refBarra, { variable: '--alto-barra-de-total' })
</script>

<template>
  <!--
    Principio 1 (06-experiencia-de-uso): la acción principal, grande y abajo, al alcance del
    pulgar. Va pegada (sticky) al fondo de la columna donde se pone — no fixed: reserva su propio
    espacio, así al final de la lista nunca tapa la última línea. En celular queda justo encima
    del pie global (navegación + aviso Deshacer), cuyo alto real publica LayoutApp en
    --alto-pie; desde 1024 px la navegación va al costado y lo único abajo es el aviso Deshacer
    (--alto-aviso).
  -->
  <div ref="refBarra" class="barra-de-total">
    <p class="resumen">
      <span class="etiqueta">{{ etiqueta }}</span>
      <span class="total">{{ textoTotal }}</span>
    </p>
    <BotonPrincipal
      class="accion"
      :texto="textoAccion"
      :icono="icono"
      :deshabilitado="deshabilitado"
      @click="emit('accion')"
    />
  </div>
</template>

<style scoped>
.barra-de-total {
  container-type: inline-size; /* para el cqi del total */
  position: sticky;
  bottom: var(--alto-pie, 0px);
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-3) var(--espacio-4);
  padding: var(--espacio-3) var(--espacio-4);
  border: 2px solid var(--color-primario);
  border-radius: var(--radio);
  background: var(--color-fondo);
  /* Sombra hacia arriba: se nota que flota sobre la lista que pasa por debajo. */
  box-shadow: var(--sombra-flotante);
}
/* Mismo corte que LayoutApp.vue (@media (min-width: 1024px), línea 151): desde ahí la
   navegación va al costado y lo único pegado abajo es el aviso Deshacer. Si ese corte cambia,
   cambiar este también. */
@media (min-width: 1024px) {
  .barra-de-total {
    bottom: var(--alto-aviso, 0px);
  }
}
.resumen {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0 var(--espacio-3);
  flex: 1 1 10rem;
  min-inline-size: 0;
  margin: 0;
}
.etiqueta {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-texto-suave);
}
.total {
  /* Un monto nunca se parte ("S/ 12" | "345.67" se leería como otro número): si no entra a
     1.6rem en una barra angosta (320 px, letra Muy grande), la letra se achica con el ancho
     de la propia barra (cqi), sin bajar de 1.1rem. */
  font-size: clamp(1.1rem, 13cqi, 1.6rem);
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
}
.accion {
  flex: 1 1 12rem;
}
</style>

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
    <!-- Envoltura: la barra es el contenedor (container-type) y lo de adentro se acomoda según
         su ancho real (plan 17: forma compacta en celular con letra grande). -->
    <div class="contenido">
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
  </div>
</template>

<style scoped>
.barra-de-total {
  container-type: inline-size; /* para el cqi del total */
  position: sticky;
  bottom: var(--alto-pie, 0px);
  z-index: 5;
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
.contenido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espacio-3) var(--espacio-4);
  padding: var(--espacio-3) var(--espacio-4);
}
.accion {
  flex: 1 1 12rem;
}

/*
 * Plan 17 — forma compacta (celular con letra Grande o Muy grande: la barra mide menos de
 * 22rem). Antes eran dos filas (etiqueta y total arriba, el botón abajo) y a 320 px con letra
 * Muy grande la barra ocupaba ~200 de 740 px. Ahora la etiqueta va en su propia línea, chica, y
 * el total y el botón comparten una fila. Si el texto del botón no entra al lado del total
 * ("Confirmar venta", "Registrar llegada", o un total muy largo), el botón baja entero a su
 * propia fila, a todo el ancho: nunca se parte una palabra ni se sale de la barra.
 */
@container (max-width: 22rem) {
  .contenido {
    gap: var(--espacio-1) var(--separacion-toque);
    padding: var(--espacio-1) var(--espacio-2) var(--espacio-2);
  }
  .resumen {
    display: contents;
  }
  .etiqueta {
    flex: 1 0 100%;
    line-height: 1.2;
  }
  .total {
    flex: none;
    font-size: clamp(1rem, 9cqi, 1.1rem);
  }
  .contenido .accion {
    flex: 1 1 auto;
    inline-size: auto;
    padding-inline: var(--espacio-1);
    font-size: 1rem;
    white-space: nowrap;
  }
  .contenido .accion :deep(.icono) {
    width: 1.2em;
    height: 1.2em;
  }
}
/* Muy angosta (320–360 px con letra Muy grande): sin el ícono el botón cabe al lado del total.
   El texto queda (RN-UX-04: el ícono acompaña al texto, nunca al revés). */
@container (max-width: 13.5rem) {
  .contenido .accion :deep(.icono) {
    display: none;
  }
}
</style>

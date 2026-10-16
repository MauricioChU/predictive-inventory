<script setup lang="ts">
import { useId } from 'vue'

/**
 * Disposición de Vender y Llegó mercadería (06-experiencia-de-uso, Responsive):
 * - celular: una columna — buscador, carrito y la BarraDeTotal pegada abajo;
 * - PC (≥ 1024 px): buscador a la izquierda y carrito a la derecha. La columna del carrito queda
 *   a la vista mientras se recorren los resultados (sticky) y, si tiene muchas líneas, las
 *   desplaza ella misma: la barra del total sigue siempre al pie de la columna.
 */
defineProps<{ tituloCarrito: string }>()
const idTitulo = useId()
</script>

<template>
  <div class="disposicion-de-carrito">
    <div class="columna-buscador">
      <slot name="buscador" />
    </div>
    <section class="columna-carrito" :aria-labelledby="idTitulo">
      <h2 :id="idTitulo" class="titulo-carrito" tabindex="-1">{{ tituloCarrito }}</h2>
      <div class="lineas-del-carrito">
        <slot name="carrito" />
      </div>
      <slot name="total" />
    </section>
  </div>
</template>

<style scoped>
.disposicion-de-carrito {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
}
.columna-buscador,
.columna-carrito {
  min-inline-size: 0;
}
.columna-carrito {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--espacio-3);
}
.titulo-carrito {
  margin: 0;
  font-size: 1.125rem;
}
.titulo-carrito:focus {
  outline: none;
}
.lineas-del-carrito {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-3);
  min-inline-size: 0;
}

/* Mismo corte que LayoutApp.vue (navegación al costado). */
@media (min-width: 1024px) {
  .disposicion-de-carrito {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
    gap: var(--espacio-6);
  }
  .columna-carrito {
    position: sticky;
    top: var(--espacio-4);
    /* Toda la columna entra en la ventana (y deja libre el aviso Deshacer si aparece). */
    max-block-size: calc(100dvh - 2 * var(--espacio-4) - var(--alto-aviso, 0px));
    grid-template-rows: auto minmax(0, 1fr) auto;
  }
  .lineas-del-carrito {
    overflow-y: auto;
    /* Aire para el anillo de foco de los campos que tocan el borde de la zona desplazable. */
    padding: 4px;
    margin: -4px;
    align-content: start;
  }
}
</style>

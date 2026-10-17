<script setup lang="ts">
import { useId } from 'vue'

/**
 * Disposición de Vender y Llegó mercadería (06-experiencia-de-uso, Responsive):
 * - celular: una columna — buscador, carrito y la BarraDeTotal pegada abajo;
 * - PC (≥ 1024 px): buscador a la izquierda y carrito a la derecha. La columna del carrito queda
 *   a la vista mientras se recorren los resultados (sticky) y, si tiene muchas líneas, las
 *   desplaza ella misma: la barra del total sigue siempre al pie de la columna.
 *
 * r1 (RN-UX-02): en celular la barra del total es hija directa de la disposición (la columna es
 * `display: contents`), no de la sección del carrito. Así su "sticky" puede subir todo lo que
 * haga falta para quedar entera ENCIMA del pie (navegación + aviso Deshacer): dentro de la
 * sección no podía subir más arriba del título del carrito y quedaba debajo del aviso, con
 * "Cobrar" tapado.
 */
defineProps<{ tituloCarrito: string }>()
const idTitulo = useId()
</script>

<template>
  <div class="disposicion-de-carrito">
    <div class="columna-buscador">
      <slot name="buscador" />
    </div>
    <div class="columna-carrito">
      <section class="carrito" :aria-labelledby="idTitulo">
        <h2 :id="idTitulo" class="titulo-carrito" tabindex="-1">{{ tituloCarrito }}</h2>
        <div class="lineas-del-carrito">
          <slot name="carrito" />
        </div>
      </section>
      <slot name="total" />
    </div>
  </div>
</template>

<style scoped>
.disposicion-de-carrito {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
}
.columna-buscador,
.carrito {
  min-inline-size: 0;
}
/* Celular: la columna no dibuja caja; la sección y la barra son celdas de la disposición. */
.columna-carrito {
  display: contents;
}
.carrito {
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
  /* Columna flexible con alto máximo: si las líneas no entran, se achica SOLO la zona de las
     líneas (min-block-size: 0) y esa zona se desplaza; el título y la barra del total quedan
     siempre a la vista, y la barra nunca tapa una línea. */
  .columna-carrito {
    position: sticky;
    top: var(--espacio-4);
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
    min-inline-size: 0;
    /* Toda la columna entra en la ventana YA al abrir la pantalla, cuando todavía está debajo
       del título (~6rem, que siguen la letra elegida), y deja libre el aviso Deshacer si
       aparece: la barra del total nunca queda debajo del borde ni tapa una línea. */
    max-block-size: calc(100dvh - 7rem - var(--alto-aviso, 0px));
  }
  .carrito {
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    min-block-size: 0;
  }
  .lineas-del-carrito {
    flex: 0 1 auto;
    min-block-size: 0;
    overflow-y: auto;
    /* Aire para el anillo de foco de los campos que tocan el borde de la zona desplazable. */
    padding: 4px;
    margin: -4px;
    align-content: start;
  }
  .columna-carrito > :last-child:not(.carrito) {
    flex: none;
  }
}
</style>

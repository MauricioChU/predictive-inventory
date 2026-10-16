<script setup lang="ts">
import type { EstadoVacioDeLista, ProductoDeLista } from '../tipos-de-productos'
import EstadoVacio from './EstadoVacio.vue'
import TarjetaDeProducto from './TarjetaDeProducto.vue'

withDefaults(
  defineProps<{
    productos: ProductoDeLista[]
    vacio: EstadoVacioDeLista
    /** Nombre de la lista para el lector de pantalla ("Resultados", "Productos"). */
    etiqueta?: string
  }>(),
  { etiqueta: undefined },
)
const emit = defineEmits<{ elegir: [id: string]; accion: [] }>()
</script>

<template>
  <!-- role="list" explícito: con list-style: none algunos lectores (Safari/VoiceOver) dejan de
       anunciar la lista y la cantidad de elementos. -->
  <ul v-if="productos.length > 0" class="lista-de-productos" role="list" :aria-label="etiqueta">
    <li v-for="producto in productos" :key="producto.id" class="item">
      <TarjetaDeProducto
        :nombre="producto.nombre"
        :imagen="producto.imagen"
        :categoria="producto.categoria"
        :texto-stock="producto.textoStock"
        :texto-precio="producto.textoPrecio"
        :estado="producto.estado"
        :texto-secundario="producto.textoSecundario"
        @elegir="emit('elegir', producto.id)"
      />
    </li>
  </ul>
  <EstadoVacio
    v-else
    :titulo="vacio.titulo"
    :descripcion="vacio.descripcion"
    :accion="vacio.accion"
    @accion="emit('accion')"
  />
</template>

<style scoped>
.lista-de-productos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  /* RN-UX-02: al menos 8 px entre elementos tocables. */
  gap: max(var(--separacion-toque), var(--espacio-2));
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  min-inline-size: 0;
}
</style>

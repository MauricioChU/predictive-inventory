<script setup lang="ts">
import type { ProductoVista } from '@/modules/catalogo'
import { formatearCantidad } from '@/shared/domain/formato'
import FotoDeProducto from '@/shared/ui/componentes/FotoDeProducto.vue'

/** Qué producto es (foto, nombre, categoría) y, si se pide, cuánto hay anotado. */
withDefaults(
  defineProps<{
    producto: Pick<ProductoVista, 'nombre' | 'categoriaNombre' | 'unidad' | 'stock'>
    foto?: Blob
    tamano?: 'mediana' | 'grande'
    /** "Hay 10 unid." (Registrar pérdida) o "En la app: 10 unid." (Contar stock). */
    prefijoStock?: string
  }>(),
  { foto: undefined, tamano: 'mediana', prefijoStock: undefined },
)
</script>

<template>
  <div class="resumen-del-producto" :class="`resumen-del-producto--${tamano}`">
    <FotoDeProducto
      class="foto"
      :imagen="foto"
      :nombre="producto.nombre"
      :categoria="producto.categoriaNombre"
      :tamano="tamano"
      decorativa
    />
    <div class="datos">
      <h2 class="nombre">{{ producto.nombre }}</h2>
      <p v-if="producto.categoriaNombre" class="categoria">{{ producto.categoriaNombre }}</p>
      <p v-if="prefijoStock" class="stock">
        {{ prefijoStock }} {{ formatearCantidad(producto.stock, producto.unidad) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.resumen-del-producto {
  display: flex;
  align-items: center;
  gap: var(--espacio-4);
  min-inline-size: 0;
}
/* Foto grande (Contar): para reconocer el producto en el estante, arriba y centrada. */
.resumen-del-producto--grande {
  flex-direction: column;
  text-align: center;
}
.resumen-del-producto--grande .foto {
  /* Grande para reconocerlo en el estante, pero sin empujar "¿Cuántos hay?" fuera de la
     pantalla en un celular de 320 px con letra Muy grande. */
  --foto-lado: min(55%, 11rem);
}
.datos {
  min-inline-size: 0;
}
.nombre {
  margin: 0;
  font-size: 1.25rem;
  overflow-wrap: break-word;
}
.categoria,
.stock {
  margin: var(--espacio-1) 0 0;
}
.categoria {
  color: var(--color-texto-suave);
}
.stock {
  font-weight: 700;
}
</style>

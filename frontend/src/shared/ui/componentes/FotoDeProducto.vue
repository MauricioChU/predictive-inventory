<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { iconoDeCategoria } from '../iconos-de-categoria'

const props = withDefaults(
  defineProps<{
    imagen?: Blob | string
    nombre: string
    categoria?: string
    tamano: 'chica' | 'mediana' | 'grande'
    /** Dentro de un control que ya dice el nombre (tarjeta, acceso rápido, fila del carrito):
     * la foto no lo repite (alt vacío / oculta), así el lector no lo lee dos veces. */
    decorativa?: boolean
  }>(),
  { imagen: undefined, categoria: undefined, decorativa: false },
)

/** URL temporal (blob:) de la foto guardada como Blob; se libera al cambiarla o al salir. */
const urlDeObjeto = ref<string>()
/** La foto no se pudo crear o no cargó (archivo dañado): se muestra el ícono de la categoría. */
const fallo = ref(false)

function liberar() {
  if (urlDeObjeto.value === undefined) return
  URL.revokeObjectURL(urlDeObjeto.value)
  urlDeObjeto.value = undefined
}

watch(
  () => props.imagen,
  (imagen) => {
    liberar()
    fallo.value = false
    if (!(imagen instanceof Blob)) return
    try {
      urlDeObjeto.value = URL.createObjectURL(imagen)
    } catch {
      fallo.value = true
    }
  },
  { immediate: true },
)
onBeforeUnmount(liberar)

const src = computed(() => {
  if (fallo.value) return undefined
  if (typeof props.imagen === 'string') return props.imagen || undefined
  return urlDeObjeto.value
})
const icono = computed(() => iconoDeCategoria(props.categoria))

/** Sin foto, el contenedor es la "imagen" (role="img" + nombre); decorativa, se oculta. */
const atributosDelContenedor = computed(() => {
  if (src.value) return {}
  return props.decorativa
    ? { 'aria-hidden': 'true' as const }
    : { role: 'img', 'aria-label': props.nombre }
})
</script>

<template>
  <!-- <span> (no <div>): va dentro de botones, que solo admiten contenido de frase. -->
  <span
    class="foto-de-producto"
    :class="[`foto-de-producto--${tamano}`, { 'foto-de-producto--sin-foto': !src }]"
    v-bind="atributosDelContenedor"
  >
    <img
      v-if="src"
      :src="src"
      :alt="decorativa ? '' : nombre"
      class="imagen"
      loading="lazy"
      decoding="async"
      draggable="false"
      @error="fallo = true"
    />
    <component :is="icono" v-else aria-hidden="true" class="icono" />
  </span>
</template>

<style scoped>
/*
  Cuadrada siempre (aspect-ratio) y con medidas que siguen la letra elegida (rem) pero con
  topes en px: con letra Muy grande en 320 px la foto no se come el espacio del nombre.
  Quien la usa puede fijar otra medida con la variable --foto-lado (p. ej. una tarjeta
  angosta), y nunca pasa del ancho que tiene (max-inline-size).
*/
.foto-de-producto {
  --foto-lado-base: clamp(64px, 4rem, 88px);
  display: grid;
  place-items: center;
  flex: none;
  inline-size: var(--foto-lado, var(--foto-lado-base));
  max-inline-size: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radio-chico);
  /* Borde fino que separa una foto clara del fondo blanco. */
  border: 1px solid var(--color-borde-foto);
  background: var(--color-superficie);
}
.foto-de-producto--chica {
  --foto-lado-base: clamp(48px, 2.75rem, 64px);
}
.foto-de-producto--grande {
  --foto-lado-base: min(100%, 16rem);
  border-radius: var(--radio);
}
.foto-de-producto--sin-foto {
  /* Ícono en primario sobre primario suave: ~8:1 (RN-UX-03 pide 4.5:1 para íconos). */
  background: var(--color-primario-suave);
  color: var(--color-primario);
}
.imagen {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
.icono {
  inline-size: 52%;
  block-size: 52%;
  min-inline-size: 24px;
  min-block-size: 24px;
  stroke-width: 1.75;
}
</style>

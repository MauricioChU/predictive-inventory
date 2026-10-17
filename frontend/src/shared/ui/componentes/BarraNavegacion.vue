<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { House } from 'lucide-vue-next'
import { iconoDeRuta } from '../iconos-de-rutas'

const props = withDefaults(defineProps<{ contadorControl?: number }>(), {
  contadorControl: undefined,
})
const router = useRouter()

const destinos = computed(() =>
  router.options.routes
    .filter((ruta) => ruta.meta?.enNavegacion)
    .map((ruta) => ({
      nombre: String(ruta.name),
      ruta: ruta.path,
      titulo: String(ruta.meta?.titulo ?? ''),
      icono: iconoDeRuta(String(ruta.meta?.icono ?? '')) ?? House,
    })),
)

const textoContador = computed(() => {
  const n = props.contadorControl ?? 0
  return n === 1 ? '1 producto necesita atención' : `${n} productos necesitan atención`
})
</script>

<template>
  <nav class="barra-navegacion" aria-label="Navegación principal">
    <ul class="lista">
      <li v-for="destino in destinos" :key="destino.nombre" class="item">
        <RouterLink :to="destino.ruta" class="enlace">
          <component :is="destino.icono" aria-hidden="true" class="icono" />
          <span class="etiqueta-texto">{{ destino.titulo }}</span>
          <template v-if="destino.nombre === 'control' && contadorControl">
            <span class="insignia" aria-hidden="true">{{ contadorControl }}</span>
            <span class="solo-lector">{{ textoContador }}</span>
          </template>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.barra-navegacion {
  width: 100%;
}
.lista {
  /* S1: grid con minmax(0, 1fr) (NO 1fr a secas) en cada columna. Un 1fr sin minmax hereda el
     ancho mínimo de contenido de la columna (el "min-content" de la etiqueta más larga sin
     envolver), así que si esa etiqueta no entra en 320px, la COLUMNA se ensancha más allá del
     viewport en vez de encogerse — y si algo "arriba" recorta ese desborde (overflow:hidden),
     el contenido queda tapado sin que scrollWidth del documento lo delate. minmax(0, 1fr)
     permite que la columna se encoja hasta 0 antes de preferir desbordar. */
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--separacion-toque);
}
.item {
  min-width: 0;
}
.enlace {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-1);
  min-height: var(--alto-toque);
  min-width: 48px;
  padding-block: var(--espacio-2);
  padding-inline: 2px;
  text-decoration: none;
  color: var(--color-texto-suave);
  font-weight: 400;
  border-radius: var(--radio-chico);
  max-width: 100%;
  overflow: visible;
  /* S1: este enlace es el "contenedor de tamaño" (container query) que la etiqueta usa para
     saber cuánto espacio tiene de verdad, sin adivinar el ancho del viewport. */
  container-type: inline-size;
}
.etiqueta-texto {
  /* S1: la palabra entera, siempre — nunca se envuelve ni se parte a media palabra, y nunca
     se recorta con puntos suspensivos (sería ilegible: "Produc…"). El tamaño sigue el ajuste
     de letra elegido (rem) MIENTRAS entre en el carril; si el carril es más angosto que eso
     (320 px con letra Muy grande), se encoge con cqi (unidad relativa al ancho del propio
     contenedor, no del viewport) justo lo necesario para que la palabra más larga ("Productos")
     entre siempre en una sola línea. */
  display: block;
  white-space: nowrap;
  overflow: visible;
  overflow-wrap: normal;
  word-break: keep-all;
  hyphens: none;
  font-size: min(0.8rem, 20cqi);
}
.enlace.router-link-active {
  color: var(--color-primario);
  background: var(--color-primario-suave);
  font-weight: 700;
}
/* S2 (RN-UX-04): el destino activo no se distingue solo por color — además lleva un fondo
   (tile), más peso de letra (400 → 700; solo esos dos pesos están cargados) y una barra de
   acento (abajo en celular, a la izquierda en el costado). */
.enlace.router-link-active::after {
  content: '';
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 2px;
  height: 3px;
  border-radius: 999px;
  background: var(--color-primario);
}
.icono {
  /* RN-UX-03/ruling: tamaño real, no un clamp que podía bajar de los 24px recomendados. */
  width: 1.5rem;
  height: 1.5rem;
  min-width: 24px;
  min-height: 24px;
  flex: none;
}
.insignia {
  position: absolute;
  top: 2px;
  right: 4px;
  min-width: 1.25rem;
  height: 1.25rem;
  padding-inline: 0.25rem;
  border-radius: 999px;
  background: var(--color-peligro);
  color: var(--color-primario-texto);
  font-size: 0.7rem;
  display: grid;
  place-items: center;
}

@media (min-width: 1024px) {
  .lista {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-flow: row;
  }
  .enlace {
    flex-direction: row;
    justify-content: flex-start;
    padding-inline: var(--espacio-3);
  }
  .etiqueta-texto {
    /* Columna lateral de 260px: de sobra para cualquier destino, sigue la letra sin acotar. */
    font-size: 1rem;
  }
  .insignia {
    position: static;
    margin-left: auto;
  }
  /* S2: en el costado, el acento va a la izquierda en vez de abajo. */
  .enlace.router-link-active::after {
    left: 0;
    right: auto;
    top: 10%;
    bottom: 10%;
    width: 3px;
    height: auto;
  }
}
</style>

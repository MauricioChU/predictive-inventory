<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Gauge, House, Package, PackagePlus, ShoppingCart } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ contadorControl?: number }>(), {
  contadorControl: undefined,
})
const router = useRouter()

const ICONOS: Record<string, typeof House> = {
  house: House,
  'shopping-cart': ShoppingCart,
  'package-plus': PackagePlus,
  package: Package,
  gauge: Gauge,
}

const destinos = computed(() =>
  router.options.routes
    .filter((ruta) => ruta.meta?.enNavegacion)
    .map((ruta) => ({
      nombre: String(ruta.name),
      ruta: ruta.path,
      titulo: String(ruta.meta?.titulo ?? ''),
      icono: ICONOS[String(ruta.meta?.icono ?? '')] ?? House,
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
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--separacion-toque);
}
.item {
  flex: 1;
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
  /* S1: padding horizontal mínimo abajo de 1024px — el ancho es escaso (5 destinos en 320 px)
     y cada punto de relleno se lo quita a la etiqueta. */
  padding-block: var(--espacio-2);
  padding-inline: 2px;
  text-decoration: none;
  color: var(--color-texto-suave);
  font-weight: 600;
  border: 2px solid transparent;
  border-radius: var(--radio-chico);
  max-width: 100%;
}
.etiqueta-texto {
  /* S1: nunca en dos líneas ni partida a mitad de palabra (RN-UX-09/RN-UX-12). El tamaño
     escala con la letra elegida (rem) pero queda acotado para que las 5 quepan en 320 px;
     si aun así no entra completa, se recorta con puntos suspensivos en vez de desbordar
     o envolver — nunca tapa el contenido ni rompe la palabra. */
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: keep-all;
  hyphens: none;
  font-size: clamp(11px, 0.7rem, 15px);
}
.enlace.router-link-active {
  color: var(--color-primario);
  background: var(--color-primario-suave);
  font-weight: 800;
}
/* S2 (RN-UX-04): el destino activo no se distingue solo por color — además lleva un fondo,
   más peso de letra y una barra de acento (abajo en celular, a la izquierda en el costado). */
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
  width: clamp(20px, 1.3rem, 26px);
  height: clamp(20px, 1.3rem, 26px);
  flex: none;
}
.insignia {
  position: absolute;
  top: 0;
  right: calc(50% - 1.5rem);
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
    flex-direction: column;
  }
  .item {
    flex: none;
  }
  .enlace {
    flex-direction: row;
    justify-content: flex-start;
    padding-inline: var(--espacio-3);
  }
  .etiqueta-texto {
    /* Más espacio horizontal disponible (barra lateral de 260px): la etiqueta puede crecer más. */
    font-size: clamp(14px, 1rem, 18px);
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

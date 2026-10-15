<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Gauge, House, Package, PackagePlus, ShoppingCart } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ contadorControl?: number }>(), { contadorControl: undefined })
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
          <span>{{ destino.titulo }}</span>
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
  padding: var(--espacio-2);
  text-decoration: none;
  color: var(--color-texto-suave);
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: var(--radio-chico);
}
.enlace.router-link-active {
  color: var(--color-primario);
}
.icono {
  width: 1.5rem;
  height: 1.5rem;
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
    font-size: 1rem;
    padding-inline: var(--espacio-3);
  }
  .insignia {
    position: static;
    margin-left: auto;
  }
}
</style>

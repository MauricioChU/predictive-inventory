<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { alTerminarAnimacion } from '../al-terminar-animacion'

/**
 * Hoja inferior (patrón común, como el panel de venta abierto): una hoja a toda la pantalla
 * sobre la navegación, con la asa gris (tocable) y la flecha ⌄ para cerrar, el velo (tocarlo
 * también cierra) y Escape. Siempre hay botón (RN-UX-05: nada de deslizar). Quien la usa la
 * muestra con `v-if` y la saca al recibir `cerrar`, que llega recién cuando la hoja terminó de
 * bajar; lo de atrás, que es suyo, lo deja `inert` mientras esté abierta.
 * Al abrir, el foco va al título; al cerrar, vuelve al botón que la abrió (`volverA`).
 */
const props = withDefaults(
  defineProps<{
    titulo: string
    etiquetaDeCierre?: string
    /** El botón que la abrió. Sin él, el que tenía el foco al crearse (al ponerse `inert` lo de
     * atrás el foco se pierde: conviene pasarlo). */
    volverA?: HTMLElement | null
  }>(),
  { etiquetaDeCierre: 'Cerrar', volverA: null },
)
const emit = defineEmits<{ cerrar: [] }>()

const idTitulo = useId()
const refTitulo = ref<HTMLElement>()
const refHoja = ref<HTMLElement>()
const cerrando = ref(false)
const abridor =
  props.volverA ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)

onMounted(() => {
  refTitulo.value?.focus()
})
onBeforeUnmount(() => {
  // Recién cuando quien la usa terminó de sacar el `inert` de lo de atrás.
  void nextTick(() => {
    if (abridor?.isConnected) abridor.focus()
  })
})

/** Baja despacio (animación compartida de base.css) y recién después avisa. */
async function cerrar(): Promise<void> {
  if (cerrando.value) return
  cerrando.value = true
  await nextTick()
  alTerminarAnimacion(refHoja.value, () => emit('cerrar'))
}
</script>

<template>
  <section class="hoja-inferior" :aria-labelledby="idTitulo" @keydown.esc="cerrar">
    <div
      class="velo"
      :class="cerrando ? 'velo-sale' : 'velo-entra'"
      aria-hidden="true"
      @click="cerrar"
    />
    <div ref="refHoja" class="hoja" :class="cerrando ? 'hoja-sale' : 'hoja-entra'">
      <div class="cabecera">
        <!-- Tocar la asa también cierra (comodidad: el botón es lo que lee el lector). -->
        <div class="asa" aria-hidden="true" @click="cerrar" />
        <h2 :id="idTitulo" ref="refTitulo" class="titulo" tabindex="-1">{{ titulo }}</h2>
        <button type="button" class="cerrar" :aria-label="etiquetaDeCierre" @click="cerrar">
          <ChevronDown aria-hidden="true" class="icono" />
        </button>
      </div>
      <div class="cuerpo"><slot /></div>
    </div>
  </section>
</template>

<style scoped>
.hoja {
  position: fixed;
  inset-inline: 0;
  inset-block: var(--espacio-3) var(--alto-pie, 0px);
  z-index: 8;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-inline-size: var(--ancho-contenido);
  margin-inline: auto;
  border: 1px solid var(--color-borde-foto);
  border-block-end: none;
  border-radius: 22px 22px 0 0;
  background: var(--color-superficie);
  box-shadow: var(--sombra-flotante);
}
.velo {
  position: fixed;
  inset: 0 0 var(--alto-pie, 0px) 0;
  z-index: 7;
  background: rgb(18 26 24 / 0.45);
}
.cabecera {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'asa asa'
    'titulo cerrar';
  align-items: center;
  gap: 0 var(--espacio-3);
  flex: none;
  padding: var(--espacio-2) var(--espacio-4);
}
.asa {
  grid-area: asa;
  justify-self: center;
  inline-size: 2.5rem;
  block-size: 4px;
  border-radius: 999px;
  background: var(--color-borde);
  opacity: 0.55;
  cursor: pointer;
  /* Zona de toque más alta que la raya que se ve. */
  box-sizing: content-box;
  background-clip: content-box;
  padding-block: var(--espacio-2);
  margin-block: calc(-1 * var(--espacio-2)) calc(var(--espacio-1) - var(--espacio-2));
}
.titulo {
  grid-area: titulo;
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.25;
  overflow-wrap: break-word;
}
.titulo:focus {
  outline: none;
}
.cerrar {
  grid-area: cerrar;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-block-size: var(--alto-toque);
  min-inline-size: var(--alto-toque);
  margin-inline-end: calc(-1 * var(--espacio-2));
  border: none;
  border-radius: var(--radio-chico);
  background: none;
  color: var(--color-primario);
  cursor: pointer;
}
.icono {
  inline-size: 1.5em;
  block-size: 1.5em;
  flex: none;
}
.cuerpo {
  flex: 1;
  min-block-size: 0;
  padding: var(--espacio-2) var(--espacio-4) var(--espacio-4);
  overflow-y: auto;
  overscroll-behavior: contain;
}
/* PC: la navegación está a la izquierda (260 px, LayoutApp) y queda a la vista y alcanzable. */
@media (min-width: 1024px) {
  .hoja,
  .velo {
    inset-inline-start: 260px;
  }
}
/* Pantalla baja (celular en horizontal): no queda lugar para una cabecera fija y un cuerpo que
   se desplaza aparte; toda la hoja se desplaza junta (como el panel de venta). */
@media (max-height: 520px) {
  .asa {
    display: none;
  }
  .hoja {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .cuerpo {
    flex: none;
    overflow: visible;
  }
}
</style>

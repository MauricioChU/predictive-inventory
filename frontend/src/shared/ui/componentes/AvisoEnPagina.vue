<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, CircleCheck, Info, TriangleAlert, X } from 'lucide-vue-next'
import { pegarCifras } from '../texto-sin-cortes'

const props = withDefaults(
  defineProps<{
    tono: 'atencion' | 'info' | 'exito'
    /** "4 productos se acaban". */
    titulo: string
    texto?: string
    /** Botón de acción ("Ver qué comprar", "Guardar copia"); sin texto no hay botón. */
    textoAccion?: string
    /** Botón para cerrar el aviso ("Cerrar", "Ahora no"); sin texto no hay botón. */
    textoCerrar?: string
  }>(),
  { texto: undefined, textoAccion: undefined, textoCerrar: undefined },
)
const emit = defineEmits<{ accion: []; cerrar: [] }>()

const ICONOS = { atencion: TriangleAlert, info: Info, exito: CircleCheck } as const
const icono = computed(() => ICONOS[props.tono])
</script>

<template>
  <div class="aviso-en-pagina" :class="`aviso-en-pagina--${tono}`">
    <!--
      Es contenido normal de la página (como EstadoVacio): sin role="alert"/"status", que harían
      que un lector de pantalla lo anuncie de golpe cada vez que se abre la pantalla. Si un aviso
      aparece por algo que la persona hizo, quien lo muestra lo anuncia con el anunciador global.
      Al cerrarlo, quien lo usa decide a dónde va el foco (el botón desaparece con el aviso).
    -->
    <div class="cuerpo">
      <component :is="icono" aria-hidden="true" class="icono" />
      <p class="titulo">{{ pegarCifras(titulo) }}</p>
      <p v-if="texto" class="texto">{{ pegarCifras(texto) }}</p>
    </div>
    <div v-if="textoAccion || textoCerrar" class="acciones">
      <button v-if="textoAccion" type="button" class="accion" @click="emit('accion')">
        <span>{{ textoAccion }}</span>
        <ChevronRight aria-hidden="true" class="icono-boton" />
      </button>
      <button v-if="textoCerrar" type="button" class="cerrar" @click="emit('cerrar')">
        <X aria-hidden="true" class="icono-boton" />
        <span>{{ textoCerrar }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.aviso-en-pagina {
  /* Los botones se apilan según el ancho real del aviso, no del viewport. */
  container-type: inline-size;
  --tono: var(--color-primario);
  --tono-suave: var(--color-primario-suave);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  border: 2px solid var(--tono);
  border-left-width: 6px;
  border-radius: var(--radio);
  background: var(--tono-suave);
  color: var(--color-texto);
  overflow-wrap: break-word;
}
.aviso-en-pagina--atencion {
  --tono: var(--color-advertencia);
  --tono-suave: var(--color-advertencia-suave);
}
.aviso-en-pagina--exito {
  --tono: var(--color-exito);
  --tono-suave: var(--color-exito-suave);
}
/* Ícono · título en la primera fila; el texto debajo del título (o, si el aviso es angosto,
   a todo el ancho, también debajo del ícono: así no queda una columnita de 3 palabras). */
.cuerpo {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--espacio-1) var(--espacio-3);
}
.icono {
  width: 1.75rem;
  height: 1.75rem;
  min-width: 24px;
  min-height: 24px;
  flex: none;
  color: var(--tono);
}
.titulo {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}
.texto {
  grid-column: 2;
  margin: 0;
  color: var(--color-texto-suave);
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--separacion-toque);
}
.accion,
.cerrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-2);
  min-height: var(--alto-toque);
  max-width: 100%;
  padding: var(--espacio-1) var(--espacio-3);
  border: 2px solid var(--tono);
  border-radius: var(--radio-chico);
  font-weight: 700;
  cursor: pointer;
}
.accion {
  background: var(--color-fondo);
  color: var(--tono);
}
.cerrar {
  background: transparent;
  border-color: var(--color-borde);
  color: var(--color-texto);
}
.icono-boton {
  width: 1.25em;
  height: 1.25em;
  flex: none;
}
/* Angosto (celular con letra grande): cada botón a todo el ancho, uno debajo del otro. */
@container (max-width: 24rem) {
  .texto {
    grid-column: 1 / -1;
  }
  .acciones {
    flex-direction: column;
  }
  .accion,
  .cerrar {
    width: 100%;
  }
}
</style>

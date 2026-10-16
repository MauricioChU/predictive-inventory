<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: string
    etiqueta: string
    marcador?: string
    /** Enfoca el campo al aparecer. En Android eso abre el teclado: usarlo solo donde buscar
     * es lo primero que se hace (Vender, ¿Necesito comprar?). */
    autofoco?: boolean
  }>(),
  { marcador: undefined, autofoco: false },
)
const emit = defineEmits<{ 'update:modelValue': [valor: string]; limpiar: [] }>()

/** Espera tras la última tecla antes de avisar (plan 09b): no se filtra en cada letra. */
const ESPERA_MS = 200

const id = useId()
const refCampo = ref<HTMLInputElement>()
/** Lo que se ve escrito; puede ir por delante de modelValue mientras corre la espera. */
const texto = ref(props.modelValue)
/** Último valor que este buscador avisó: su eco en modelValue no debe pisar lo que se siguió
 * escribiendo durante la espera. */
let ultimoAvisado = props.modelValue
let temporizador: ReturnType<typeof setTimeout> | undefined

function cancelarEspera() {
  if (temporizador === undefined) return
  clearTimeout(temporizador)
  temporizador = undefined
}

function avisar(valor: string) {
  cancelarEspera()
  ultimoAvisado = valor
  emit('update:modelValue', valor)
}

watch(
  () => props.modelValue,
  (valor) => {
    if (valor === ultimoAvisado) return // eco de lo que ya avisamos
    // Quien lo usa cambió el valor (p. ej. lo vació tras elegir un producto): manda él.
    cancelarEspera()
    ultimoAvisado = valor
    texto.value = valor
  },
)

function alEscribir(evento: Event) {
  texto.value = (evento.target as HTMLInputElement).value
  cancelarEspera()
  temporizador = setTimeout(() => avisar(texto.value), ESPERA_MS)
}

/** La tecla "Buscar" del teclado (Enter) no espera. */
function alPresionarEnter(evento: KeyboardEvent) {
  evento.preventDefault()
  avisar(texto.value)
}

function enfocar() {
  refCampo.value?.focus()
}

function borrar() {
  texto.value = ''
  avisar('')
  emit('limpiar')
  // El botón "Borrar" desaparece: el foco vuelve al campo para seguir buscando.
  enfocar()
}

onMounted(() => {
  if (props.autofoco) enfocar()
})
onBeforeUnmount(cancelarEspera)

defineExpose({ enfocar })
</script>

<template>
  <div class="buscador-grande">
    <label :for="id" class="etiqueta">{{ etiqueta }}</label>
    <div class="caja">
      <Search aria-hidden="true" class="lupa" />
      <input
        :id="id"
        ref="refCampo"
        :value="texto"
        type="search"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        :placeholder="marcador"
        class="campo"
        @input="alEscribir"
        @keydown.enter="alPresionarEnter"
      />
      <button v-if="texto !== ''" type="button" class="borrar" @click="borrar">
        <X aria-hidden="true" class="icono-borrar" />
        <span>Borrar</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.buscador-grande {
  /* Su forma angosta depende del ancho real del buscador, no del viewport. */
  container-type: inline-size;
}
.etiqueta {
  display: block;
  font-weight: 700;
  margin-bottom: var(--espacio-2);
}
/* La caja dibuja el borde (no el input): así la lupa, el texto y "Borrar" se ven como un
   solo campo grande. */
.caja {
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
  min-block-size: var(--alto-boton-principal);
  padding-inline: var(--espacio-3) var(--espacio-1);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-fondo);
}
.caja:focus-within {
  border-color: var(--color-primario);
}
/* Con :has, el anillo de foco del input se dibuja en toda la caja (y no dos anillos cuando el
   foco está en "Borrar", que trae el suyo). Sin :has, el input conserva su anillo normal. */
@supports selector(:has(*)) {
  .caja:has(.campo:focus-visible) {
    outline: 3px solid var(--color-foco);
    outline-offset: 2px;
  }
  .campo:focus-visible {
    outline: none;
  }
}
.lupa {
  inline-size: 1.4rem;
  block-size: 1.4rem;
  min-inline-size: 24px;
  min-block-size: 24px;
  flex: none;
  color: var(--color-texto-suave);
}
.campo {
  flex: 1;
  min-inline-size: 0;
  min-block-size: var(--alto-toque);
  padding: 0;
  border: none;
  background: transparent;
  font-size: 1.2rem;
  appearance: none;
}
.campo::placeholder {
  /* El marcador también se tiene que poder leer (RN-UX-03): texto suave, ~9:1. */
  color: var(--color-texto-suave);
  opacity: 1;
}
/* La "x" propia del navegador en type="search" es chica y sin texto: se usa "Borrar". */
.campo::-webkit-search-cancel-button,
.campo::-webkit-search-decoration {
  appearance: none;
}
.borrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-1);
  flex: none;
  min-block-size: var(--alto-toque);
  min-inline-size: var(--alto-toque);
  padding-inline: var(--espacio-2);
  border: 2px solid transparent;
  border-radius: var(--radio-chico);
  background: var(--color-superficie);
  color: var(--color-texto);
  font-weight: 700;
  cursor: pointer;
}
.borrar:hover {
  border-color: var(--color-borde);
}
.icono-borrar {
  inline-size: 1.2em;
  block-size: 1.2em;
  min-inline-size: 20px;
  min-block-size: 20px;
  flex: none;
}

/* Angosto (celular con letra Grande o Muy grande): "Borrar" pone el texto debajo de la ✕
   (como la barra de navegación), para dejarle al texto buscado todo el ancho posible. */
@container (max-width: 16rem) {
  .caja {
    padding-inline-start: var(--espacio-2);
  }
  .campo {
    font-size: 1.1rem;
  }
  .borrar {
    flex-direction: column;
    gap: 0;
    padding: 2px var(--espacio-1);
    font-size: 0.7rem;
    line-height: 1.1;
  }
  .icono-borrar {
    inline-size: 1.1rem;
    block-size: 1.1rem;
  }
}
</style>

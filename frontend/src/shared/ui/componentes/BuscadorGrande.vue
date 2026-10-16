<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    /**
     * v-model. Quien lo usa debe actualizarlo en el mismo handler de `update:modelValue`
     * (sincrónico, sin await antes). Si su eco llega tarde igual se reconoce y no pisa lo que se
     * siguió escribiendo; pero para vaciar el buscador desde la pantalla hay que llamar a
     * `vaciar()`: volver a poner "" en modelValue no avisa nada si ya valía "".
     */
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
/** Valores que este buscador avisó y cuyo eco por modelValue todavía no llegó, en orden.
 * Ronda 1: una lista (no solo el último): si la pantalla responde tarde, el eco de un aviso
 * viejo ("lej") llega cuando ya se avisó otro ("lejia") y no debe pisar lo escrito. */
const avisadosSinEco: string[] = []
/** Tope por si quien lo usa no hace eco de nada (sin v-model): la lista no crece sin fin. */
const MAXIMO_SIN_ECO = 20
let temporizador: ReturnType<typeof setTimeout> | undefined

function cancelarEspera() {
  if (temporizador === undefined) return
  clearTimeout(temporizador)
  temporizador = undefined
}

function avisar(valor: string) {
  cancelarEspera()
  avisadosSinEco.push(valor)
  if (avisadosSinEco.length > MAXIMO_SIN_ECO) avisadosSinEco.shift()
  emit('update:modelValue', valor)
}

watch(
  () => props.modelValue,
  (valor) => {
    const posicion = avisadosSinEco.indexOf(valor)
    if (posicion >= 0) {
      // Eco de un aviso nuestro (a tiempo o tarde): se descarta con los anteriores y no toca
      // lo que se ve escrito.
      avisadosSinEco.splice(0, posicion + 1)
      return
    }
    // Quien lo usa cambió el valor (p. ej. lo vació tras elegir un producto): manda él.
    avisadosSinEco.length = 0
    cancelarEspera()
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

/** Vacía el buscador ya mismo: borra lo escrito, anula el aviso que estaba esperando y avisa
 * "" en el acto. Para la pantalla (p. ej. después de agregar el producto elegido al carrito). */
function vaciar() {
  cancelarEspera()
  texto.value = ''
  avisar('')
}

function borrar() {
  vaciar()
  emit('limpiar')
  // El botón "Borrar" desaparece: el foco vuelve al campo para seguir buscando.
  enfocar()
}

onMounted(() => {
  if (props.autofoco) enfocar()
})
onBeforeUnmount(cancelarEspera)

defineExpose({ enfocar, vaciar })
</script>

<template>
  <div class="buscador-grande">
    <label :for="id" class="etiqueta">{{ etiqueta }}</label>
    <div class="fila">
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
      </div>
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
/* Ronda 1 (RN-UX-01): "Borrar" va al lado del campo, con su letra normal (nunca más chica que
   la elegida). Si no entran los dos, pasa a su propia fila debajo, a todo el ancho. */
.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--separacion-toque);
}
/* La caja dibuja el borde (no el input): así la lupa y el texto se ven como un solo campo. */
.caja {
  display: flex;
  flex: 1 1 10rem;
  align-items: center;
  gap: var(--espacio-2);
  min-inline-size: 0;
  min-block-size: var(--alto-boton-principal);
  padding-inline: var(--espacio-3);
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
  gap: var(--espacio-2);
  flex: none;
  min-block-size: var(--alto-toque);
  min-inline-size: var(--alto-toque);
  padding-inline: var(--espacio-4);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-superficie);
  color: var(--color-texto);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
.borrar:hover {
  background: var(--color-primario-suave);
}
.icono-borrar {
  inline-size: 1.2em;
  block-size: 1.2em;
  min-inline-size: 20px;
  min-block-size: 20px;
  flex: none;
}

/* Angosto (celular con letra Grande o Muy grande): "Borrar" no entra al lado sin achicar el
   campo o su letra, así que va en su propia fila, a todo el ancho y con 48 px de alto. */
@container (max-width: 18rem) {
  .borrar {
    flex: 1 1 100%;
  }
}
</style>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Ban, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { diaDe, hoyEnLaTienda, horaDe, type Dia } from '@/shared/domain/fecha'
import Boton from '@/shared/ui/componentes/Boton.vue'
import ListaAgrupadaPorDia from '@/shared/ui/componentes/ListaAgrupadaPorDia.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import type { OperacionVista } from '../application/historial'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { montoDe, resumenDeProductos, type FiltroDeTipo } from './presentacion-de-operaciones'

/**
 * La lista del Historial (HU-OP-08), agrupada por día, lo más nuevo primero. La usan la pantalla
 * Historial (con filtro por tipo) y la hoja «Movimientos» de Inicio (con filtro por fecha).
 * Con `rango` trae páginas (hasta 3 por pedido) hasta cubrir el rango y muestra solo esos días,
 * con «Ver más» si falta; sin él, de a páginas con «Ver más» (plan 17).
 */
const props = withDefaults(
  defineProps<{
    tipo?: FiltroDeTipo
    rango?: { desde: Dia; hasta: Dia } | null
    vacio: { titulo: string; descripcion?: string; accion?: string }
    /** Nivel de los encabezados de día (2 en pantalla propia, 3 dentro de una hoja con su h2). */
    nivelEncabezado?: 2 | 3
  }>(),
  { tipo: 'TODO', rango: null, nivelEncabezado: 2 },
)
const emit = defineEmits<{ accion: [] }>()

const aplicacion = useAplicacion()
/** Cuántas operaciones se traen de una vez ("Ver más" trae otras tantas). */
const POR_PAGINA = 60
/** Con rango, cuántas páginas se piden de una vez; si falta, aparece «Ver más» para seguir. */
const PAGINAS_POR_PEDIDO = 3

const operaciones = ref<OperacionVista[]>([])
const siguiente = ref<string | null>(null)
const trayendoMas = ref(false)
const cargado = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
const hoy: Dia = hoyEnLaTienda(new Date())
const refRaiz = ref<HTMLElement>()
let pedido = 0

function consulta(desde?: string) {
  const tipo = props.tipo === 'TODO' ? undefined : props.tipo
  return { ...(tipo ? { tipo } : {}), ...(desde ? { desde } : {}), cuantas: POR_PAGINA }
}

/** Con rango, sigue trayendo páginas hasta pasar el día más viejo que se pidió. */
function faltaCubrir(): boolean {
  if (!props.rango || siguiente.value === null) return false
  const ultima = operaciones.value.at(-1)
  return !ultima || diaDe(ultima.ocurridaEn) >= props.rango.desde
}

/** Trae la página que sigue y, con rango, otras hasta cubrirlo o llegar al tope por pedido. */
async function traer(numero: number, desde?: string): Promise<boolean> {
  let siguientePagina = desde
  for (let n = 0; n < PAGINAS_POR_PEDIDO; n += 1) {
    const pagina = await aplicacion.inventario.paginaDelHistorial(consulta(siguientePagina))
    if (numero !== pedido) return false
    operaciones.value = [...operaciones.value, ...pagina.operaciones]
    siguiente.value = pagina.siguiente
    siguientePagina = pagina.siguiente ?? undefined
    if (!faltaCubrir()) break
  }
  return true
}

async function cargar(): Promise<void> {
  const numero = (pedido += 1)
  trayendoMas.value = false
  // Al cambiar de filtro no queda a la vista la lista vieja.
  cargado.value = false
  operaciones.value = []
  siguiente.value = null
  try {
    if (!(await traer(numero))) return
    error.value = null
  } catch (causa) {
    if (numero === pedido) error.value = errorParaMostrar(causa, 'anulacion')
  } finally {
    if (numero === pedido) cargado.value = true
  }
}

/** "Ver más": la página que sigue, al final. El foco pasa a la primera recién traída. */
async function verMas(): Promise<void> {
  const desde = siguiente.value
  if (desde === null || trayendoMas.value) return
  const numero = pedido
  const yaHabia = refRaiz.value?.querySelectorAll('.operacion').length ?? 0
  trayendoMas.value = true
  try {
    if (!(await traer(numero, desde))) return
    error.value = null
  } catch (causa) {
    if (numero === pedido) error.value = errorParaMostrar(causa, 'anulacion')
    return
  } finally {
    if (numero === pedido) trayendoMas.value = false
  }
  await nextTick()
  refRaiz.value?.querySelectorAll<HTMLElement>('.operacion')[yaHabia]?.focus()
}

// Cambiar el tipo o el rango vuelve a pedir (el rango puede necesitar otras páginas).
watch(
  () => [props.tipo, props.rango?.desde, props.rango?.hasta],
  () => void cargar(),
  { immediate: true },
)

/** Ya vienen de la más reciente a la más antigua: se cortan por día de negocio. */
const grupos = computed(() => {
  const resultado: { dia: Dia; items: OperacionVista[] }[] = []
  for (const operacion of operaciones.value) {
    const dia = diaDe(operacion.ocurridaEn)
    if (props.rango && (dia < props.rango.desde || dia > props.rango.hasta)) continue
    const ultimo = resultado.at(-1)
    if (ultimo?.dia === dia) ultimo.items.push(operacion)
    else resultado.push({ dia, items: [operacion] })
  }
  return resultado
})
/** Sin rango, mientras haya más páginas; con rango, solo si el tope cortó antes de cubrirlo. */
const quedanMas = computed(() => siguiente.value !== null && (!props.rango || faltaCubrir()))
</script>

<template>
  <div ref="refRaiz" class="lista-de-movimientos">
    <p v-if="!cargado" class="cargando" role="status">Cargando…</p>
    <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
    <ListaAgrupadaPorDia
      v-if="cargado"
      :grupos="grupos"
      :hoy="hoy"
      :nivel-encabezado="nivelEncabezado"
      :clave-de="(o: OperacionVista) => o.id"
      :vacio="vacio"
      @accion="emit('accion')"
    >
      <template #default="{ item }">
        <RouterLink :to="{ name: 'operacion', params: { id: item.id } }" class="operacion">
          <span class="cabecera">
            <span class="tipo">{{ item.etiqueta }}</span>
            <span class="hora">{{ horaDe(item.ocurridaEn) }}</span>
          </span>
          <!-- "Lejía 1 L (12 unid.)": cantidades y montos nunca se parten (RN-UX-09). -->
          <span class="productos">{{ pegarCifras(resumenDeProductos(item)) }}</span>
          <span v-if="item.anulada || montoDe(item)" class="pie">
            <span v-if="item.anulada" class="anulada">
              <Ban aria-hidden="true" class="icono" />
              <span>Anulada</span>
            </span>
            <span v-if="montoDe(item)" class="monto">{{ pegarCifras(montoDe(item) ?? '') }}</span>
          </span>
          <ChevronRight aria-hidden="true" class="flecha" />
        </RouterLink>
      </template>
    </ListaAgrupadaPorDia>
    <Boton v-if="quedanMas" class="ver-mas" texto="Ver más" :icono="ChevronDown" @click="verMas" />
  </div>
</template>

<style scoped>
.lista-de-movimientos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
}
.operacion {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-1);
  min-block-size: var(--alto-boton-principal);
  padding: var(--espacio-3) calc(var(--espacio-4) + 1.5rem) var(--espacio-3) var(--espacio-4);
  border: 2px solid transparent;
  border-radius: var(--radio);
  background: var(--color-superficie);
  color: var(--color-texto);
  text-decoration: none;
  overflow-wrap: break-word;
}
.operacion:hover {
  background: var(--color-primario-suave);
}
.operacion:active {
  border-color: var(--color-primario);
}
.cabecera,
.pie {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0 var(--espacio-3);
}
.tipo {
  font-weight: 700;
}
.hora {
  color: var(--color-texto-suave);
  font-variant-numeric: tabular-nums;
}
.productos {
  color: var(--color-texto-suave);
}
.monto {
  margin-inline-start: auto;
  font-weight: 700;
  white-space: nowrap;
}
.anulada {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-1);
  padding: 0 var(--espacio-2);
  border: 1px solid var(--color-peligro);
  border-radius: 999px;
  background: var(--color-peligro-suave);
  color: var(--color-peligro);
  font-size: 0.9rem;
  font-weight: 700;
}
.icono {
  inline-size: 1.1em;
  block-size: 1.1em;
  flex: none;
}
.flecha {
  position: absolute;
  inset-inline-end: var(--espacio-3);
  inset-block-start: 50%;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  transform: translateY(-50%);
  color: var(--color-texto-suave);
}
.cargando {
  margin: 0;
  color: var(--color-texto-suave);
}
.ver-mas {
  justify-self: center;
}
</style>

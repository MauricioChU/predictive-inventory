<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Ban, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { diaDe, horaDe, type Dia } from '@/shared/domain/fecha'
import Boton from '@/shared/ui/componentes/Boton.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import ListaAgrupadaPorDia from '@/shared/ui/componentes/ListaAgrupadaPorDia.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import type { OperacionVista } from '../application/historial'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import {
  FILTROS_DEL_HISTORIAL,
  montoDe,
  resumenDeProductos,
  type FiltroDeTipo,
} from './presentacion-de-operaciones'
import { hoyEnLaTienda } from '@/shared/domain/fecha'

/**
 * Historial (HU-OP-08; 06-experiencia-de-uso): todo lo que pasó, agrupado por día ("Hoy",
 * "Ayer", "Lunes 12"), lo más nuevo primero y con filtro por tipo. Tocar una operación abre su
 * detalle, donde se puede anular.
 */
const aplicacion = useAplicacion()
const router = useRouter()

/**
 * Cuántas operaciones se traen de una vez ("Ver más" trae otras tantas). Plan 17: el libro se
 * pide de a páginas (`paginaDelHistorial`), no entero: con años de ventas abre igual de rápido.
 */
const POR_PAGINA = 60

const filtro = ref<FiltroDeTipo>('TODO')
const operaciones = ref<OperacionVista[]>([])
/** Desde dónde sigue la página siguiente; null si ya no hay más. */
const siguiente = ref<string | null>(null)
const trayendoMas = ref(false)
const cargado = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
const hoy: Dia = hoyEnLaTienda(new Date())
const refRaiz = ref<HTMLElement>()
let pedido = 0

function consulta(desde?: string) {
  const tipo = filtro.value === 'TODO' ? undefined : filtro.value
  return { ...(tipo ? { tipo } : {}), ...(desde ? { desde } : {}), cuantas: POR_PAGINA }
}

async function cargar(): Promise<void> {
  const numero = (pedido += 1)
  trayendoMas.value = false
  try {
    const pagina = await aplicacion.inventario.paginaDelHistorial(consulta())
    if (numero !== pedido) return
    operaciones.value = pagina.operaciones
    siguiente.value = pagina.siguiente
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
  const yaHabia = operaciones.value.length
  trayendoMas.value = true
  try {
    const pagina = await aplicacion.inventario.paginaDelHistorial(consulta(desde))
    if (numero !== pedido) return
    operaciones.value = [...operaciones.value, ...pagina.operaciones]
    siguiente.value = pagina.siguiente
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

watch(filtro, () => void cargar(), { immediate: true })

/** Ya vienen de la más reciente a la más antigua: se cortan por día de negocio. */
const grupos = computed(() => {
  const resultado: { dia: Dia; items: OperacionVista[] }[] = []
  for (const operacion of operaciones.value) {
    const dia = diaDe(operacion.ocurridaEn)
    const ultimo = resultado.at(-1)
    if (ultimo?.dia === dia) ultimo.items.push(operacion)
    else resultado.push({ dia, items: [operacion] })
  }
  return resultado
})
const quedanMas = computed(() => siguiente.value !== null)

const vacio = computed(() =>
  filtro.value === 'TODO'
    ? {
        titulo: 'Todavía no hay nada en el historial',
        descripcion: 'Aquí verás cada venta, llegada de mercadería, pérdida y conteo.',
        accion: 'Hacer una venta',
      }
    : {
        titulo: 'No hay movimientos de este tipo',
        descripcion: 'Elige «Todo» para verlos todos.',
        accion: 'Ver todo',
      },
)

function alAccionDelVacio(): void {
  if (filtro.value === 'TODO') void router.push({ name: 'vender' })
  else filtro.value = 'TODO'
}
</script>

<template>
  <div ref="refRaiz" class="vista-historial">
    <EncabezadoPagina titulo="Historial" volver />
    <SelectorSegmentado
      v-model="filtro"
      class="filtro"
      :opciones="FILTROS_DEL_HISTORIAL"
      etiqueta="Mostrar"
    />
    <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />
    <ListaAgrupadaPorDia
      v-if="cargado"
      :grupos="grupos"
      :hoy="hoy"
      :clave-de="(o: OperacionVista) => o.id"
      :vacio="vacio"
      @accion="alAccionDelVacio"
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
.vista-historial {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
  max-inline-size: 48rem;
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
.ver-mas {
  justify-self: center;
}
</style>

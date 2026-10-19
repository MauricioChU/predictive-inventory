<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Tags } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import BuscadorGrande from '@/shared/ui/componentes/BuscadorGrande.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import ListaDeProductos from '@/shared/ui/componentes/ListaDeProductos.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import type { CategoriaVista, ProductoVista } from '../application/modulo'
import { usarAltoObservado } from '@/shared/ui/alto-observado'
import FiltroDeCategoria from './FiltroDeCategoria.vue'
import { useFiltrosDeProductos, vuelveAtrasDelDetalle } from './filtros-de-productos'
import {
  aFilaDeLista,
  estadoDeLaDireccion,
  filtrarProductos,
  OPCIONES_DE_ESTADO,
  textoDeConteo,
  vacioDeLista,
} from './presentacion'

const app = useAplicacion()
const router = useRouter()
const route = useRoute()
const filtros = useFiltrosDeProductos()
if (!vuelveAtrasDelDetalle(router)) {
  filtros.olvidar()
  // RN-CAT-16: `?estado=se-acaban` abre la lista ya filtrada (el aviso de Inicio, la notificación).
  const pedido = estadoDeLaDireccion(route.query.estado)
  if (pedido) filtros.estado = pedido
}

const cargando = ref(true)
/** ¿Hay algún producto (activo o archivado)? Sin ninguno no hay nada que buscar ni filtrar. */
const hayProductos = ref(false)
const categorias = ref<CategoriaVista[]>([])
/** Lo que devolvió la búsqueda del catálogo (RN-CAT-12: sin tildes, más vendidos primero). */
const encontrados = ref<ProductoVista[]>([])
const estados = ref<ReadonlyMap<string, EstadoDeStock>>(new Map())
/** Se reemplaza entera (no se modifica): un solo redibujo por tanda de fotos. */
const fotos = shallowRef<ReadonlyMap<string, Blob>>(new Map())
const fotosPedidas = new Set<string>()
const refAccion = ref<HTMLElement>()
const altoDeLaAccion = usarAltoObservado(refAccion)
const error = ref<string | null>(null)

/** Solo cuenta la última búsqueda: una respuesta vieja que llega tarde no pisa la nueva. */
let ultimoPedido = 0

/**
 * Lee de una vez (en paralelo) las fotos que faltan y las asigna JUNTAS: la lista se redibuja
 * una sola vez por tanda, no una vez por foto (con 300 productos eran 300 redibujos).
 */
async function cargarFotos(productos: readonly ProductoVista[]) {
  const pendientes = productos.filter((p) => p.tieneFoto && !fotosPedidas.has(p.id))
  if (pendientes.length === 0) return
  for (const p of pendientes) fotosPedidas.add(p.id)
  const leidas = await Promise.all(
    pendientes.map((p) =>
      app.catalogo.obtenerFoto(p.id).catch((e: unknown) => {
        console.error('No se pudo leer la foto del producto:', e)
        return null
      }),
    ),
  )
  const nuevas = new Map(fotos.value)
  pendientes.forEach((p, indice) => {
    const foto = leidas[indice]
    if (foto) nuevas.set(p.id, foto)
  })
  fotos.value = nuevas
}

function mostrar(productos: ProductoVista[]) {
  encontrados.value = productos
  void cargarFotos(productos)
}

/** RN-UX-07: si algo falla al leer los datos, se dice en lenguaje simple (nunca técnico). */
function fallo(e: unknown) {
  console.error('No se pudieron leer los productos:', e)
  error.value = 'No pudimos abrir tus productos.'
}

async function buscar() {
  const pedido = ++ultimoPedido
  try {
    const productos = await app.catalogo.buscarProductos({
      texto: filtros.texto,
      archivados: filtros.estado === 'ARCHIVADOS',
    })
    if (pedido === ultimoPedido) mostrar(productos)
  } catch (e) {
    fallo(e)
  }
}

async function cargar() {
  const pedido = ++ultimoPedido
  const [lista, activos, situaciones] = await Promise.all([
    app.catalogo.listarCategorias(),
    app.catalogo.buscarProductos({ texto: '' }),
    app.analisis.consultable.situaciones(),
  ])
  // Los archivados solo hacen falta para saber si hay ALGÚN producto (cuando no hay activos).
  const archivados =
    activos.length === 0
      ? await app.catalogo.buscarProductos({ texto: '', archivados: true })
      : null
  categorias.value = lista
  hayProductos.value = activos.length > 0 || (archivados?.length ?? 0) > 0
  estados.value = new Map(situaciones.map((s) => [s.productoId, s.estado]))
  if (filtros.categoriaId !== '' && !lista.some((c) => c.id === filtros.categoriaId)) {
    filtros.categoriaId = ''
  }
  if (filtros.texto.trim() !== '' || (filtros.estado === 'ARCHIVADOS' && !archivados)) {
    await buscar()
  } else if (pedido === ultimoPedido) {
    mostrar(filtros.estado === 'ARCHIVADOS' ? (archivados ?? []) : activos)
  }
  cargando.value = false
}

onMounted(() => cargar().catch(fallo))

// Tocar la notificación con Productos ya abierta cambia la dirección sin volver a montar la lista.
watch(
  () => route.query.estado,
  (nuevo) => {
    const pedido = estadoDeLaDireccion(nuevo)
    if (pedido) filtros.estado = pedido
  },
)

// Se vuelve a buscar solo si cambia lo que el catálogo filtra (el texto, o activos ↔
// archivados); los demás filtros se aplican sobre lo ya encontrado.
watch([() => filtros.texto, () => filtros.estado === 'ARCHIVADOS'], () => {
  if (!cargando.value) void buscar()
})

const visibles = computed(() =>
  filtrarProductos(encontrados.value, {
    estado: filtros.estado,
    categoriaId: filtros.categoriaId,
    estados: estados.value,
  }),
)
const filas = computed(() =>
  visibles.value.map((p) => aFilaDeLista(p, estados.value.get(p.id), fotos.value.get(p.id))),
)
const nombreDeCategoria = computed(
  () => categorias.value.find((c) => c.id === filtros.categoriaId)?.nombre ?? null,
)
const vacio = computed(() =>
  vacioDeLista({
    hayProductos: hayProductos.value,
    texto: filtros.texto,
    estado: filtros.estado,
    categoriaNombre: nombreDeCategoria.value,
  }),
)
/** El estado vacío ya ofrece "Agregar producto" (con lo buscado): no se repite abajo. */
const agregarEnElVacio = computed(
  () => filas.value.length === 0 && vacio.value.tipoDeAccion === 'agregar',
)
/** Lo que anuncia la región viva al cambiar la búsqueda o un filtro. */
const resultado = computed(() =>
  filas.value.length > 0 ? textoDeConteo(filas.value.length) : vacio.value.titulo,
)

function agregar(nombre?: string) {
  void router.push({ name: 'producto-nuevo', query: nombre ? { nombre } : {} })
}

function alAccionDelVacio() {
  if (vacio.value.tipoDeAccion === 'agregar') {
    agregar(filtros.texto.trim() || undefined)
    return
  }
  filtros.estado = 'TODOS'
  filtros.categoriaId = ''
}

function abrirProducto(id: string) {
  void router.push({ name: 'producto', params: { id } })
}
</script>

<template>
  <div class="vista-productos" :style="{ '--alto-accion': `${altoDeLaAccion}px` }">
    <div class="cabecera">
      <EncabezadoPagina titulo="Productos" />
      <Boton
        class="ir-a-categorias"
        texto="Categorías"
        :icono="Tags"
        @click="router.push({ name: 'categorias' })"
      />
    </div>

    <MensajeDeError v-if="error" :mensaje="error" ayuda="Vuelve a intentarlo en un momento." />

    <template v-if="!cargando">
      <div class="cuerpo">
        <section v-if="hayProductos" class="filtros" aria-label="Buscar y filtrar">
          <BuscadorGrande v-model="filtros.texto" etiqueta="Buscar producto" />
          <SelectorSegmentado
            v-model="filtros.estado"
            :opciones="OPCIONES_DE_ESTADO"
            etiqueta="Mostrar"
          />
          <FiltroDeCategoria v-model="filtros.categoriaId" :categorias="categorias" />
        </section>

        <section class="resultados" aria-label="Lista de productos">
          <!-- Región viva siempre presente: anuncia cuántos hay (o por qué no hay) al buscar. -->
          <p
            v-if="hayProductos"
            class="conteo"
            :class="{ 'solo-lector': filas.length === 0 }"
            role="status"
          >
            {{ resultado }}
          </p>
          <ListaDeProductos
            :productos="filas"
            :vacio="vacio"
            etiqueta="Productos"
            @elegir="abrirProducto"
            @accion="alAccionDelVacio"
          />
          <!-- Principio 1: la acción principal, abajo y al alcance del pulgar: pegada al fondo
               de la columna de la lista, sobre el pie. Sin productos, la del estado vacío ya
               es "Agregar el primero". -->
          <div v-if="hayProductos && !agregarEnElVacio" ref="refAccion" class="accion-principal">
            <BotonPrincipal texto="Agregar producto" :icono="Plus" @click="agregar()" />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.vista-productos {
  display: grid;
  gap: var(--espacio-4);
  min-inline-size: 0;
}
/* WCAG 2.4.11: lo que recibe el foco nunca queda tapado por el botón pegado abajo (su alto
   real, medido). */
.vista-productos :deep(:is(button, input, a)) {
  scroll-margin-bottom: calc(var(--alto-accion, 0px) + var(--espacio-3));
}
.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0 var(--espacio-3);
}
.cuerpo {
  display: grid;
  gap: var(--espacio-5);
  min-inline-size: 0;
}
.filtros,
.resultados {
  display: grid;
  gap: var(--espacio-4);
  align-content: start;
  min-inline-size: 0;
}
.conteo {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto-suave);
}
.accion-principal {
  position: sticky;
  bottom: var(--alto-pie, 0px);
  z-index: 5;
  padding-block: var(--espacio-3);
  background: var(--color-fondo);
  /* Como BarraDeTotal: se nota que flota sobre la lista que pasa por debajo. */
  box-shadow: var(--sombra-flotante);
}

/* Mismo corte que LayoutApp: desde 1024 px la navegación va al costado y lo único pegado abajo
   es el aviso Deshacer. Buscador y filtros a la izquierda, lista a la derecha. */
@media (min-width: 1024px) {
  .cuerpo {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
    align-items: start;
  }
  .accion-principal {
    bottom: var(--alto-aviso, 0px);
  }
}
</style>

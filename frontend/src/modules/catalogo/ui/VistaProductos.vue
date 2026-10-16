<script setup lang="ts">
import { computed, onMounted, ref, shallowReactive, watch } from 'vue'
import { useRouter } from 'vue-router'
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
import FiltroDeCategoria from './FiltroDeCategoria.vue'
import { useFiltrosDeProductos } from './filtros-de-productos'
import {
  aFilaDeLista,
  filtrarProductos,
  OPCIONES_DE_ESTADO,
  textoDeConteo,
  vacioDeLista,
} from './presentacion'

const app = useAplicacion()
const router = useRouter()
const filtros = useFiltrosDeProductos()

const cargando = ref(true)
/** ¿Hay algún producto (activo o archivado)? Sin ninguno no hay nada que buscar ni filtrar. */
const hayProductos = ref(false)
const categorias = ref<CategoriaVista[]>([])
/** Lo que devolvió la búsqueda del catálogo (RN-CAT-12: sin tildes, más vendidos primero). */
const encontrados = ref<ProductoVista[]>([])
const estados = ref<ReadonlyMap<string, EstadoDeStock>>(new Map())
const fotos = shallowReactive(new Map<string, Blob>())
const fotosPedidas = new Set<string>()
const error = ref<string | null>(null)

/** Solo cuenta la última búsqueda: una respuesta vieja que llega tarde no pisa la nueva. */
let ultimoPedido = 0

function cargarFotos(productos: readonly ProductoVista[]) {
  for (const producto of productos) {
    if (!producto.tieneFoto || fotosPedidas.has(producto.id)) continue
    fotosPedidas.add(producto.id)
    app.catalogo
      .obtenerFoto(producto.id)
      .then((foto) => {
        if (foto) fotos.set(producto.id, foto)
      })
      .catch((error: unknown) => console.error('No se pudo leer la foto del producto:', error))
  }
}

function mostrar(productos: ProductoVista[]) {
  encontrados.value = productos
  cargarFotos(productos)
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
  const [lista, activos, archivados, situaciones] = await Promise.all([
    app.catalogo.listarCategorias(),
    app.catalogo.buscarProductos({ texto: '' }),
    app.catalogo.buscarProductos({ texto: '', archivados: true }),
    app.analisis.consultable.situaciones(),
  ])
  categorias.value = lista
  hayProductos.value = activos.length + archivados.length > 0
  estados.value = new Map(situaciones.map((s) => [s.productoId, s.estado]))
  if (filtros.categoriaId !== '' && !lista.some((c) => c.id === filtros.categoriaId)) {
    filtros.categoriaId = ''
  }
  if (filtros.texto.trim() !== '') {
    await buscar()
  } else if (pedido === ultimoPedido) {
    mostrar(filtros.estado === 'ARCHIVADOS' ? archivados : activos)
  }
  cargando.value = false
}

onMounted(() => cargar().catch(fallo))

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
  visibles.value.map((p) => aFilaDeLista(p, estados.value.get(p.id), fotos.get(p.id))),
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
  <div class="vista-productos">
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
          <div v-if="hayProductos" class="accion-principal">
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
/* WCAG 2.4.11: lo que recibe el foco nunca queda tapado por el botón pegado abajo. */
.vista-productos :deep(:is(button, input, a)) {
  scroll-margin-bottom: calc(var(--alto-boton-principal) + 2 * var(--espacio-3));
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

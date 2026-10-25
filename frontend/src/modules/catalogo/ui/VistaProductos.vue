<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'
import { ListFilter, Plus, Tags, X } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import BuscadorGrande from '@/shared/ui/componentes/BuscadorGrande.vue'
import HojaInferior from '@/shared/ui/componentes/HojaInferior.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import ListaDeProductos from '@/shared/ui/componentes/ListaDeProductos.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import type { CategoriaVista, ProductoVista } from '../application/modulo'
import { usarAltoObservado } from '@/shared/ui/alto-observado'
import FormularioDeProducto from './FormularioDeProducto.vue'
import HojaDeFiltros from './HojaDeFiltros.vue'
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

/** Las hojas (filtros y producto nuevo) se abren desde aquí, sin salir de la lista. */
const filtrosAbiertos = ref(false)
const productoNuevo = ref<{ nombre: string; vez: number } | null>(null)
const refBotonFiltros = ref<HTMLElement | null>(null)
const refHojaNueva = ref<InstanceType<typeof HojaInferior>>()
const refHojaFiltros = ref<InstanceType<typeof HojaDeFiltros>>()
const tituloDeLaHoja = ref('Producto nuevo')
const hojaAbierta = computed(() => filtrosAbiertos.value || productoNuevo.value !== null)

/** A dónde vuelve el foco al cerrar la hoja de producto nuevo (el botón fijo, o el del vacío). */
const abridorDeProductoNuevo = ref<HTMLElement | null>(null)
function agregar(nombre?: string) {
  abridorDeProductoNuevo.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  tituloDeLaHoja.value = 'Producto nuevo'
  productoNuevo.value = { nombre: nombre ?? '', vez: 0 }
}
/** "Agregar otro producto": un formulario nuevo y vacío en la misma hoja. */
function agregarOtro() {
  tituloDeLaHoja.value = 'Producto nuevo'
  if (productoNuevo.value) productoNuevo.value = { nombre: '', vez: productoNuevo.value.vez + 1 }
}
/** Con lo nuevo guardado, la lista deja de filtrar (un filtro podría esconderlo): ver `@guardado`.
 * Al cerrar, la lista se vuelve a leer: lo recién guardado ya aparece. */
function cerrarProductoNuevo() {
  productoNuevo.value = null
  void nextTick(() => cargar().catch(fallo))
}

const filtrosActivos = computed(() => {
  const chips: { id: 'estado' | 'categoria'; texto: string }[] = []
  if (filtros.estado !== 'TODOS') {
    const opcion = OPCIONES_DE_ESTADO.find((o) => o.valor === filtros.estado)
    if (opcion) chips.push({ id: 'estado', texto: opcion.etiqueta })
  }
  if (nombreDeCategoria.value) chips.push({ id: 'categoria', texto: nombreDeCategoria.value })
  return chips
})
const textoDelBotonDeFiltros = computed(() => {
  const n = filtrosActivos.value.length
  return n === 0 ? 'Filtros' : `Filtros · ${n} ${n === 1 ? 'activo' : 'activos'}`
})
/** Con una hoja abierta, tocar "Productos" en la navegación (misma pantalla) la cierra. */
const quitarEscucha = router.afterEach((to, _desde, falla) => {
  if (to.name !== 'productos' || !isNavigationFailure(falla, NavigationFailureType.duplicated))
    return
  refHojaNueva.value?.cerrar()
  refHojaFiltros.value?.cerrar()
})
onBeforeUnmount(quitarEscucha)

function alGuardar() {
  filtros.olvidar()
  tituloDeLaHoja.value = 'Producto guardado'
}
function quitarFiltro(id: 'estado' | 'categoria') {
  if (id === 'estado') filtros.estado = 'TODOS'
  else filtros.categoriaId = ''
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
    <!-- Si «Categorías» no cabe junto al título, queda solo el ícono (el texto sigue para el lector). -->
    <EncabezadoPagina class="cabecera" titulo="Productos" :inert="hojaAbierta ? true : undefined">
      <template #accion>
        <button type="button" class="ir-a-categorias" @click="router.push({ name: 'categorias' })">
          <Tags aria-hidden="true" class="icono" />
          <span class="texto-categorias">Categorías</span>
        </button>
      </template>
    </EncabezadoPagina>

    <MensajeDeError v-if="error" :mensaje="error" ayuda="Vuelve a intentarlo en un momento." />

    <template v-if="!cargando">
      <div class="cuerpo" :inert="hojaAbierta ? true : undefined">
        <section v-if="hayProductos" class="filtros" aria-label="Buscar y filtrar">
          <div class="fila-de-busqueda">
            <BuscadorGrande
              v-model="filtros.texto"
              etiqueta="Buscar producto"
              marcador="Por ejemplo: lejía"
            />
            <button
              ref="refBotonFiltros"
              type="button"
              class="boton-filtros"
              :class="{ 'boton-filtros--con-filtros': filtrosActivos.length > 0 }"
              @click="filtrosAbiertos = true"
            >
              <ListFilter aria-hidden="true" class="icono" />
              <span class="solo-lector">{{ textoDelBotonDeFiltros }}</span>
              <span v-if="filtrosActivos.length > 0" class="cuenta" aria-hidden="true">{{
                filtrosActivos.length
              }}</span>
            </button>
          </div>
          <ul v-if="filtrosActivos.length > 0" class="chips" aria-label="Filtros activos">
            <li v-for="chip in filtrosActivos" :key="chip.id">
              <button
                type="button"
                class="chip"
                :aria-label="`Quitar filtro ${chip.texto}`"
                @click="quitarFiltro(chip.id)"
              >
                <span class="pastilla">
                  <span class="chip-texto">{{ chip.texto }}</span>
                  <X aria-hidden="true" class="chip-x" />
                </span>
              </button>
            </li>
          </ul>
        </section>

        <section class="resultados" aria-label="Lista de productos">
          <!-- Región viva siempre presente: anuncia cuántos hay (o por qué no hay) al buscar. -->
          <p
            v-if="hayProductos"
            class="conteo titulo-de-seccion"
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

    <HojaDeFiltros
      v-if="filtrosAbiertos"
      ref="refHojaFiltros"
      v-model:estado="filtros.estado"
      v-model:categoria-id="filtros.categoriaId"
      :categorias="categorias"
      :cantidad="filas.length"
      :volver-a="refBotonFiltros"
      @cerrar="filtrosAbiertos = false"
    />
    <HojaInferior
      v-if="productoNuevo"
      ref="refHojaNueva"
      :titulo="tituloDeLaHoja"
      :volver-a="abridorDeProductoNuevo"
      @cerrar="cerrarProductoNuevo"
    >
      <FormularioDeProducto
        :key="productoNuevo.vez"
        en-hoja
        :nombre-inicial="productoNuevo.nombre"
        @agregar-otro="agregarOtro"
        @guardado="alGuardar"
      />
    </HojaInferior>
  </div>
</template>

<style scoped>
.vista-productos {
  display: grid;
  /* Sin separación entre filas: el encabezado queda como en Vender y Recibir. */
  gap: 0;
  min-inline-size: 0;
}
/* WCAG 2.4.11: lo que recibe el foco nunca queda tapado por el botón pegado abajo (su alto
   real, medido). */
.vista-productos :deep(:is(button, input, a)) {
  scroll-margin-bottom: calc(var(--alto-accion, 0px) + var(--espacio-3));
}
.cabecera {
  /* Título y "Categorías" en la misma fila: si no caben con su texto, queda solo el ícono. */
  container-type: inline-size;
  flex-wrap: nowrap;
  justify-content: space-between;
}
.ir-a-categorias {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  gap: var(--espacio-2);
  min-block-size: var(--alto-toque);
  min-inline-size: var(--alto-toque);
  padding-inline: var(--espacio-4);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-superficie);
  color: var(--color-texto);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
@container (max-width: 17.5rem) {
  .ir-a-categorias {
    padding-inline: 0;
  }
  .texto-categorias {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
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
.fila-de-busqueda {
  /* Siempre una fila: el botón de filtros es solo el ícono (con el número de filtros puestos). */
  display: flex;
  /* Con la etiqueta visible arriba del campo, el botón se alinea con el campo (abajo). */
  align-items: flex-end;
  gap: var(--espacio-2);
  min-inline-size: 0;
}
.fila-de-busqueda > :first-child {
  flex: 1;
  min-inline-size: 0;
}
.boton-filtros {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-block-size: var(--alto-boton-principal);
  min-inline-size: var(--alto-boton-principal);
  padding: 0;
  border: 2px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-fondo);
  color: var(--color-texto);
  cursor: pointer;
}
.boton-filtros--con-filtros {
  border-color: var(--color-primario);
  background: var(--color-primario-suave);
  color: var(--color-primario);
}
.cuenta {
  position: absolute;
  inset-block-start: -0.5rem;
  inset-inline-end: -0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 1.5rem;
  block-size: 1.5rem;
  padding-inline: 0.25rem;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--color-primario);
  color: var(--color-fondo);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
}
.icono {
  inline-size: 1.5rem;
  block-size: 1.5rem;
  flex: none;
}
/* Lo activo, en UNA línea de chips: si no caben, se desplaza de lado dentro de su fila (la
   página no se ensancha). La zona de toque (48 px) es más alta que el chip. */
.chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 0 var(--espacio-2);
  margin: calc(-1 * var(--espacio-2)) 0;
  padding: 0 var(--espacio-1);
  list-style: none;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chips > li {
  flex: none;
  min-inline-size: 0;
  max-inline-size: 85%;
  display: flex;
}
.chip {
  display: inline-flex;
  align-items: center;
  min-inline-size: 0;
  max-inline-size: 100%;
  min-block-size: var(--alto-toque);
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primario);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
.pastilla {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-1);
  min-inline-size: 0;
  padding: 0.25rem var(--espacio-3);
  border-radius: 999px;
  background: var(--color-primario-suave);
}
.chip-texto {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-x {
  inline-size: 1rem;
  block-size: 1rem;
  flex: none;
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

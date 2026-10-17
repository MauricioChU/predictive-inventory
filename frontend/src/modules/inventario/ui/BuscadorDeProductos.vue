<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { sumarDias } from '@/shared/domain/fecha'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'
import AccesosRapidos from '@/shared/ui/componentes/AccesosRapidos.vue'
import BuscadorGrande from '@/shared/ui/componentes/BuscadorGrande.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import ListaDeProductos from '@/shared/ui/componentes/ListaDeProductos.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import {
  MAXIMO_DE_ACCESOS_RAPIDOS,
  type AccesoRapido,
  type ProductoDeLista,
} from '@/shared/ui/tipos-de-productos'
import type { Concepto } from './carrito-de-pantalla'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { hoyEnLaTienda } from './hoy-en-la-tienda'
import { usarDestinos } from './usar-destinos'
import { usarFotos } from './usar-fotos'

/**
 * Vender y Llegó mercadería, paso 1 (06-experiencia-de-uso): buscador grande arriba y, debajo,
 * los 8 más vendidos como accesos rápidos; al escribir, los resultados con foto, nombre, precio
 * y stock, los más vendidos primero (RN-CAT-12, lo ordena Catálogo). Tocar uno lo elige.
 */
const props = defineProps<{ concepto: Concepto }>()
const emit = defineEmits<{ elegir: [producto: ProductoVista] }>()

const aplicacion = useAplicacion()
const router = useRouter()
const destino = usarDestinos()
const fotos = usarFotos()
const idMasVendidos = useId()

/** Ventana de "los más vendidos": la misma que usa Catálogo para ordenar la búsqueda. */
const DIAS_DE_MAS_VENDIDOS = 30

const refBuscador = ref<InstanceType<typeof BuscadorGrande>>()
const texto = ref('')
const todos = ref<ProductoVista[]>([])
const vendidos = ref<ReadonlySet<string>>(new Set())
const resultados = ref<ProductoVista[]>([])
const cargado = ref(false)
const error = ref<ErrorParaMostrar | null>(null)
let pedido = 0

const buscando = computed(() => texto.value.trim() !== '')

/** Los productos vendidos en los últimos 30 días, en el orden de Catálogo (más vendido primero). */
const masVendidos = computed(() =>
  todos.value.filter((p) => vendidos.value.has(p.id)).slice(0, MAXIMO_DE_ACCESOS_RAPIDOS),
)

const accesos = computed<AccesoRapido[]>(() =>
  masVendidos.value.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoriaNombre,
    imagen: fotos.foto(p.id),
  })),
)

const POR_UNIDAD = { UNIDAD: 'c/u', KILO: 'el kg', LITRO: 'el L' } as const

function textoDelPrecio(p: ProductoVista): string {
  return props.concepto === 'venta'
    ? formatearDinero(p.precioVenta)
    : `Costo ${formatearDinero(p.precioCompra)} ${POR_UNIDAD[p.unidad]}`
}

const tarjetas = computed<ProductoDeLista[]>(() =>
  resultados.value.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoriaNombre,
    imagen: fotos.foto(p.id),
    textoStock: p.stock.esPositiva() ? formatearCantidad(p.stock, p.unidad) : 'Agotado',
    textoPrecio: textoDelPrecio(p),
  })),
)

const vacioDeBusqueda = computed(() => ({
  titulo: `No encontramos "${texto.value.trim()}"`,
  descripcion: 'Revisa cómo está escrito o prueba con otra palabra.',
  accion: 'Borrar búsqueda',
}))

async function cargarTodo(): Promise<void> {
  try {
    const hoy = hoyEnLaTienda()
    const [productos, veces] = await Promise.all([
      aplicacion.catalogo.buscarProductos({ texto: '' }),
      aplicacion.analisis.consultable.vecesVendido(
        sumarDias(hoy, -(DIAS_DE_MAS_VENDIDOS - 1)),
        hoy,
      ),
    ])
    todos.value = productos
    vendidos.value = new Set([...veces].filter(([, n]) => n > 0).map(([id]) => id))
    error.value = null
    void fotos.cargar(masVendidos.value)
  } catch (causa) {
    error.value = errorParaMostrar(causa, props.concepto)
  } finally {
    cargado.value = true
  }
}

async function buscar(consulta: string): Promise<void> {
  const numero = (pedido += 1)
  if (consulta.trim() === '') {
    resultados.value = []
    return
  }
  try {
    const encontrados = await aplicacion.catalogo.buscarProductos({ texto: consulta })
    if (numero !== pedido) return // ya se escribió otra cosa
    resultados.value = encontrados
    void fotos.cargar(encontrados)
  } catch (causa) {
    if (numero === pedido) error.value = errorParaMostrar(causa, props.concepto)
  }
}

watch(texto, (consulta) => void buscar(consulta))

function elegir(id: string): void {
  const producto = resultados.value.find((p) => p.id === id) ?? todos.value.find((p) => p.id === id)
  if (!producto) return
  emit('elegir', producto)
  // Listo para buscar el siguiente: el buscador vuelve a mostrar los más vendidos.
  if (buscando.value) refBuscador.value?.vaciar()
}

function borrarBusqueda(): void {
  refBuscador.value?.vaciar()
  refBuscador.value?.enfocar()
}

onMounted(cargarTodo)
</script>

<template>
  <div class="buscador-de-productos">
    <BuscadorGrande
      ref="refBuscador"
      v-model="texto"
      etiqueta="Buscar producto"
      marcador="Por ejemplo: lejía"
    />

    <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />

    <EstadoVacio
      v-if="cargado && todos.length === 0 && !buscando"
      titulo="Aún no tienes productos."
      descripcion="Agrega tus productos para empezar."
      accion="Agregar el primero"
      @accion="router.push(destino('producto-nuevo'))"
    />

    <ListaDeProductos
      v-else-if="buscando"
      :productos="tarjetas"
      :vacio="vacioDeBusqueda"
      etiqueta="Resultados"
      @elegir="elegir"
      @accion="borrarBusqueda"
    />

    <section v-else-if="accesos.length > 0" class="mas-vendidos" :aria-labelledby="idMasVendidos">
      <h2 :id="idMasVendidos" class="subtitulo">Más vendidos</h2>
      <AccesosRapidos :productos="accesos" etiqueta="Más vendidos" @elegir="elegir" />
    </section>
  </div>
</template>

<style scoped>
.buscador-de-productos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-4);
}
.subtitulo {
  margin: 0 0 var(--espacio-2);
  font-size: 1.125rem;
}
</style>

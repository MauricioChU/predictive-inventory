<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, House, ListChecks, Pause, SkipForward } from 'lucide-vue-next'
import type { ProductoVista } from '@/modules/catalogo'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearCantidad, SIMBOLO_DE_UNIDAD } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraDeProgreso from '@/shared/ui/componentes/BarraDeProgreso.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import CampoNumero from '@/shared/ui/componentes/CampoNumero.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import type { EstadoDelConteo } from '../application/conteo'
import { leerContado } from '../domain/reglas'
import ResumenDelProducto from './ResumenDelProducto.vue'
import { enfocarTitulo } from './foco-y-respuesta'
import { errorParaMostrar, type ErrorParaMostrar } from './mensajes-de-error'
import { usarDeshacer } from './usar-deshacer'
import { usarDestinos } from './usar-destinos'
import { usarFotos } from './usar-fotos'

/**
 * Contar todo (HU-OP-10, RN-OP-21): un producto por pantalla, agrupados por categoría y por
 * nombre, con foto grande y "¿Cuántos hay?" → Siguiente. Cada respuesta se registra al momento
 * (como Contar stock), así que Saltar y Seguir después nunca pierden nada; al volver, sigue
 * donde quedó. Al terminar, el resumen del módulo con sus textos exactos.
 */
type Fase = 'cargando' | 'inicio' | 'contando' | 'pausa' | 'fin'

const aplicacion = useAplicacion()
const anunciador = useAnunciador()
const router = useRouter()
const destino = usarDestinos()
const deshacer = usarDeshacer()
const fotos = usarFotos()

const fase = ref<Fase>('cargando')
const estado = ref<EstadoDelConteo | null>(null)
/** Ficha del producto actual (categoría para el ícono, foto). */
const ficha = ref<ProductoVista | null>(null)
const hayProductos = ref(true)
const retomado = ref(false)
const contado = ref('')
const errorCantidad = ref<string>()
const error = ref<ErrorParaMostrar | null>(null)
const ocupado = ref(false)

const producto = computed(() => estado.value?.producto ?? null)
const etiqueta = computed(() =>
  producto.value ? `¿Cuántos hay? (${SIMBOLO_DE_UNIDAD[producto.value.unidad]})` : '¿Cuántos hay?',
)
const resumen = computed(() => estado.value?.resumen ?? [])

async function mostrar(nuevo: EstadoDelConteo): Promise<void> {
  estado.value = nuevo
  contado.value = ''
  errorCantidad.value = undefined
  if (nuevo.terminado) {
    fase.value = 'fin'
    await enfocarTitulo()
    return
  }
  fase.value = 'contando'
  const actual = nuevo.producto
  ficha.value = actual ? await aplicacion.catalogo.obtenerProducto(actual.id) : null
  if (actual) void fotos.cargar([actual])
  // Listo para escribir el siguiente número (con el teclado numérico ya abierto).
  await nextTick()
  document.querySelector<HTMLInputElement>('.vista-contar-todo .campo-numero input')?.focus()
}

/** Corre un paso del conteo de a uno (un doble toque no cuenta dos veces). */
async function paso(accion: () => Promise<void>): Promise<void> {
  if (ocupado.value) return
  ocupado.value = true
  error.value = null
  try {
    await accion()
  } catch (causa) {
    const mostrado = errorParaMostrar(causa, 'conteo')
    if (esErrorDeDominio(causa) && /^CANTIDAD|^CONTADO/.test(mostrado.codigo ?? '')) {
      errorCantidad.value = mostrado.mensaje
    } else {
      error.value = mostrado
    }
  } finally {
    ocupado.value = false
  }
}

function empezar(): Promise<void> {
  return paso(async () => {
    retomado.value = false
    await mostrar(await aplicacion.inventario.iniciarConteoGuiado())
  })
}

function siguiente(): Promise<void> {
  return paso(async () => {
    const actual = producto.value
    if (!actual) return
    const texto = contado.value
    const { operacionId, ...nuevo } = await aplicacion.inventario.responderConteo(texto)
    // RN-OP-16 / RN-OP-18 (r1 #1, M4): solo si el caso de uso registró un AJUSTE se ofrece
    // Deshacer; deshacerlo lo anula y el producto vuelve a "Te faltó contar".
    if (operacionId) {
      const ahora = formatearCantidad(leerContado(texto, actual.unidad), actual.unidad)
      let trasDeshacer: EstadoDelConteo | null = null
      deshacer.ofrecer({
        mensaje: `${actual.nombre}: ahora hay ${ahora}`,
        ejecutar: async () => {
          trasDeshacer = await aplicacion.inventario.deshacerRespuestaDeConteo(operacionId)
        },
        alDeshacer: ({ pantallaAbierta }) => {
          // El resumen y "Te faltó contar" cambian; el producto actual y lo escrito, no.
          if (pantallaAbierta && trasDeshacer) estado.value = trasDeshacer
          return `Deshiciste el conteo de ${actual.nombre}. Te faltó contarlo.`
        },
      })
    } else {
      anunciador.anunciar(`${actual.nombre}: estaba correcto`)
    }
    await mostrar(nuevo)
  })
}

function saltar(): Promise<void> {
  return paso(async () => {
    await mostrar(await aplicacion.inventario.saltarEnConteo())
  })
}

async function seguirDespues(): Promise<void> {
  fase.value = 'pausa'
  await enfocarTitulo()
}

onMounted(async () => {
  try {
    const [enCurso, productos] = await Promise.all([
      aplicacion.inventario.conteoActual(),
      aplicacion.catalogo.buscarProductos({ texto: '' }),
    ])
    hayProductos.value = productos.length > 0
    if (enCurso) {
      retomado.value = true
      await mostrar(enCurso)
    } else {
      fase.value = 'inicio'
    }
  } catch (causa) {
    error.value = errorParaMostrar(causa, 'conteo')
    fase.value = 'inicio'
  }
})
</script>

<template>
  <div class="vista-contar-todo">
    <PantallaExito v-if="fase === 'fin'" titulo="Terminaste de contar" :detalle="resumen[0]">
      <p v-for="linea in resumen.slice(1)" :key="linea" class="resumen">{{ linea }}</p>
      <BotonPrincipal
        class="accion-final"
        texto="Ir a Inicio"
        :icono="House"
        @click="router.push({ name: 'inicio' })"
      />
    </PantallaExito>

    <PantallaExito
      v-else-if="fase === 'pausa'"
      titulo="Guardamos tu avance"
      :detalle="`${estado?.progreso ?? ''}. Para seguir, vuelve a Contar todo.`"
    >
      <BotonPrincipal
        class="accion-final"
        texto="Ir a Inicio"
        :icono="House"
        @click="router.push({ name: 'inicio' })"
      />
    </PantallaExito>

    <template v-else>
      <EncabezadoPagina titulo="Contar todo" volver />
      <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />

      <template v-if="fase === 'inicio'">
        <EstadoVacio
          v-if="!hayProductos"
          titulo="Aún no tienes productos."
          descripcion="Agrega tus productos y después cuéntalos aquí."
          accion="Agregar el primero"
          @accion="router.push(destino('producto-nuevo'))"
        />
        <div v-else class="explicacion">
          <p>Te mostramos tus productos uno por uno. Escribe cuántos hay de cada uno.</p>
          <p>Lo que cuentes se guarda al momento: puedes parar y seguir después.</p>
          <BotonPrincipal texto="Empezar a contar" :icono="ListChecks" @click="empezar" />
        </div>
      </template>

      <form
        v-else-if="fase === 'contando' && producto"
        class="conteo"
        novalidate
        @submit.prevent="siguiente"
      >
        <AvisoEnPagina
          v-if="retomado"
          tono="info"
          titulo="Seguimos donde quedaste"
          texto="Lo que ya contaste está guardado."
        />
        <BarraDeProgreso
          :actual="estado?.avance.hechos ?? 0"
          :total="estado?.avance.total ?? 0"
          :texto="estado?.progreso ?? ''"
          etiqueta="Avance del conteo"
        />
        <ResumenDelProducto
          :producto="{
            nombre: producto.nombre,
            categoriaNombre: ficha?.categoriaNombre ?? '',
            unidad: producto.unidad,
            stock: producto.stock,
          }"
          :foto="fotos.foto(producto.id)"
          tamano="grande"
        />
        <CampoNumero
          v-model="contado"
          class="cantidad"
          :etiqueta="etiqueta"
          :decimales="producto.unidad !== 'UNIDAD'"
          :error="errorCantidad"
        />
        <BotonPrincipal
          texto="Siguiente"
          tipo="submit"
          :icono="ArrowRight"
          :deshabilitado="ocupado"
        />
        <div class="otras-acciones">
          <Boton texto="Saltar" :icono="SkipForward" :deshabilitado="ocupado" @click="saltar" />
          <Boton texto="Seguir después" :icono="Pause" @click="seguirDespues" />
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.explicacion,
.conteo {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-5);
  max-inline-size: 40rem;
  margin-inline: auto;
}
.explicacion p {
  margin: 0;
}
.cantidad {
  justify-self: center;
  inline-size: 100%;
  max-inline-size: 22rem;
}
.otras-acciones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--separacion-toque);
}
.otras-acciones > * {
  flex: 1 1 10rem;
}
.resumen {
  margin: 0;
  color: var(--color-texto);
}
.accion-final {
  margin-top: var(--espacio-4);
  max-inline-size: 28rem;
}
</style>

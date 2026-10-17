<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearCantidad } from '@/shared/domain/formato'
import BuscadorGrande from '@/shared/ui/componentes/BuscadorGrande.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import ListaDeProductos from '@/shared/ui/componentes/ListaDeProductos.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import RespuestaGrande from '@/shared/ui/componentes/RespuestaGrande.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import type { ProductoDeLista } from '@/shared/ui/tipos-de-productos'
import type { RespuestaNecesitoComprar } from '../application/producto'
import { textoUltimaLlegada, tonoDeRespuesta } from './textos'

/** Más resultados no ayudan en el mercado: se afina escribiendo un poco más. */
const MAXIMO_DE_RESULTADOS = 20

const aplicacion = useAplicacion()
const idTitulo = useId()

const buscado = ref('')
const resultados = shallowRef<ProductoDeLista[]>([])
/** Fotos de los resultados, cargadas aparte (la lista aparece sin esperarlas). */
const fotos = shallowRef<Record<string, Blob>>({})
const elegido = shallowRef<{
  productoId: string
  nombre: string
  respuesta: RespuestaNecesitoComprar
} | null>(null)
/** Lo que salió mal al buscar o al responder (RN-UX-07: qué pasó y qué hacer). */
const fallo = ref<{ mensaje: string; ayuda: string } | null>(null)
/** Si la última búsqueda falló: no se muestra "No hay productos con ese nombre". */
const falloDeBusqueda = ref(false)
const refBuscador = ref<InstanceType<typeof BuscadorGrande>>()
const refTitulo = ref<HTMLElement>()

let ultimaBusqueda = 0

/** RN-CAT-12: sin tildes ni mayúsculas, todas las palabras, los más vendidos primero. */
async function buscar(texto: string): Promise<void> {
  const numero = ++ultimaBusqueda
  if (texto.trim() === '') {
    resultados.value = []
    return
  }
  let productos: Awaited<ReturnType<typeof aplicacion.catalogo.buscarProductos>>
  try {
    productos = await aplicacion.catalogo.buscarProductos({ texto })
  } catch (error) {
    if (numero !== ultimaBusqueda) return
    console.error('No se pudo buscar en ¿Necesito comprar?:', error)
    falloDeBusqueda.value = true
    fallo.value = {
      mensaje: 'No pudimos buscar',
      ayuda: 'Vuelve a escribir el nombre en un momento.',
    }
    return
  }
  if (numero !== ultimaBusqueda) return
  falloDeBusqueda.value = false
  const primeros = productos.slice(0, MAXIMO_DE_RESULTADOS)
  resultados.value = primeros.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoriaNombre,
    textoStock: formatearCantidad(p.stock, p.unidad),
  }))
  void cargarFotos(primeros.filter((p) => p.tieneFoto).map((p) => p.id))
}

async function cargarFotos(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (fotos.value[id]) continue
    const foto = await aplicacion.catalogo.obtenerFoto(id)
    if (foto) fotos.value = { ...fotos.value, [id]: foto }
  }
}

/** La pantalla vacía el buscador tras responder: ese "" no es la persona borrando. */
let vaciadoTrasResponder = false

watch(buscado, (texto) => {
  const porLaPantalla = vaciadoTrasResponder
  vaciadoTrasResponder = false
  // Escribir otra cosa, o vaciarlo a mano (borrando o con "Borrar"), deja atrás el fallo.
  // Plan 17: el aviso de "No pudimos…" solo se queda cuando lo vació la pantalla al responder.
  if (texto !== '' || !porLaPantalla) fallo.value = null
  void buscar(texto)
})

const conFotos = computed(() => resultados.value.map((p) => ({ ...p, imagen: fotos.value[p.id] })))

/** RN-AN-16: una sola frase, con el stock y la última llegada debajo. */
async function elegir(productoId: string): Promise<void> {
  const nombre = resultados.value.find((p) => p.id === productoId)?.nombre ?? ''
  fallo.value = null
  try {
    const respuesta = await aplicacion.analisis.necesitoComprar(productoId)
    elegido.value = { productoId, nombre, respuesta }
  } catch (error) {
    elegido.value = null
    if (!esErrorDeDominio(error)) {
      // No es del producto (p. ej. la base no respondió): los resultados quedan para volver a tocar.
      console.error('No se pudo responder ¿Necesito comprar?:', error)
      fallo.value = {
        mensaje: 'No pudimos responder',
        ayuda: 'Vuelve a tocar el producto en un momento.',
      }
      return
    }
    fallo.value = {
      mensaje: error.message,
      ayuda: 'Búscalo otra vez: puede que ya no esté entre tus productos.',
    }
  }
  // Listo para preguntar por otro; la tarjeta tocada desaparece con los resultados, así que el
  // foco pasa al producto respondido (la frase la anuncia RespuestaGrande).
  vaciadoTrasResponder = buscado.value !== ''
  refBuscador.value?.vaciar()
  await nextTick()
  vaciadoTrasResponder = false
  if (refTitulo.value) refTitulo.value.focus()
  else refBuscador.value?.enfocar()
}
</script>

<template>
  <div class="vista-necesito-comprar">
    <EncabezadoPagina titulo="¿Necesito comprar?" volver />

    <BuscadorGrande
      ref="refBuscador"
      v-model="buscado"
      etiqueta="¿Qué producto quieres comprar?"
      marcador="Ej.: lejía"
      autofoco
    />

    <MensajeDeError v-if="fallo" :mensaje="fallo.mensaje" :ayuda="fallo.ayuda" />

    <ListaDeProductos
      v-if="buscado !== '' && !falloDeBusqueda"
      :productos="conFotos"
      etiqueta="Productos encontrados"
      :vacio="{
        titulo: 'No hay productos con ese nombre',
        descripcion: 'Revisa cómo lo escribiste o prueba con otra palabra.',
      }"
      @elegir="elegir"
    />

    <section v-else-if="elegido && buscado === ''" class="respuesta" :aria-labelledby="idTitulo">
      <h2 :id="idTitulo" ref="refTitulo" tabindex="-1">
        {{ pegarCifras(elegido.nombre) }}
      </h2>
      <!-- La :key vuelve a montar la respuesta con cada pregunta: así se anuncia otra vez aunque
           la frase sea igual a la anterior (otro producto con la misma respuesta). -->
      <RespuestaGrande
        :key="`${elegido.productoId}-${elegido.respuesta.respuesta}`"
        :texto="elegido.respuesta.respuesta"
        :tono="tonoDeRespuesta(elegido.respuesta.caso)"
      />
      <div>
        <FilaDeDato
          etiqueta="Tienes"
          :texto-valor="formatearCantidad(elegido.respuesta.stock, elegido.respuesta.unidad)"
        />
        <FilaDeDato
          etiqueta="Última llegada"
          :texto-valor="
            textoUltimaLlegada(
              elegido.respuesta.ultimoIngreso,
              elegido.respuesta.diasDesdeUltimoIngreso,
            )
          "
        />
      </div>
    </section>

    <p v-else-if="!fallo && buscado === ''" class="ayuda">
      Escribe el nombre del producto y tócalo: te digo si te conviene comprarlo.
    </p>
  </div>
</template>

<style scoped>
.vista-necesito-comprar {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.ayuda {
  margin: 0;
  color: var(--color-texto-suave);
}
.respuesta {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
.respuesta h2 {
  margin: 0;
  font-size: 1.25rem;
}
.respuesta h2:focus {
  outline: none;
}
.respuesta h2:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}
</style>

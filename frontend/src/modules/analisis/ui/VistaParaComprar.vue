<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId } from 'vue'
import { useRouter } from 'vue-router'
import { PackagePlus, Share2 } from 'lucide-vue-next'
import { useAvisoDeshacer } from '@/app/aviso-deshacer'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearDinero, formatearNumero } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BarraDeTotal from '@/shared/ui/componentes/BarraDeTotal.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import FilaDeCarrito from '@/shared/ui/componentes/FilaDeCarrito.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import { cantidadDeLista, type LineaParaComprar, type ListaParaComprar } from '../domain/compras'
import { compartirTexto } from './compartir'
import { textoCostoUnitario } from './textos'

/** Espera tras la última tecla antes de guardar una cantidad (no se guarda en cada letra). */
const ESPERA_PARA_GUARDAR_MS = 400
const AYUDA_CANTIDAD = 'Escribe cuánto vas a comprar o toca Quitar.'
const AYUDA_SIN_PRODUCTO = 'Vuelve a abrir la lista: ya no está en tus productos.'
const COPIADA = { titulo: 'Copiamos la lista', texto: 'Pégala en WhatsApp o en otra app.' }

const aplicacion = useAplicacion()
const router = useRouter()
const aviso = useAvisoDeshacer()
const anunciador = useAnunciador()
const idTextoCompartido = useId()

const lista = shallowRef<ListaParaComprar | null>(null)
/** Lo que se ve escrito en cada línea (puede ir por delante de lo guardado). */
const escritas = ref<Record<string, string>>({})
const errores = ref<Record<string, string>>({})
const errorGeneral = ref<{ mensaje: string; ayuda: string } | null>(null)
const copiada = ref(false)
/** Si no se pudo compartir ni copiar: el texto, para copiarlo a mano. */
const textoParaCopiar = ref<string | null>(null)
const refLista = ref<HTMLElement>()

/** Cantidades válidas escritas que todavía no se guardaron, por producto. */
const pendientes = new Map<string, string>()
let temporizador: ReturnType<typeof setTimeout> | undefined

async function cargar(): Promise<void> {
  const nueva = await aplicacion.analisis.listaParaComprar()
  const textos: Record<string, string> = {}
  for (const linea of nueva.lineas) {
    const id = linea.productoId
    // Lo que se está escribiendo (pendiente o con error) no se pisa con lo guardado.
    const enEdicion = pendientes.has(id) || errores.value[id] !== undefined
    textos[id] = enEdicion ? (escritas.value[id] ?? '') : formatearNumero(linea.cantidad)
  }
  escritas.value = textos
  lista.value = nueva
}

function mostrarError(error: unknown, productoId?: string): void {
  if (!esErrorDeDominio(error)) {
    console.error('No se pudo actualizar la lista para comprar:', error)
    errorGeneral.value = {
      mensaje: 'No pudimos guardar el cambio',
      ayuda: 'Inténtalo otra vez en un momento.',
    }
    return
  }
  if (error.codigo === 'PRODUCTO_NO_ENCONTRADO' || productoId === undefined) {
    errorGeneral.value = { mensaje: error.message, ayuda: AYUDA_SIN_PRODUCTO }
    return
  }
  errores.value = { ...errores.value, [productoId]: `${error.message}. ${AYUDA_CANTIDAD}` }
}

function quitarError(productoId: string): void {
  if (errores.value[productoId] === undefined) return
  const resto = { ...errores.value }
  delete resto[productoId]
  errores.value = resto
}

/** RN-AN-08: guarda ya lo que esté esperando (antes de compartir, registrar la llegada o salir). */
async function guardarPendientes(): Promise<void> {
  if (temporizador !== undefined) clearTimeout(temporizador)
  temporizador = undefined
  if (pendientes.size === 0) return
  const cambios = [...pendientes]
  pendientes.clear()
  for (const [productoId, texto] of cambios) {
    try {
      await aplicacion.analisis.cambiarCantidadEnLista(productoId, texto)
    } catch (error) {
      mostrarError(error, productoId)
    }
  }
  await cargar()
}

/** RN-UX-07: la cantidad se valida al escribirla (el mismo dominio que el caso de uso). */
function alCambiarCantidad(linea: LineaParaComprar, texto: string): void {
  const id = linea.productoId
  escritas.value = { ...escritas.value, [id]: texto }
  errorGeneral.value = null
  try {
    cantidadDeLista(texto, linea.unidad)
  } catch (error) {
    pendientes.delete(id)
    mostrarError(error, id)
    return
  }
  quitarError(id)
  pendientes.set(id, texto)
  if (temporizador !== undefined) clearTimeout(temporizador)
  temporizador = setTimeout(() => void guardarPendientes(), ESPERA_PARA_GUARDAR_MS)
}

async function restaurar(productoId: string, texto: string): Promise<void> {
  try {
    await aplicacion.analisis.cambiarCantidadEnLista(productoId, texto)
  } catch (error) {
    mostrarError(error)
  }
  await cargar()
}

/** RN-AN-08 + RN-OP-18: quitar solo vale por hoy y se puede deshacer. */
async function quitar(linea: LineaParaComprar): Promise<void> {
  const id = linea.productoId
  // Deshacer la devuelve con la cantidad que tenía (la escrita, si era válida).
  const cantidad = pendientes.get(id) ?? formatearNumero(linea.cantidad)
  pendientes.delete(id)
  quitarError(id)
  try {
    await aplicacion.analisis.quitarDeLista(id)
  } catch (error) {
    mostrarError(error)
    return
  }
  await cargar()
  // La fila (y su botón) ya no está: el foco pasa a la lista para no perderse.
  await nextTick()
  refLista.value?.focus()
  aviso.mostrar({
    mensaje: `Quitaste ${linea.nombre} de la lista`,
    alDeshacer: () => void restaurar(id, cantidad),
  })
}

async function compartir(): Promise<void> {
  copiada.value = false
  textoParaCopiar.value = null
  await guardarPendientes()
  const texto = await aplicacion.analisis.textoParaCompartir()
  const resultado = await compartirTexto(texto)
  if (resultado === 'copiado') {
    copiada.value = true
    anunciador.anunciar(`${COPIADA.titulo}. ${COPIADA.texto}`)
  } else if (resultado === 'no-se-pudo') {
    textoParaCopiar.value = texto
  }
}

/** RN-AN-08: Recibir lee la lista de hoy de Análisis (contrato de rutas): no se pasan datos. */
async function registrarLlegada(): Promise<void> {
  await guardarPendientes()
  await router.push({ name: 'recibir', query: { desde: 'para-comprar' } })
}

onMounted(cargar)
onBeforeUnmount(() => {
  // Lo escrito y todavía sin guardar no se pierde al salir.
  if (pendientes.size > 0) void guardarPendientes()
})
</script>

<template>
  <div class="vista-para-comprar">
    <EncabezadoPagina titulo="Para comprar" volver />

    <MensajeDeError
      v-if="errorGeneral"
      :mensaje="errorGeneral.mensaje"
      :ayuda="errorGeneral.ayuda"
    />

    <p v-if="!lista" class="calculando">Calculando…</p>

    <EstadoVacio
      v-else-if="lista.lineas.length === 0"
      titulo="No hace falta comprar nada por ahora"
      descripcion="Cuando algo se esté acabando, aparecerá aquí."
      accion="¿Necesito comprar?"
      @accion="router.push({ name: 'necesito-comprar' })"
    />

    <template v-else>
      <p class="intro">
        Cambia las cantidades o quita lo que no vas a comprar. Los cambios valen hasta el final del
        día.
      </p>
      <ul
        ref="refLista"
        class="lineas"
        role="list"
        aria-label="Productos para comprar"
        tabindex="-1"
      >
        <li v-for="linea in lista.lineas" :key="linea.productoId">
          <FilaDeCarrito
            :nombre="linea.nombre"
            :unidad="linea.unidad"
            :cantidad="escritas[linea.productoId] ?? ''"
            :texto-precio="textoCostoUnitario(linea.precioCompra, linea.unidad)"
            :texto-importe="formatearDinero(linea.costoEstimado)"
            etiqueta-importe="Costo estimado"
            concepto="costo"
            :error-cantidad="errores[linea.productoId]"
            @update:cantidad="alCambiarCantidad(linea, $event)"
            @quitar="quitar(linea)"
          />
        </li>
      </ul>

      <AvisoEnPagina
        v-if="copiada"
        tono="exito"
        :titulo="COPIADA.titulo"
        :texto="COPIADA.texto"
        texto-cerrar="Cerrar"
        @cerrar="copiada = false"
      />
      <div v-if="textoParaCopiar !== null" class="copiar-a-mano">
        <MensajeDeError
          mensaje="No pudimos compartir la lista"
          ayuda="Copia este texto y pégalo en WhatsApp."
        />
        <label :for="idTextoCompartido" class="etiqueta">Lista de compras</label>
        <textarea
          :id="idTextoCompartido"
          :value="textoParaCopiar"
          readonly
          :rows="textoParaCopiar.split('\n').length"
        />
      </div>

      <BotonPrincipal
        texto="Registrar llegada"
        variante="secundario"
        :icono="PackagePlus"
        @click="registrarLlegada"
      />
      <BarraDeTotal
        etiqueta="Total estimado"
        :texto-total="formatearDinero(lista.total)"
        texto-accion="Compartir"
        :icono="Share2"
        @accion="compartir"
      />
    </template>
  </div>
</template>

<style scoped>
.vista-para-comprar {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.calculando,
.intro {
  margin: 0;
  color: var(--color-texto-suave);
}
/* Una línea debajo de otra; en PC (contenido ancho), dos por fila para ver más de una vez. */
.lineas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
  gap: var(--espacio-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.lineas:focus {
  outline: none;
}
.lineas:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 4px;
}
.copiar-a-mano {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}
.etiqueta {
  font-weight: 700;
}
textarea {
  inline-size: 100%;
  padding: var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  font: inherit;
  resize: vertical;
}
</style>

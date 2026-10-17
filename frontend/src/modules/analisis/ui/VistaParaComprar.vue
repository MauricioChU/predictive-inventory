<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { PackagePlus, Share2 } from 'lucide-vue-next'
import { resultadoDeDeshacerFallido, useAvisoDeshacer } from '@/app/aviso-deshacer'
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
import type { QuitadoDeLista } from '../application/lista-de-compras'
import { cantidadDeLista, type LineaParaComprar, type ListaParaComprar } from '../domain/compras'
import { compartirTexto } from './compartir'
import { textoCostoUnitario } from './textos'

/** Espera tras la última tecla antes de guardar una cantidad (no se guarda en cada letra). */
const ESPERA_PARA_GUARDAR_MS = 400
const AYUDA_CANTIDAD = 'Escribe cuánto vas a comprar o toca Quitar.'
const MENSAJE_EN_BLANCO = 'Falta la cantidad'
const AYUDA_SIN_PRODUCTO = 'Vuelve a abrir la lista: ya no está en tus productos.'
const COPIADA = { titulo: 'Copiamos la lista', texto: 'Pégala en WhatsApp o en otra app.' }

type Accion = 'compartir la lista' | 'registrar la llegada'

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
/** Lo que no se pudo hacer (compartir o registrar) mientras quede una cantidad por corregir. */
const accionBloqueada = ref<Accion | null>(null)
/**
 * Por qué no se compartió ni se registró la llegada: nombra la primera línea que falta corregir.
 * Plan 17: al corregir esa, pasa a la siguiente (no se queda nombrando una que ya está bien).
 */
const bloqueo = computed(() => {
  const accion = accionBloqueada.value
  if (accion === null) return null
  const conError = lista.value?.lineas.find((l) => errores.value[l.productoId] !== undefined)
  if (!conError) return null
  return {
    mensaje: `Revisa la cantidad de ${conError.nombre}`,
    ayuda: `Corrígela o toca Quitar antes de ${accion}.`,
  }
})
const copiada = ref(false)
/** Si no se pudo compartir ni copiar: el texto, para copiarlo a mano. */
const textoParaCopiar = ref<string | null>(null)
const refRaiz = ref<HTMLElement>()
const refLista = ref<HTMLElement>()

/** Cantidades válidas escritas que todavía no se guardaron, por producto. */
const pendientes = new Map<string, string>()
let temporizador: ReturnType<typeof setTimeout> | undefined
/** El guardado que está en camino, si lo hay: quien necesita lo guardado lo espera. */
let guardando: Promise<void> | null = null
/** Deshacer puede llegar con la pantalla ya cerrada (el aviso es global). */
let montada = true
onBeforeUnmount(() => {
  montada = false
})

async function cargar(): Promise<void> {
  const nueva = await aplicacion.analisis.listaParaComprar()
  const textos: Record<string, string> = {}
  for (const linea of nueva.lineas) {
    const id = linea.productoId
    // Lo que se está escribiendo (pendiente, con error o borrado para escribir otro) no se pisa
    // con lo guardado.
    const enEdicion =
      pendientes.has(id) || errores.value[id] !== undefined || escritas.value[id] === ''
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
  // Ya no queda nada que corregir: se va el aviso de por qué no se compartió.
  if (Object.keys(resto).length === 0) accionBloqueada.value = null
}

async function guardar(cambios: [string, string][]): Promise<void> {
  for (const [productoId, texto] of cambios) {
    try {
      await aplicacion.analisis.cambiarCantidadEnLista(productoId, texto)
    } catch (error) {
      mostrarError(error, productoId)
    }
  }
  await cargar()
}

/**
 * RN-AN-08: guarda ya lo que esté esperando, después del guardado que ya estuviera en camino
 * (antes de compartir, registrar la llegada, quitar o salir de la pantalla).
 */
async function guardarPendientes(): Promise<void> {
  if (temporizador !== undefined) clearTimeout(temporizador)
  temporizador = undefined
  while (guardando) await guardando
  if (pendientes.size === 0) return
  const cambios = [...pendientes]
  pendientes.clear()
  guardando = guardar(cambios).finally(() => {
    guardando = null
  })
  await guardando
}

/** RN-UX-07: la cantidad se valida al escribirla (el mismo dominio que el caso de uso). */
function alCambiarCantidad(linea: LineaParaComprar, texto: string): void {
  const id = linea.productoId
  escritas.value = { ...escritas.value, [id]: texto }
  errorGeneral.value = null
  if (texto.trim() === '') {
    // Borró el número para escribir otro: todavía no hay nada que guardar ni que corregir.
    pendientes.delete(id)
    quitarError(id)
    return
  }
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

function enfocarCampo(productoId: string): void {
  const filas = refRaiz.value?.querySelectorAll<HTMLElement>('li[data-producto]') ?? []
  const fila = [...filas].find((li) => li.dataset.producto === productoId)
  fila?.querySelector('input')?.focus()
}

function enfocarTitulo(): void {
  const titulo = refRaiz.value?.querySelector<HTMLElement>('h1')
  if (!titulo) return
  if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1')
  titulo.focus()
}

/**
 * Con una cantidad que no vale, lo que se compartiría o registraría no es lo que se ve: no se
 * sigue. Se dice por qué (MensajeDeError, role="alert") y el foco va a ese campo.
 */
function hayQueCorregir(accion: Accion): boolean {
  const lineas = lista.value?.lineas ?? []
  // Plan 17: una cantidad en blanco tampoco es lo que se compartiría: se pide escribirla.
  const enBlanco = lineas.filter((l) => (escritas.value[l.productoId] ?? '').trim() === '')
  if (enBlanco.length > 0) {
    const nuevos = { ...errores.value }
    for (const l of enBlanco) nuevos[l.productoId] ??= `${MENSAJE_EN_BLANCO}. ${AYUDA_CANTIDAD}`
    errores.value = nuevos
  }
  const conError = lineas.find((l) => errores.value[l.productoId] !== undefined)
  if (!conError) {
    accionBloqueada.value = null
    return false
  }
  accionBloqueada.value = accion
  enfocarCampo(conError.productoId)
  return true
}

/**
 * Plan 17 (RN-UX-11): lo que se deshizo (o por qué no se pudo) se ve y se anuncia donde se ven
 * todos los Deshacer, esté donde esté la persona, como en Vender y Recibir.
 */
async function deshacerQuitar(quitado: QuitadoDeLista, nombre: string): Promise<void> {
  try {
    await aplicacion.analisis.deshacerQuitarDeLista(quitado)
  } catch (error) {
    aviso.mostrarResultado(resultadoDeDeshacerFallido(error))
    return
  }
  aviso.mostrarResultado({
    tono: 'exito',
    titulo: `Deshiciste quitar ${nombre}. Volvió a la lista.`,
  })
  if (!montada) return
  try {
    await cargar()
  } catch (error) {
    console.error('No se pudo volver a leer la lista para comprar:', error)
  }
}

/** RN-AN-08 + RN-OP-18: quitar solo vale por hoy, y Deshacer deja la lista como estaba. */
async function quitar(linea: LineaParaComprar): Promise<void> {
  const id = linea.productoId
  // Lo recién escrito se guarda antes: Deshacer devuelve la línea con esa cantidad.
  await guardarPendientes()
  quitarError(id)
  let quitado: QuitadoDeLista
  try {
    quitado = await aplicacion.analisis.quitarDeLista(id)
  } catch (error) {
    mostrarError(error)
    return
  }
  await cargar()
  // La fila (y su botón) ya no está: el foco no debe perderse.
  await nextTick()
  if (lista.value?.lineas.length) refLista.value?.focus()
  else enfocarTitulo()
  aviso.mostrar({
    mensaje: `Quitaste ${linea.nombre} de la lista`,
    alDeshacer: () => void deshacerQuitar(quitado, linea.nombre),
  })
}

async function compartir(): Promise<void> {
  copiada.value = false
  textoParaCopiar.value = null
  await guardarPendientes()
  if (hayQueCorregir('compartir la lista')) return
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
  if (hayQueCorregir('registrar la llegada')) return
  await router.push({ name: 'recibir', query: { desde: 'para-comprar' } })
}

onMounted(cargar)
// Lo escrito y todavía sin guardar no se pierde al salir: la salida espera a que se guarde.
// Plan 17: si algo falla (p. ej. volver a leer la lista), se registra y la salida sigue: la
// persona nunca queda atrapada en la pantalla.
onBeforeRouteLeave(async () => {
  try {
    await guardarPendientes()
  } catch (error) {
    console.error('No se pudo terminar de guardar la lista para comprar al salir:', error)
  }
})
</script>

<template>
  <div ref="refRaiz" class="vista-para-comprar">
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
        <li v-for="linea in lista.lineas" :key="linea.productoId" :data-producto="linea.productoId">
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

      <!-- Junto a las acciones: dice por qué no se compartió ni se registró la llegada. La :key
           lo vuelve a montar (y a anunciar, role="alert") cuando pasa a nombrar otra línea. -->
      <MensajeDeError
        v-if="bloqueo"
        :key="`${bloqueo.mensaje} ${bloqueo.ayuda}`"
        class="bloqueo"
        :mensaje="bloqueo.mensaje"
        :ayuda="bloqueo.ayuda"
      />
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

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { resultadoDeDeshacerFallido, useAvisoDeshacer } from '@/app/aviso-deshacer'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearEntero, plural } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import type { CategoriaVista } from '../application/modulo'
import FilaDeCategoria from './FilaDeCategoria.vue'

const app = useAplicacion()
const aviso = useAvisoDeshacer()
const anunciador = useAnunciador()

const cargando = ref(true)
const categorias = ref<CategoriaVista[]>([])
/** Productos (activos y archivados) por categoría: RN-CAT-15 cuenta los dos. */
const cantidades = ref<ReadonlyMap<string, number>>(new Map())

const nueva = ref('')
const errorNueva = ref<string | undefined>()
const agregada = ref<string | null>(null)

const editandoId = ref<string | null>(null)
const nombreNuevo = ref('')
const errorNombre = ref<string | undefined>()
const errorEliminar = ref<{ categoriaId: string; mensaje: string } | null>(null)
const errorGeneral = ref<string | null>(null)

const refTituloLista = ref<HTMLElement>()
let montada = true
onBeforeUnmount(() => {
  montada = false
})

async function cargar() {
  const [lista, productos] = await Promise.all([
    app.catalogo.listarCategorias(),
    app.catalogo.consultable.productos(),
  ])
  if (!montada) return
  const porCategoria = new Map<string, number>()
  for (const p of productos)
    porCategoria.set(p.categoriaId, (porCategoria.get(p.categoriaId) ?? 0) + 1)
  categorias.value = lista
  cantidades.value = porCategoria
  cargando.value = false
}
cargar().catch((error: unknown) => {
  console.error('No se pudieron leer las categorías:', error)
  errorGeneral.value = 'No pudimos abrir tus categorías.'
})

function textoCantidad(categoriaId: string): string {
  const n = cantidades.value.get(categoriaId) ?? 0
  return n === 0 ? 'Sin productos' : `${formatearEntero(n)} ${plural(n, 'producto', 'productos')}`
}

/** Un error de dominio va donde corresponde; cualquier otro, como error general. */
function mensajeDe(error: unknown): string | null {
  if (esErrorDeDominio(error)) return error.message
  console.error('No se pudo cambiar la categoría:', error)
  errorGeneral.value = 'No pudimos guardar el cambio.'
  return null
}

function limpiarAvisos() {
  errorGeneral.value = null
  errorEliminar.value = null
  agregada.value = null
}

async function agregar() {
  limpiarAvisos()
  const nombre = nueva.value.trim()
  try {
    await app.catalogo.crearCategoria(nueva.value)
    errorNueva.value = undefined
    nueva.value = ''
    agregada.value = nombre
    anunciador.anunciar(`Agregaste la categoría ${nombre}`)
    await cargar()
  } catch (error) {
    errorNueva.value = mensajeDe(error) ?? undefined
  }
}

function editar(categoria: CategoriaVista) {
  limpiarAvisos()
  editandoId.value = categoria.id
  nombreNuevo.value = categoria.nombre
  errorNombre.value = undefined
}

function cancelar() {
  editandoId.value = null
  errorNombre.value = undefined
}

async function guardarNombre(categoria: CategoriaVista) {
  try {
    await app.catalogo.renombrarCategoria(categoria.id, nombreNuevo.value)
    await cargar()
    editandoId.value = null
    errorNombre.value = undefined
    anunciador.anunciar(`Ahora se llama ${nombreNuevo.value.trim()}`)
  } catch (error) {
    errorNombre.value = mensajeDe(error) ?? undefined
  }
}

/** RN-CAT-15: solo se elimina una categoría sin productos; se puede deshacer (RN-UX-08). */
async function eliminar(categoria: CategoriaVista) {
  limpiarAvisos()
  editandoId.value = null
  try {
    await app.catalogo.eliminarCategoria(categoria.id)
  } catch (error) {
    const mensaje = mensajeDe(error)
    if (mensaje) errorEliminar.value = { categoriaId: categoria.id, mensaje }
    return
  }
  await cargar()
  aviso.mostrar({
    mensaje: `Eliminaste la categoría ${categoria.nombre}`,
    alDeshacer: () => void volverACrear(categoria.nombre),
  })
  // La fila (y su botón) ya no está: el foco va al título de la lista.
  await nextTick()
  refTituloLista.value?.focus()
}

/** Plan 17 (RN-UX-11): lo que se deshizo (o por qué no se pudo) se ve y se anuncia. */
async function volverACrear(nombre: string) {
  try {
    await app.catalogo.crearCategoria(nombre)
  } catch (error) {
    aviso.mostrarResultado(resultadoDeDeshacerFallido(error))
    return
  }
  aviso.mostrarResultado({
    tono: 'exito',
    titulo: `Deshiciste eliminar la categoría ${nombre}. Volvió a tu lista.`,
  })
  if (!montada) return
  try {
    await cargar()
  } catch (error) {
    console.error('No se pudieron leer las categorías:', error)
  }
}
</script>

<template>
  <div class="vista-categorias">
    <EncabezadoPagina titulo="Categorías" volver />
    <p class="intro">Agrupa tus productos para encontrarlos más rápido.</p>
    <MensajeDeError v-if="errorGeneral" :mensaje="errorGeneral" ayuda="Vuelve a intentarlo." />

    <template v-if="!cargando">
      <section class="seccion" aria-labelledby="titulo-lista-categorias">
        <h2 id="titulo-lista-categorias" ref="refTituloLista" tabindex="-1">Tus categorías</h2>
        <ul class="lista" role="list">
          <li v-for="categoria in categorias" :key="categoria.id">
            <FilaDeCategoria
              v-model:nombre-nuevo="nombreNuevo"
              :nombre="categoria.nombre"
              :texto-cantidad="textoCantidad(categoria.id)"
              :editando="editandoId === categoria.id"
              :error-nombre="editandoId === categoria.id ? errorNombre : undefined"
              :error-eliminar="
                errorEliminar?.categoriaId === categoria.id ? errorEliminar.mensaje : undefined
              "
              @editar="editar(categoria)"
              @guardar="guardarNombre(categoria)"
              @cancelar="cancelar"
              @eliminar="eliminar(categoria)"
            />
          </li>
        </ul>
      </section>

      <section class="seccion nueva" aria-labelledby="titulo-nueva-categoria">
        <h2 id="titulo-nueva-categoria">Agregar una categoría</h2>
        <AvisoEnPagina
          v-if="agregada"
          tono="exito"
          :titulo="`Agregaste la categoría ${agregada}`"
        />
        <form class="formulario" novalidate @submit.prevent="agregar">
          <CampoTexto
            v-model="nueva"
            etiqueta="Nombre de la categoría nueva"
            autocompletar="off"
            :error="errorNueva"
          />
          <BotonPrincipal tipo="submit" texto="Agregar categoría" :icono="Plus" />
        </form>
      </section>
    </template>
  </div>
</template>

<style scoped>
.vista-categorias {
  display: grid;
  gap: var(--espacio-4);
  min-inline-size: 0;
  max-inline-size: 46rem;
}
.intro {
  margin: 0;
  color: var(--color-texto-suave);
}
.seccion {
  display: grid;
  gap: var(--espacio-3);
  min-inline-size: 0;
}
.seccion h2 {
  margin: 0;
  font-size: 1.2rem;
}
.seccion h2:focus {
  /* Foco programático (tras eliminar), no interactivo: sin anillo. */
  outline: none;
}
.lista {
  display: grid;
  gap: max(var(--separacion-toque), var(--espacio-2));
  margin: 0;
  padding: 0;
  list-style: none;
}
.lista > li {
  min-inline-size: 0;
}
.formulario {
  display: grid;
  gap: var(--espacio-3);
}
</style>

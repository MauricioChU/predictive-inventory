<script setup lang="ts">
import { computed, ref, shallowRef, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, FileSpreadsheet, Upload } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { plural } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import Tarjeta from '@/shared/ui/componentes/Tarjeta.vue'
import { entregarArchivo } from '@/shared/ui/entregar-archivo'
import type { Previsualizacion } from '../application/importar'

/**
 * RN-RE-07/08: plantilla descargable → elegir el Excel → vista previa con las filas válidas y
 * cada problema en lenguaje simple ("Fila 7: falta el precio de venta") → se cargan SOLO las
 * válidas al confirmar. Desde la primera vez (`?desde=primera-vez`) sigue con el conteo.
 */
const aplicacion = useAplicacion()
const route = useRoute()
const router = useRouter()
const anunciador = useAnunciador()
const idListos = useId()
const idProblemas = useId()

const desdePrimeraVez = computed(() => route.query.desde === 'primera-vez')
const selector = ref<HTMLInputElement>()
const vista = shallowRef<Previsualizacion | null>(null)
const trabajando = ref(false)
const importados = ref<number | null>(null)
const error = ref<string | null>(null)

const listos = computed(() => vista.value?.validas.length ?? 0)
const problemas = computed(() => vista.value?.conProblemas.length ?? 0)

function cuantos(n: number, singular: string, enPlural: string): string {
  return `${n} ${plural(n, singular, enPlural)}`
}

/** RN-UX-15: "2 productos listos para cargar, 2 filas con problema". */
function resumenDeLaVistaPrevia(previa: Previsualizacion): string {
  const { validas, conProblemas } = previa
  const listas =
    validas.length > 0
      ? cuantos(validas.length, 'producto listo para cargar', 'productos listos para cargar')
      : 'Ninguna fila se puede cargar'
  if (conProblemas.length === 0) return listas
  return `${listas}, ${cuantos(conProblemas.length, 'fila con problema', 'filas con problema')}`
}

function mensajeDe(causa: unknown, siNoEsDeDominio: string): string {
  if (esErrorDeDominio(causa)) return causa.message
  console.error(siNoEsDeDominio, causa)
  return siNoEsDeDominio
}

async function descargarPlantilla(): Promise<void> {
  error.value = null
  try {
    await entregarArchivo(await aplicacion.respaldo.descargarPlantilla(), 'descargar')
  } catch (causa) {
    error.value = mensajeDe(causa, 'No se pudo descargar la plantilla')
  }
}

async function alElegir(evento: Event): Promise<void> {
  const entrada = evento.target as HTMLInputElement
  const archivo = entrada.files?.[0]
  if (!archivo) return
  vista.value = null
  error.value = null
  trabajando.value = true
  try {
    vista.value = await aplicacion.respaldo.previsualizarImportacion(archivo)
    anunciador.anunciar(resumenDeLaVistaPrevia(vista.value))
  } catch (causa) {
    error.value = mensajeDe(causa, 'No se pudo leer el Excel')
  } finally {
    trabajando.value = false
    entrada.value = ''
  }
}

async function cargar(): Promise<void> {
  if (!vista.value) return
  trabajando.value = true
  error.value = null
  try {
    importados.value = (await aplicacion.respaldo.confirmarImportacion(vista.value)).importados
  } catch (causa) {
    error.value = mensajeDe(causa, 'No se pudieron cargar los productos')
  } finally {
    trabajando.value = false
  }
}

function despuesDeCargar(): void {
  if (desdePrimeraVez.value) void router.push({ name: 'primera-vez', query: { paso: 'contar' } })
  else void router.push({ name: 'ajustes' })
}
</script>

<template>
  <PantallaExito
    v-if="importados !== null"
    :titulo="importados === 1 ? 'Se cargó 1 producto' : `Se cargaron ${importados} productos`"
    detalle="Ya están en Productos."
  >
    <BotonPrincipal
      :texto="desdePrimeraVez ? 'Seguir' : 'Volver a Ajustes'"
      @click="despuesDeCargar"
    />
  </PantallaExito>

  <div v-else class="vista-importar">
    <EncabezadoPagina titulo="Importar productos" volver />

    <div class="explicacion">
      <p class="destacado">Carga muchos productos de una vez desde un Excel.</p>
      <p>
        Usa la plantilla: tiene las columnas nombre, categoría, unidad, precio de compra, precio de
        venta, stock mínimo y stock inicial. Las categorías que no existan se crean solas.
      </p>
      <Boton texto="Descargar la plantilla" :icono="Download" @click="descargarPlantilla" />
    </div>

    <input
      ref="selector"
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      class="selector"
      @change="alElegir"
    />

    <MensajeDeError
      v-if="error"
      :mensaje="error"
      ayuda="Usa la plantilla y vuelve a elegir el archivo."
    />

    <template v-if="vista">
      <Tarjeta v-if="listos > 0" class="grupo">
        <section :aria-labelledby="idListos">
          <h2 :id="idListos">
            {{ cuantos(listos, 'producto listo para cargar', 'productos listos para cargar') }}
          </h2>
          <ul>
            <li v-for="fila in vista.validas" :key="fila.fila">
              <strong>{{ fila.datos.nombre }}</strong> · {{ fila.categoriaNombre }}
            </li>
          </ul>
        </section>
      </Tarjeta>
      <AvisoEnPagina
        v-else
        tono="atencion"
        titulo="Ninguna fila se puede cargar"
        texto="Corrige el Excel y vuelve a elegirlo."
      />

      <section v-if="problemas > 0" class="problemas" :aria-labelledby="idProblemas">
        <h2 :id="idProblemas">
          {{ cuantos(problemas, 'fila con problema', 'filas con problema') }}
        </h2>
        <p>Estas filas no se cargan. Corrígelas en el Excel y vuelve a elegirlo.</p>
        <ul>
          <li v-for="problema in vista.conProblemas" :key="problema.fila">
            {{ problema.problema }}
          </li>
        </ul>
      </section>
    </template>

    <div class="acciones">
      <BotonPrincipal
        v-if="listos > 0"
        :texto="`Cargar ${cuantos(listos, 'producto', 'productos')}`"
        :icono="Upload"
        :deshabilitado="trabajando"
        @click="cargar"
      />
      <BotonPrincipal
        :texto="vista || error ? 'Elegir otro Excel' : 'Elegir el Excel'"
        :variante="listos > 0 ? 'secundario' : 'primario'"
        :icono="FileSpreadsheet"
        :deshabilitado="trabajando"
        @click="selector?.click()"
      />
    </div>
  </div>
</template>

<style scoped>
.vista-importar {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  min-height: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--relleno-bloque, var(--espacio-4)));
}
.explicacion {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--espacio-3);
}
.explicacion p {
  margin: 0;
}
.destacado {
  font-size: 1.15rem;
  font-weight: 700;
}
.selector {
  display: none;
}
h2 {
  margin: 0 0 var(--espacio-2);
  font-size: 1.1rem;
}
ul {
  margin: 0;
  padding-left: 1.25em;
}
li + li {
  margin-top: var(--espacio-1);
}
.problemas {
  padding: var(--espacio-4);
  border: 2px solid var(--color-advertencia);
  border-left-width: 6px;
  border-radius: var(--radio);
  background: var(--color-advertencia-suave);
}
.problemas p {
  margin: 0 0 var(--espacio-2);
}
.acciones {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
@media (min-width: 1024px) {
  .vista-importar {
    min-height: auto;
    max-width: 48rem;
  }
  .acciones {
    margin-top: var(--espacio-4);
  }
}
</style>

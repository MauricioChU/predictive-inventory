<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArchiveRestore,
  Bell,
  BellOff,
  FileSpreadsheet,
  ListChecks,
  Save,
  Store,
  Tags,
  Upload,
} from 'lucide-vue-next'
import { useEstadoGlobal } from '@/app/estado-global'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { ConfiguracionDeNegocio, TamanoDeLetra } from '@/shared/contratos/configuracion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { diaDe } from '@/shared/domain/fecha'
import { formatearDia } from '@/shared/domain/formato'
import { useAnunciador } from '@/shared/ui/anunciador'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonesDeOpcion from '@/shared/ui/componentes/BotonesDeOpcion.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import { entregarArchivo } from '@/shared/ui/entregar-archivo'
import { aplicarTamanoDeLetra } from '@/shared/ui/preferencias/tamano-de-letra'
import EnlaceDeAjuste from './EnlaceDeAjuste.vue'
import { OPCIONES_DE_LETRA } from './opciones-de-letra'
import { haciaPantalla } from './pantallas-de-otras-ramas'

const aplicacion = useAplicacion()
const estadoGlobal = useEstadoGlobal()
const router = useRouter()
const anunciador = useAnunciador()
const ids = {
  tienda: useId(),
  letra: useId(),
  avisos: useId(),
  copia: useId(),
  excel: useId(),
  revisar: useId(),
  acerca: useId(),
}

const VERSION = __VERSION_DE_LA_APP__

const configuracion = ref<ConfiguracionDeNegocio | null>(null)
const ultimaCopia = ref<string | null>(null)
const avisosActivos = ref<boolean | null>(null)
const exportado = ref<string | null>(null)
const revision = ref<string | null>(null)
const ocupado = ref<'letra' | 'avisos' | 'exportar' | 'revisar' | null>(null)
const error = ref<string | null>(null)

const resumenDeLaTienda = computed(() => {
  const c = configuracion.value
  return c ? `${c.nombreTienda} · compras cada ${c.diasEntreCompras} días` : undefined
})
const textoUltimaCopia = computed(() =>
  ultimaCopia.value === null
    ? 'Todavía no guardas una copia de tus datos'
    : `Tu última copia es del ${formatearDia(diaDe(ultimaCopia.value))}`,
)

async function leerAvisos(): Promise<void> {
  avisosActivos.value = await aplicacion.alertas.notificacionesPermitidas()
}

onMounted(async () => {
  const [config, sistema] = await Promise.all([
    aplicacion.tienda.obtenerConfiguracion(),
    aplicacion.tienda.consultable.estadoDelSistema(),
    leerAvisos(),
  ])
  configuracion.value = config
  ultimaCopia.value = sistema.ultimoRespaldoEn
})

/** Corre una acción de Ajustes: una a la vez, y su error se muestra con su mensaje. */
async function hacer(que: NonNullable<typeof ocupado.value>, accion: () => Promise<void>) {
  ocupado.value = que
  error.value = null
  try {
    await accion()
  } catch (causa) {
    if (!esErrorDeDominio(causa)) console.error(`Falló "${que}" en Ajustes:`, causa)
    error.value = esErrorDeDominio(causa) ? causa.message : 'No se pudo completar'
  } finally {
    ocupado.value = null
  }
}

/** RN-UX-01: toda la app cambia en el acto y queda guardado en la configuración. */
function elegirLetra(tamano: TamanoDeLetra): void {
  aplicarTamanoDeLetra(tamano)
  if (configuracion.value) configuracion.value = { ...configuracion.value, tamanoDeLetra: tamano }
  void hacer('letra', async () => {
    await aplicacion.tienda.actualizarConfiguracion({ tamanoDeLetra: tamano })
    const etiqueta = OPCIONES_DE_LETRA.find((o) => o.valor === tamano)?.etiqueta ?? ''
    anunciador.anunciar(`Letra ${etiqueta.toLowerCase()}`)
  })
}

/** M1: apagarlas se guarda en la configuración de la tienda (el permiso lo maneja el navegador). */
function desactivarAvisos(): void {
  void hacer('avisos', async () => {
    await aplicacion.tienda.actualizarConfiguracion({ notificacionesActivas: false })
    await leerAvisos()
    anunciador.anunciar('Avisos desactivados')
  })
}

/** RN-RE-01 */
function exportar(): void {
  exportado.value = null
  void hacer('exportar', async () => {
    const archivo = await aplicacion.respaldo.exportarExcel()
    const entrega = await entregarArchivo(archivo)
    if (entrega === 'cancelado') return
    exportado.value =
      entrega === 'compartido'
        ? `Mandaste ${archivo.nombre}`
        : `Quedó en Descargas: ${archivo.nombre}`
    anunciador.anunciar(exportado.value)
  })
}

/** RN-OP-19 */
function revisarDatos(): void {
  revision.value = null
  void hacer('revisar', async () => {
    revision.value = (await aplicacion.inventario.revisarDatos()).mensaje
    anunciador.anunciar(revision.value)
  })
}
</script>

<template>
  <div class="vista-ajustes">
    <EncabezadoPagina titulo="Ajustes" volver />

    <MensajeDeError v-if="error" :mensaje="error" ayuda="Vuelve a intentarlo en un momento." />

    <div class="secciones">
      <section :aria-labelledby="ids.tienda" class="seccion">
        <h2 :id="ids.tienda">Tu tienda</h2>
        <EnlaceDeAjuste
          :a="{ name: 'datos-de-la-tienda' }"
          :icono="Store"
          titulo="Datos de la tienda"
          :detalle="resumenDeLaTienda"
        />
        <EnlaceDeAjuste
          :a="haciaPantalla(router, 'categorias')"
          :icono="Tags"
          titulo="Categorías"
          detalle="Crea, cambia o borra categorías"
        />
      </section>

      <section :aria-labelledby="ids.letra" class="seccion">
        <h2 :id="ids.letra">Letra</h2>
        <BotonesDeOpcion
          :model-value="configuracion?.tamanoDeLetra ?? estadoGlobal.tamanoDeLetra"
          :opciones="OPCIONES_DE_LETRA"
          etiqueta="Tamaño de letra"
          @update:model-value="elegirLetra"
        />
      </section>

      <section :aria-labelledby="ids.avisos" class="seccion">
        <h2 :id="ids.avisos">Avisos en tu celular</h2>
        <template v-if="avisosActivos">
          <p>Los avisos en tu celular están activados.</p>
          <Boton
            texto="Desactivar avisos"
            :icono="BellOff"
            :deshabilitado="ocupado === 'avisos'"
            @click="desactivarAvisos"
          />
        </template>
        <template v-else-if="avisosActivos === false">
          <p>Los avisos en tu celular están desactivados. Igual ves lo que se acaba en Inicio.</p>
          <Boton
            texto="Activar avisos"
            variante="primario"
            :icono="Bell"
            @click="router.push({ name: 'avisos' })"
          />
          <p class="ayuda">
            Si antes dijiste que no, el celular no vuelve a preguntar: abre los ajustes del
            navegador, entra a Notificaciones y permite esta app.
          </p>
        </template>
      </section>

      <section :aria-labelledby="ids.copia" class="seccion">
        <h2 :id="ids.copia">Copia de tus datos</h2>
        <EnlaceDeAjuste
          :a="{ name: 'guardar-copia' }"
          :icono="Save"
          titulo="Guardar copia"
          :detalle="textoUltimaCopia"
        />
        <EnlaceDeAjuste
          :a="{ name: 'restaurar-copia' }"
          :icono="ArchiveRestore"
          titulo="Restaurar copia"
          detalle="Cambia los datos por los de una copia"
        />
      </section>

      <section :aria-labelledby="ids.excel" class="seccion">
        <h2 :id="ids.excel">Excel</h2>
        <p>Tus productos, sus movimientos y el resumen de los últimos 90 días.</p>
        <Boton
          texto="Exportar a Excel"
          :icono="FileSpreadsheet"
          :deshabilitado="ocupado === 'exportar'"
          @click="exportar"
        />
        <AvisoEnPagina v-if="exportado" tono="exito" titulo="Listo" :texto="exportado" />
        <EnlaceDeAjuste
          :a="{ name: 'importar-productos' }"
          :icono="Upload"
          titulo="Importar productos"
          detalle="Carga muchos productos desde un Excel"
        />
      </section>

      <section :aria-labelledby="ids.revisar" class="seccion">
        <h2 :id="ids.revisar">Revisar datos</h2>
        <p>
          Revisa que el stock de cada producto cuadre con sus movimientos y lo corrige si hace
          falta.
        </p>
        <Boton
          texto="Revisar datos"
          :icono="ListChecks"
          :deshabilitado="ocupado === 'revisar'"
          @click="revisarDatos"
        />
        <AvisoEnPagina v-if="revision" tono="exito" :titulo="revision" />
      </section>

      <section :aria-labelledby="ids.acerca" class="seccion">
        <h2 :id="ids.acerca">Acerca de</h2>
        <p>Inventario de la Tienda. Funciona sin internet y guarda tus datos en este celular.</p>
        <p>Versión {{ VERSION }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.vista-ajustes {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.secciones {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-6);
}
.seccion {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--espacio-3);
}
.seccion > :deep(.boton) {
  align-self: flex-start;
  max-width: 100%;
}
h2 {
  margin: 0;
  font-size: 1.15rem;
}
.seccion p {
  margin: 0;
}
.ayuda {
  color: var(--color-texto-suave);
}

/* PC: dos columnas de secciones. */
@media (min-width: 1024px) {
  .secciones {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--espacio-6) var(--espacio-6);
    align-items: start;
  }
}
</style>

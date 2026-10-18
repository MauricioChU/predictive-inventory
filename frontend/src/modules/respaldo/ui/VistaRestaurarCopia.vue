<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArchiveRestore, FolderOpen } from 'lucide-vue-next'
import { useEstadoGlobal } from '@/app/estado-global'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { useAnunciador } from '@/shared/ui/anunciador'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import DialogoConfirmacion from '@/shared/ui/componentes/DialogoConfirmacion.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import Tarjeta from '@/shared/ui/componentes/Tarjeta.vue'
import { leerComoTexto } from './leer-como-texto'

/**
 * RN-RE-03/04/05: restaurar reemplaza TODOS los datos del celular. Antes de tocar nada se valida
 * la copia y se muestra qué contiene; después se piden las dos confirmaciones del módulo
 * (`prepararRestauracion`). Si algo falla, los datos actuales quedan como estaban.
 *
 * Con `?desde=primera-vez` (RN-RE-10) viene de la bienvenida: *Volver* y cancelar regresan a ella
 * (no hay otra pantalla a la que ir), y al restaurar bien la primera vez queda completada.
 */
const aplicacion = useAplicacion()
const estadoGlobal = useEstadoGlobal()
const route = useRoute()
const router = useRouter()
const desdePrimeraVez = computed(() => route.query.desde === 'primera-vez')
const anunciador = useAnunciador()

const selector = ref<HTMLInputElement>()
const elegida = shallowRef<{
  nombre: string
  texto: string
  resumen: string
  confirmaciones: readonly [string, string]
} | null>(null)
const confirmando = ref<0 | 1 | 2>(0)
const restaurando = ref(false)
const restaurada = ref<string | null>(null)
const error = ref<{ mensaje: string; ayuda: string } | null>(null)

/** El nombre que le da el módulo Respaldo a cada copia: `respaldo-<tienda>-<fecha>-<hora>.json`. */
const AYUDA_ARCHIVO =
  'Elige el archivo que guardaste con «Guardar copia»: su nombre empieza con «respaldo-».'

function mensajeDe(causa: unknown, siNoEsDeDominio: string): string {
  if (esErrorDeDominio(causa)) return causa.message
  console.error(siNoEsDeDominio, causa)
  return siNoEsDeDominio
}

async function alElegir(evento: Event): Promise<void> {
  const entrada = evento.target as HTMLInputElement
  const archivo = entrada.files?.[0]
  if (!archivo) return
  elegida.value = null
  error.value = null
  try {
    const texto = await leerComoTexto(archivo)
    const { resumen, confirmaciones } = await aplicacion.respaldo.prepararRestauracion(texto)
    elegida.value = { nombre: archivo.name, texto, resumen: resumen.texto, confirmaciones }
    anunciador.anunciar(`La copia tiene ${resumen.texto}`)
  } catch (causa) {
    error.value = { mensaje: mensajeDe(causa, 'No se pudo leer el archivo'), ayuda: AYUDA_ARCHIVO }
  } finally {
    // Así se puede volver a elegir el mismo archivo.
    entrada.value = ''
  }
}

/** Desde la bienvenida no hay "atrás" que valga: se vuelve a ella sin dejar esta pantalla atrás. */
function volverALaBienvenida(): void {
  void router.replace({ name: 'primera-vez' })
}

/** Cancelar una confirmación: desde la bienvenida, también se deja la restauración. */
function cancelarConfirmacion(): void {
  confirmando.value = 0
  if (desdePrimeraVez.value) volverALaBienvenida()
}

async function restaurar(): Promise<void> {
  const copia = elegida.value
  confirmando.value = 0
  if (!copia) return
  restaurando.value = true
  try {
    await aplicacion.respaldo.restaurarCopia(copia.texto, { confirmaciones: 2 })
    // La restauración ya marcó la primera vez como completada (RN-RE-10); el estado global la
    // recarga solo, pero "Ir al inicio" decide con él: que ya lo sepa al mostrar el éxito.
    await estadoGlobal.recargarConfiguracion()
    restaurada.value = copia.resumen
  } catch (causa) {
    error.value = {
      mensaje: mensajeDe(causa, 'No se pudo restaurar la copia'),
      ayuda: 'Tus datos de este celular siguen como estaban.',
    }
  } finally {
    restaurando.value = false
  }
}
</script>

<template>
  <PantallaExito
    v-if="restaurada"
    titulo="Copia restaurada"
    :detalle="`Ahora tienes ${restaurada}.`"
  >
    <BotonPrincipal texto="Ir al inicio" @click="router.push({ name: 'inicio' })" />
  </PantallaExito>

  <div v-else class="vista-restaurar-copia">
    <!-- Dos encabezados: EncabezadoPagina solo deja el "Volver" al padre si este escucha @volver. -->
    <EncabezadoPagina
      v-if="desdePrimeraVez"
      titulo="Restaurar copia"
      volver
      @volver="volverALaBienvenida"
    />
    <EncabezadoPagina v-else titulo="Restaurar copia" volver />

    <p class="destacado">
      Restaurar cambia todos los datos de este celular por los de una copia que guardaste antes.
    </p>
    <p>Úsalo si cambiaste de celular o si se perdieron tus datos.</p>

    <input
      ref="selector"
      type="file"
      accept=".json,application/json"
      class="selector"
      @change="alElegir"
    />

    <MensajeDeError v-if="error" :mensaje="error.mensaje" :ayuda="error.ayuda" />

    <Tarjeta v-if="elegida" class="resumen">
      <h2>La copia tiene</h2>
      <p class="contenido">{{ elegida.resumen }}</p>
      <FilaDeDato etiqueta="Archivo" :texto-valor="elegida.nombre" />
    </Tarjeta>

    <div class="acciones">
      <BotonPrincipal
        v-if="elegida"
        texto="Restaurar esta copia"
        variante="peligro"
        :icono="ArchiveRestore"
        :deshabilitado="restaurando"
        @click="confirmando = 1"
      />
      <BotonPrincipal
        :texto="elegida || error ? 'Elegir otra copia' : 'Elegir la copia'"
        :variante="elegida ? 'secundario' : 'primario'"
        :icono="FolderOpen"
        :deshabilitado="restaurando"
        @click="selector?.click()"
      />
    </div>

    <DialogoConfirmacion
      v-if="elegida"
      :abierto="confirmando === 1"
      titulo="¿Restaurar la copia?"
      :mensaje="elegida.confirmaciones[0]"
      texto-confirmar="Sí, continuar"
      texto-cancelar="No, cancelar"
      @confirmar="confirmando = 2"
      @cancelar="cancelarConfirmacion"
    />
    <DialogoConfirmacion
      v-if="elegida"
      :abierto="confirmando === 2"
      titulo="¿Seguro?"
      :mensaje="elegida.confirmaciones[1]"
      texto-confirmar="Sí, restaurar"
      texto-cancelar="No, mejor no"
      peligro
      @confirmar="restaurar"
      @cancelar="cancelarConfirmacion"
    />
  </div>
</template>

<style scoped>
.vista-restaurar-copia {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  min-height: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
}
.vista-restaurar-copia > p {
  margin: 0;
}
.destacado {
  font-size: 1.15rem;
  font-weight: 700;
}
.selector {
  display: none;
}
.resumen {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}
.resumen h2 {
  margin: 0;
  font-size: 1.1rem;
}
.contenido {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}
.acciones {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
@media (min-width: 1024px) {
  .vista-restaurar-copia {
    min-height: auto;
    max-width: 40rem;
  }
  .acciones {
    margin-top: var(--espacio-4);
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardCheck, FileSpreadsheet, Plus, Store } from 'lucide-vue-next'
import { useEstadoGlobal } from '@/app/estado-global'
import { useAplicacion } from '@/app/proveer-aplicacion'
import type { TamanoDeLetra } from '@/shared/contratos/configuracion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import BarraDeProgreso from '@/shared/ui/componentes/BarraDeProgreso.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonesDeOpcion from '@/shared/ui/componentes/BotonesDeOpcion.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import Tarjeta from '@/shared/ui/componentes/Tarjeta.vue'
import { aplicarTamanoDeLetra } from '@/shared/ui/preferencias/tamano-de-letra'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import { validarCambios } from '../domain/configuracion'
import { OPCIONES_DE_LETRA } from './opciones-de-letra'
import { haciaPantalla } from './pantallas-de-otras-ramas'

/**
 * Primera vez (06-experiencia-de-uso): bienvenida → nombre → letra → cargar productos → contar.
 * Cada paso va en la dirección (`?paso=…`), así el botón "atrás" del celular vuelve al paso
 * anterior en vez de salir de la app. La primera vez queda completada al elegir la letra: los
 * dos últimos pasos se pueden dejar para después.
 */
type Paso = 'bienvenida' | 'nombre' | 'letra' | 'productos' | 'contar'
const PASOS: readonly Paso[] = ['bienvenida', 'nombre', 'letra', 'productos', 'contar']

const TITULOS: Record<Paso, string> = {
  bienvenida: 'Te damos la bienvenida',
  nombre: '¿Cómo se llama tu tienda?',
  letra: '¿Qué tamaño de letra prefieres?',
  productos: '¿Cómo quieres cargar tus productos?',
  contar: 'Ahora contemos lo que tienes',
}

const aplicacion = useAplicacion()
const estadoGlobal = useEstadoGlobal()
const route = useRoute()
const router = useRouter()

const paso = computed<Paso>(() => {
  const pedido = route.query.paso
  return PASOS.find((p) => p !== 'bienvenida' && p === pedido) ?? 'bienvenida'
})
const numero = computed(() => PASOS.indexOf(paso.value) + 1)

const nombre = ref('')
const errorDelNombre = ref<string>()
/** La que eligió la persona; mientras no elija, la que la app tiene ahora. */
const letraElegida = ref<TamanoDeLetra | null>(null)
const letra = computed(() => letraElegida.value ?? estadoGlobal.tamanoDeLetra)
const guardando = ref(false)
const errorAlGuardar = ref<string>()

// Si se abre directo en un paso (p. ej. tras recargar), el nombre guardado no se pierde.
void aplicacion.tienda.obtenerConfiguracion().then((configuracion) => {
  if (nombre.value === '') nombre.value = configuracion.nombreTienda
})

function irA(destino: Paso, como: 'push' | 'replace' = 'push'): void {
  const ubicacion = { name: 'primera-vez', query: destino === 'bienvenida' ? {} : { paso: destino } }
  void (como === 'push' ? router.push(ubicacion) : router.replace(ubicacion))
}

function alVolver(): void {
  irA(PASOS[Math.max(0, numero.value - 2)]!, 'replace')
}

function seguirConElNombre(): void {
  errorDelNombre.value = validarCambios({ nombreTienda: nombre.value }) ?? undefined
  if (!errorDelNombre.value) irA('letra')
}

/** RN-UX-01: la vista previa es la app entera (se aplica al elegir; se guarda al seguir). */
function elegirLetra(tamano: TamanoDeLetra): void {
  letraElegida.value = tamano
  aplicarTamanoDeLetra(tamano)
}

async function guardarPrimeraVez(): Promise<void> {
  errorDelNombre.value = validarCambios({ nombreTienda: nombre.value }) ?? undefined
  if (errorDelNombre.value) {
    irA('nombre', 'replace')
    return
  }
  guardando.value = true
  errorAlGuardar.value = undefined
  try {
    await aplicacion.tienda.completarPrimeraVez({
      nombreTienda: nombre.value,
      tamanoDeLetra: letra.value,
    })
    // Inicio decide con el estado global: que ya sepa que la primera vez terminó.
    await estadoGlobal.recargarConfiguracion()
    irA('productos')
  } catch (error) {
    if (!esErrorDeDominio(error)) console.error('No se pudo guardar la primera vez:', error)
    errorAlGuardar.value = esErrorDeDominio(error) ? error.message : 'No se pudo guardar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="vista-primera-vez">
    <EncabezadoPagina
      v-if="numero > 1"
      :titulo="TITULOS[paso]"
      volver
      @volver="alVolver"
    />
    <EncabezadoPagina v-else :titulo="TITULOS[paso]" />

    <BarraDeProgreso :actual="numero" :total="PASOS.length" :texto="`Paso ${numero} de 5`" etiqueta="Primera vez" />

    <!-- 1. Bienvenida -->
    <template v-if="paso === 'bienvenida'">
      <div class="cuerpo">
        <span class="sello" aria-hidden="true"><Store class="sello-icono" /></span>
        <p class="destacado">
          Esta app te ayuda a llevar el stock de tu tienda, saber cuánto ganas y qué te conviene
          comprar.
        </p>
        <p>Todo queda guardado en este celular y funciona sin internet.</p>
      </div>
      <div class="acciones">
        <BotonPrincipal texto="Empezar" @click="irA('nombre')" />
      </div>
    </template>

    <!-- 2. Nombre de la tienda -->
    <form v-else-if="paso === 'nombre'" class="formulario" novalidate @submit.prevent="seguirConElNombre">
      <div class="cuerpo">
        <CampoTexto
          v-model="nombre"
          etiqueta="Nombre de la tienda"
          ayuda="Lo usamos para saludarte y en tus archivos de Excel."
          autocompletar="organization"
          :error="errorDelNombre"
        />
      </div>
      <div class="acciones">
        <BotonPrincipal texto="Seguir" tipo="submit" />
      </div>
    </form>

    <!-- 3. Tamaño de letra, con vista previa -->
    <template v-else-if="paso === 'letra'">
      <div class="cuerpo">
        <BotonesDeOpcion
          :model-value="letra"
          :opciones="OPCIONES_DE_LETRA"
          etiqueta="Elige la que leas mejor sin lentes"
          @update:model-value="elegirLetra"
        />
        <Tarjeta class="muestra">
          <p class="muestra-titulo">Así se ve la letra:</p>
          <p class="muestra-producto">Lejía 1 L</p>
          <p>{{ pegarCifras('Quedan 12 unid. · Se vende a S/ 3.50') }}</p>
        </Tarjeta>
        <MensajeDeError
          v-if="errorAlGuardar"
          :mensaje="errorAlGuardar"
          ayuda="Vuelve a intentarlo en un momento."
        />
      </div>
      <div class="acciones">
        <BotonPrincipal texto="Seguir" :deshabilitado="guardando" @click="guardarPrimeraVez" />
      </div>
    </template>

    <!-- 4. Cargar productos -->
    <template v-else-if="paso === 'productos'">
      <div class="cuerpo">
        <p>
          Si ya tienes una lista en Excel, cárgala de una vez. Si no, agrégalos uno por uno aquí
          en el celular.
        </p>
      </div>
      <div class="acciones">
        <BotonPrincipal
          texto="Uno por uno"
          :icono="Plus"
          @click="router.push(haciaPantalla(router, 'producto-nuevo'))"
        />
        <BotonPrincipal
          texto="Desde Excel"
          variante="secundario"
          :icono="FileSpreadsheet"
          @click="router.push({ name: 'importar-productos', query: { desde: 'primera-vez' } })"
        />
        <Boton texto="Lo hago después" class="despues" @click="router.push({ name: 'inicio' })" />
      </div>
    </template>

    <!-- 5. Contar lo que hay (conteo guiado, RN-OP-21) -->
    <template v-else>
      <div class="cuerpo">
        <p>
          Cuenta cuántos hay de cada producto, uno por uno. Así la app sabe tu stock real desde
          hoy.
        </p>
        <p>Puedes dejarlo para después y seguir cuando quieras.</p>
      </div>
      <div class="acciones">
        <BotonPrincipal
          texto="Contar ahora"
          :icono="ClipboardCheck"
          @click="router.push(haciaPantalla(router, 'contar-todo'))"
        />
        <BotonPrincipal
          texto="Dejar para después"
          variante="secundario"
          @click="router.push({ name: 'inicio' })"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* La acción principal queda abajo, al alcance del pulgar: el paso ocupa el alto que deja libre
   la barra de navegación (medida en vivo en --alto-pie). */
.vista-primera-vez {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  min-height: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--espacio-4));
}
.formulario {
  display: contents;
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.cuerpo p {
  margin: 0;
}
.destacado {
  font-size: 1.15rem;
  font-weight: 700;
}
.sello {
  display: grid;
  place-items: center;
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  background: var(--color-primario-suave);
  color: var(--color-primario);
}
.sello-icono {
  width: 2.75rem;
  height: 2.75rem;
}
.muestra {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}
.muestra-titulo {
  color: var(--color-texto-suave);
}
.muestra-producto {
  font-size: 1.25rem;
  font-weight: 700;
}
.acciones {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}
.despues {
  align-self: center;
}

@media (min-width: 1024px) {
  .vista-primera-vez {
    min-height: auto;
    max-width: 40rem;
  }
  .acciones {
    margin-top: var(--espacio-4);
  }
}
</style>

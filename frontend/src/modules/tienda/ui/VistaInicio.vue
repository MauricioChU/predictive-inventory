<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ChevronRight, CircleHelp, PackagePlus, Settings, ShoppingCart } from 'lucide-vue-next'
import { useEstadoGlobal } from '@/app/estado-global'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { preciosParaRevisar } from '@/modules/analisis'
import { RUTA_AGOTADOS, RUTA_QUEDA_POCO, type ResumenDeAtencion } from '@/modules/alertas'
import { HojaDeMovimientos } from '@/modules/inventario'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearDinero, plural } from '@/shared/domain/formato'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EstadoVacio from '@/shared/ui/componentes/EstadoVacio.vue'
import CarruselDeAvisos, {
  type AvisoDelCarrusel,
} from '@/shared/ui/componentes/CarruselDeAvisos.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import TarjetaDeCifra from '@/shared/ui/componentes/TarjetaDeCifra.vue'
import FechaDeHoy from './FechaDeHoy.vue'
import { haciaPantalla, type PantallaDeOtraRama } from './pantallas-de-otras-ramas'

const aplicacion = useAplicacion()
const estadoGlobal = useEstadoGlobal()
const router = useRouter()
const route = useRoute()

const nombreTienda = ref('')
const deHoy = ref<{ ganancia: Dinero; ventas: Dinero } | null>(null)
const atencion = ref<ResumenDeAtencion | null>(null)
/** Productos activos que se venden a su costo o por debajo (RN-AN-10). */
const preciosARevisar = ref(0)
/** `null` mientras se lee. */
const hayProductos = ref<boolean | null>(null)
const fallo = ref(false)
/**
 * La hoja «Movimientos» (el historial de días) vive en la dirección: `/?movimientos=7-dias`.
 * Así, volver desde el detalle de una operación reabre la hoja con su filtro. Abierta, lo de
 * atrás queda inerte.
 */
const filtroDeMovimientos = computed(() =>
  typeof route.query.movimientos === 'string' ? route.query.movimientos : null,
)
const movimientosAbiertos = computed(() => filtroDeMovimientos.value !== null)
/** El botón que la abre: a él vuelve el foco al cerrarla. */
const refMovimientos = ref<HTMLElement | null>(null)

// Al cerrarse (también si la hoja volvió a abrirse desde el detalle, sin botón que la abriera),
// el foco vuelve al botón.
watch(movimientosAbiertos, (abierta) => {
  if (!abierta) void nextTick(() => refMovimientos.value?.focus())
})

function abrirMovimientos(): void {
  void router.push({ name: 'inicio', query: { movimientos: '7-dias' } })
}
function cambiarFiltroDeMovimientos(filtro: string): void {
  void router.replace({ name: 'inicio', query: { movimientos: filtro } })
}
/** Cerrarla vuelve a Inicio a secas: con `back` si se llegó desde ahí (sin dejar historia de más). */
function cerrarMovimientos(): void {
  const atras = (window.history.state as { back?: string | null } | null)?.back
  if (atras === router.resolve({ name: 'inicio' }).fullPath) router.back()
  else void router.replace({ name: 'inicio' })
}

/** Plan 20: el nombre de la tienda en mayúsculas (el guardado no cambia); sin nombre, solo "Inicio". */
const encabezado = computed(() => nombreTienda.value.trim().toLocaleUpperCase('es') || 'Inicio')

/**
 * RN-AN-03: lo cobrado hoy ("Total vendido", la cifra principal) y debajo la ganancia real: la neta de hoy (o la
 * pérdida, dicha como tal). "Todavía no hay ventas hoy" se dice una sola vez, en el total.
 */
const cifrasDeHoy = computed(() => {
  if (!deHoy.value) return null
  const { ganancia, ventas } = deHoy.value
  const perdio = ganancia.esNegativo()
  return {
    vendido: {
      valor: formatearDinero(ventas),
      detalle: ventas.esCero() ? 'Todavía no hay ventas hoy' : undefined,
    },
    ganancia: {
      titulo: perdio ? 'Pérdida real' : 'Ganancia real',
      valor: formatearDinero(perdio ? ganancia.negar() : ganancia),
      tono: perdio ? ('peligro' as const) : ('normal' as const),
    },
  }
})

/**
 * Los avisos de Inicio, de uno en uno en un carrusel: los mismos de Atención en Control, cada uno con
 * su cantidad y su flecha a la pantalla que corresponde (RN-AL-06a). Sin ninguno, "Todo en orden".
 */
const avisos = computed<AvisoDelCarrusel[]>(() => {
  if (!atencion.value) return []
  const { agotados, porAcabarse } = atencion.value
  const lista: AvisoDelCarrusel[] = []
  if (agotados > 0)
    lista.push({
      id: 'agotados',
      tono: 'atencion',
      texto: `${agotados} ${plural(agotados, 'agotado', 'agotados')}`,
      textoAccion: `${agotados} ${plural(agotados, 'producto agotado', 'productos agotados')}. Ver productos`,
    })
  if (porAcabarse > 0)
    lista.push({
      id: 'queda-poco',
      tono: 'atencion',
      texto: `Queda poco: ${porAcabarse}`,
      textoAccion: `Queda poco de ${porAcabarse} ${plural(porAcabarse, 'producto', 'productos')}. Ver productos`,
    })
  if (preciosARevisar.value > 0)
    lista.push({
      id: 'precios',
      tono: 'atencion',
      texto: `${preciosARevisar.value} ${plural(preciosARevisar.value, 'precio para revisar', 'precios para revisar')}`,
      textoAccion: `${preciosARevisar.value} ${plural(preciosARevisar.value, 'precio para revisar', 'precios para revisar')}. Ver ayuda inteligente`,
    })
  return lista.length > 0
    ? lista
    : [{ id: 'todo-en-orden', tono: 'exito', texto: atencion.value.texto }]
})

function alTocarAviso(id: string): void {
  if (id === 'agotados') void router.push(RUTA_AGOTADOS)
  else if (id === 'queda-poco') void router.push(RUTA_QUEDA_POCO)
  else if (id === 'precios') void router.push({ name: 'ayuda-inteligente' })
}

async function cargarAtencion(): Promise<void> {
  const [resumen, productos] = await Promise.all([
    aplicacion.alertas.resumenDeAtencion(),
    aplicacion.catalogo.consultable.productos({ soloActivos: true }),
  ])
  atencion.value = resumen
  preciosARevisar.value = preciosParaRevisar(productos).length
}

async function cargar(): Promise<void> {
  try {
    const [configuracion, resumen, productos] = await Promise.all([
      aplicacion.tienda.obtenerConfiguracion(),
      aplicacion.analisis.consultarResumen('HOY'),
      aplicacion.catalogo.consultable.productos({ soloActivos: true }),
      cargarAtencion(),
    ])
    nombreTienda.value = configuracion.nombreTienda
    deHoy.value = { ganancia: resumen.gananciaNeta, ventas: resumen.ventas }
    hayProductos.value = productos.length > 0
  } catch (error) {
    console.error('No se pudo preparar Inicio:', error)
    fallo.value = true
  }
}

onMounted(() => {
  void cargar()
})

// El contador del botón Control cambia con los eventos: el aviso de Inicio lo sigue.
watch(
  () => estadoGlobal.contadorDeAtencion,
  () => {
    void cargarAtencion().catch((error: unknown) => {
      console.error('No se pudo actualizar el aviso de Inicio:', error)
    })
  },
)

function ir(nombre: PantallaDeOtraRama): void {
  void router.push(haciaPantalla(router, nombre))
}
</script>

<template>
  <div class="vista-inicio">
    <header class="saludo" :inert="movimientosAbiertos ? true : undefined">
      <div class="titulares">
        <h1>{{ encabezado }}</h1>
        <FechaDeHoy />
      </div>
      <!-- Excepción deliberada a RN-UX-04: solo la tuerca, con nombre accesible y zona de 48 px. -->
      <RouterLink :to="{ name: 'ajustes' }" class="enlace-ajustes" aria-label="Ajustes">
        <Settings aria-hidden="true" class="icono" />
      </RouterLink>
    </header>

    <MensajeDeError
      v-if="fallo"
      mensaje="No pudimos leer tus datos de hoy"
      ayuda="Cierra la app y vuelve a abrirla. Tus datos siguen guardados."
    />

    <!--
      Inicio es para vender (plan 19). Celular: encabezado → fecha → lo de hoy (las cifras crecen
      para llenar el alto libre) → los avisos → las acciones, todo pegado abajo, al alcance del
      pulgar (si el contenido es más alto que la pantalla, todo fluye sin taparse). Los avisos van
      justo encima de los botones, como parte de esa zona. PC: las cifras a la izquierda y, a la
      derecha, los avisos y las acciones.
    -->
    <div class="cuerpo" :inert="movimientosAbiertos ? true : undefined">
      <div v-if="cifrasDeHoy" class="cifra cifras-de-hoy">
        <!-- La cifra principal: lo cobrado hoy, grande; la ganancia real, más chica debajo. -->
        <TarjetaDeCifra
          blanca
          principal
          titulo="Total vendido"
          :texto-valor="cifrasDeHoy.vendido.valor"
          :texto-detalle="cifrasDeHoy.vendido.detalle"
        />
        <TarjetaDeCifra
          blanca
          compacta
          en-linea
          :titulo="cifrasDeHoy.ganancia.titulo"
          :texto-valor="cifrasDeHoy.ganancia.valor"
          :tono="cifrasDeHoy.ganancia.tono"
        />
      </div>

      <div class="acciones">
        <div v-if="atencion" class="atencion">
          <EstadoVacio
            v-if="hayProductos === false"
            titulo="Aún no tienes productos"
            descripcion="Agrégalos para llevar tu stock y saber qué comprar."
            accion="Agregar el primero"
            @accion="ir('producto-nuevo')"
          />
          <!-- Un aviso a la vez, en un espacio reservado, con ‹ › si hay varios. -->
          <CarruselDeAvisos
            v-else
            franja
            :avisos="avisos"
            etiqueta="Avisos"
            @accion="alTocarAviso"
          />
        </div>

        <div class="vender-fijo">
          <BotonPrincipal pastilla texto="Vender" :icono="ShoppingCart" @click="ir('vender')" />
        </div>
        <div class="par-de-botones">
          <button type="button" class="boton-par" @click="ir('recibir')">
            <PackagePlus aria-hidden="true" class="icono" />
            <span>Llegó mercadería</span>
          </button>
          <button type="button" class="boton-par" @click="ir('necesito-comprar')">
            <CircleHelp aria-hidden="true" class="icono" />
            <span>¿Necesito comprar?</span>
          </button>
        </div>
        <button
          ref="refMovimientos"
          type="button"
          class="enlace-movimientos"
          @click="abrirMovimientos"
        >
          <span>Movimientos</span>
          <ChevronRight aria-hidden="true" class="icono" />
        </button>
      </div>
    </div>

    <HojaDeMovimientos
      v-if="movimientosAbiertos"
      :filtro="filtroDeMovimientos ?? '7-dias'"
      :volver-a="refMovimientos"
      @update:filtro="cambiarFiltroDeMovimientos"
      @cerrar="cerrarMovimientos"
    />
  </div>
</template>

<style scoped>
.vista-inicio {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
  /* Ocupa el alto que deja libre la navegación (medida en vivo en --alto-pie). */
  min-height: calc(100dvh - var(--alto-pie, 0px) - 2 * var(--relleno-bloque, var(--espacio-4)));
}
.saludo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--espacio-2) var(--espacio-4);
  padding-block: 0;
}
.titulares {
  min-inline-size: 0;
}
h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: break-word;
}
.enlace-ajustes {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-width: var(--alto-toque);
  min-height: var(--alto-toque);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio-chico);
  background: var(--color-fondo);
  color: var(--color-primario);
  text-decoration: none;
}
/* Propuesta Inicio: «Movimientos ›», fila a todo el ancho con fondo muy suave y texto centrado. */
.enlace-movimientos {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-1);
  inline-size: 100%;
  min-height: var(--alto-toque);
  border: none;
  border-radius: var(--radio);
  background: var(--color-superficie);
  color: var(--color-texto);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}
/* Propuesta Inicio: dos botones secundarios lado a lado, ícono y texto (hasta 2 líneas). */
.par-de-botones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--espacio-2);
}
.boton-par {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: var(--espacio-1);
  min-height: var(--alto-boton-principal);
  padding: var(--espacio-2);
  border: 2px solid var(--color-primario);
  border-radius: var(--radio);
  background: var(--color-primario-suave);
  color: var(--color-primario);
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: start;
  cursor: pointer;
}
.icono {
  width: 1.25em;
  height: 1.25em;
  flex: none;
}

.cuerpo {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--espacio-3);
}
/* Celular: sin caja propia, así "Vender" se pega abajo dentro de todo el cuerpo de Inicio (un
   elemento pegajoso no sale de la caja de su padre). */
.acciones {
  display: contents;
}
/* Las dos cifras de hoy, apiladas. Crecen para llenar el alto que queda libre (sin huecos en
   blanco): la principal se lleva más; el contenido de cada una va arriba (centrado en una caja
   alta se veía flotando en un bloque vacío). */
.cifra {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--espacio-1);
}
.cifra :deep(.tarjeta-de-cifra) {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.cifra :deep(.tarjeta-de-cifra--principal) {
  flex: 2;
}
.cifra :deep(.tarjeta-de-cifra--compacta) {
  flex: 1;
}
/* «Total vendido»: la etiqueta arriba a la izquierda y el MONTO centrado en el alto libre de la
   tarjeta, mucho más grande y escalando con ella (el monto entero nunca se parte ni se sale: el
   tope por ancho es el mismo cálculo que TarjetaDeCifra, ~0.62 em por carácter). */
.cifra :deep(.tarjeta-de-cifra--principal .cifra) {
  display: flex;
  flex: 1;
  flex-direction: column;
}
.cifra :deep(.tarjeta-de-cifra--principal .valor) {
  margin-block: auto;
  line-height: 1;
  white-space: nowrap;
  font-size: max(1.25rem, min(4.5rem, calc(100cqi / (max(var(--caracteres), 1) * 0.7))));
}
/* «Ganancia real»: etiqueta a la izquierda y monto a la derecha, ambos centrados en su tarjeta,
   con el monto más grande y en la misma línea base. */
.cifra :deep(.tarjeta-de-cifra--compacta) {
  justify-content: center;
}
.cifra :deep(.tarjeta-de-cifra--compacta .valor) {
  font-size: clamp(1.5rem, 9cqi, 2rem);
  white-space: nowrap;
}
/* PC, en el mismo orden que el código (WCAG 1.3.2 / 2.4.3): las cifras a la izquierda y, a la
   derecha, los avisos y las acciones. Sin filas vacías: la separación es el margen de cada
   bloque, no el espacio entre filas. */
@media (min-width: 1024px) {
  .vista-inicio {
    min-height: auto;
  }
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    grid-template-areas: 'cifra acciones';
    align-items: start;
    gap: 0 var(--espacio-6);
  }
  .cifra {
    grid-area: cifra;
    flex: none;
  }
  .cifra :deep(.tarjeta-de-cifra--principal),
  .cifra :deep(.tarjeta-de-cifra--compacta) {
    flex: none;
  }
  .acciones {
    grid-area: acciones;
    display: flex;
    flex-direction: column;
    gap: var(--espacio-3);
  }
  .cifra,
  .acciones {
    margin-bottom: var(--espacio-4);
  }
}
</style>

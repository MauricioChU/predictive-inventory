<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  CalendarCheck,
  CalendarRange,
  ChevronRight,
  KeyRound,
  Lightbulb,
  Trophy,
  Wallet,
} from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { formatearCantidad, formatearDinero, plural } from '@/shared/domain/formato'
import Boton from '@/shared/ui/componentes/Boton.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import GraficoBarras from '@/shared/ui/componentes/GraficoBarras.vue'
import GraficoColumnas from '@/shared/ui/componentes/GraficoColumnas.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import SelectorSegmentado from '@/shared/ui/componentes/SelectorSegmentado.vue'
import TarjetaDeCifra from '@/shared/ui/componentes/TarjetaDeCifra.vue'
import BarraDeProgreso from '@/shared/ui/componentes/BarraDeProgreso.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import type { TorreDeControl } from '../application/torre'
import { BOTON_CONFIGURAR_ALQUILER, PREGUNTA_DEL_ALQUILER } from '../domain/alquiler'
import type { Periodo } from '../domain/periodos'
import SeccionDeControl from './componentes/SeccionDeControl.vue'
import {
  OPCIONES_DE_MAS_VENDIDOS,
  OPCIONES_DE_PERIODO,
  OPCIONES_DE_TOP,
  partesDelCambio,
  textoDeDia,
  textoMejorDia,
  textoSinVentas,
  textoVeces,
  type PeriodoDeMasVendidos,
  type TipoDeTop,
} from './textos'

const aplicacion = useAplicacion()
const router = useRouter()

const periodo = ref<Periodo>('HOY')
const periodoMasVendidos = ref<PeriodoDeMasVendidos>(7)
/** Cuál de los dos top 5 se ve: lo que más se vende o lo que más ganancia deja. */
const tipoDeTop = ref<TipoDeTop>('VECES')
/** Cuál de los dos gráficos de «Semana contra semana» se ve: ventas o ganancia. */
const metricaDeSemana = ref<'Ventas' | 'Ganancia neta'>('Ventas')
const OPCIONES_DE_SEMANA = [
  { valor: 'Ventas', etiqueta: 'Ventas' },
  { valor: 'Ganancia neta', etiqueta: 'Ganancia' },
] as const

/** Lo que se ve: la torre con los periodos con los que se calculó (no los recién elegidos). */
interface Mostrado {
  torre: TorreDeControl
  /** RN-AL-10: la frase del pago del local si cae hoy, mañana o pasado mañana. */
  recordatorioDelLocal: string | null
  periodo: Periodo
  periodoMasVendidos: PeriodoDeMasVendidos
}
const mostrado = shallowRef<Mostrado | null>(null)
const actualizando = ref(false)
const fallo = ref(false)

let ultimoPedido = 0

/** RN-AN-15: todo se calcula en el celular, con una sola lectura (RN-SIS-09). Si se cambia de
 * periodo dos veces seguidas, solo cuenta la última respuesta. */
async function cargar(): Promise<void> {
  const pedido = ++ultimoPedido
  const opciones = { periodo: periodo.value, periodoMasVendidos: periodoMasVendidos.value }
  actualizando.value = true
  try {
    const [torre, recordatorio] = await Promise.all([
      aplicacion.analisis.consultarTorre(opciones),
      aplicacion.alertas.recordatorioDelLocal(),
    ])
    if (pedido !== ultimoPedido) return
    mostrado.value = { torre, recordatorioDelLocal: recordatorio?.texto ?? null, ...opciones }
    fallo.value = false
  } catch (error) {
    if (pedido !== ultimoPedido) return
    console.error('No se pudo calcular la Torre de control:', error)
    fallo.value = true
  } finally {
    if (pedido === ultimoPedido) actualizando.value = false
  }
}

onMounted(cargar)
watch([periodo, periodoMasVendidos], cargar)

const resumen = computed(() => {
  if (!mostrado.value) return null
  const { torre, periodo: elegido } = mostrado.value
  const r = torre.resumen
  const perdio = r.gananciaNeta.esNegativo()
  return {
    // Mismo patrón que Inicio (RN-AN-03): lo cobrado, grande; la ganancia real, debajo.
    vendido: {
      valor: formatearDinero(r.ventas),
      detalle: r.ventas.esCero() ? textoSinVentas(elegido) : undefined,
    },
    mostrarGanancia: !(r.ventas.esCero() && r.gananciaNeta.esCero()),
    ganancia: {
      titulo: perdio ? 'Pérdida real' : 'Ganancia real',
      valor: formatearDinero(perdio ? r.gananciaNeta.negar() : r.gananciaNeta),
      tono: perdio
        ? ('peligro' as const)
        : r.gananciaNeta.esPositivo()
          ? ('exito' as const)
          : ('normal' as const),
    },
    filas: [
      { etiqueta: 'Costo de lo vendido', valor: formatearDinero(r.costoVendido) },
      { etiqueta: 'Pérdidas', valor: formatearDinero(r.mermas) },
    ],
    diferencias: formatearDinero(r.diferenciasDeConteo),
  }
})

/** RN-AN-19: "No pago" no muestra la tarjeta; sin configurar pregunta; con pago, el avance. */
const alquiler = computed(() => {
  const a = mostrado.value?.torre.alquiler
  if (!a || a.estado === 'NO_PAGA') return null
  if (a.estado === 'SIN_CONFIGURAR')
    return { configurado: false, lineas: [], porcentaje: 0 } as const
  return {
    configurado: true,
    recordatorio: mostrado.value?.recordatorioDelLocal
      ? pegarCifras(mostrado.value.recordatorioDelLocal)
      : null,
    lineas: a.textos.map(pegarCifras),
    porcentaje: a.avance.porcentaje,
  } as const
})

const masVendidos = computed(() => {
  if (!mostrado.value) return null
  const { porVeces, porGanancia } = mostrado.value.torre.masVendidos
  return {
    vacio: textoSinVentas(mostrado.value.periodoMasVendidos === 7 ? '7_DIAS' : '30_DIAS'),
    porVeces: porVeces.map((f) => ({
      id: f.productoId,
      nombre: f.nombre,
      detalle: `${textoVeces(f.veces)} · ${formatearCantidad(f.cantidad, f.unidad)}`,
    })),
    porGanancia: porGanancia.map((f) => ({
      id: f.productoId,
      nombre: f.nombre,
      detalle: `${formatearDinero(f.ganancia)} de ganancia · ${formatearCantidad(f.cantidad, f.unidad)}`,
    })),
  }
})

const semana = computed(() => {
  const s = mostrado.value?.torre.semana
  if (!s) return null
  if (s.tipo === 'sin-datos') return { mensaje: s.mensaje, filas: [] }
  return {
    mensaje: null,
    filas: s.filas.map((f) => ({
      concepto: f.concepto,
      cambio: partesDelCambio(f.cambio),
      // El gráfico: esta semana (destacada) contra la anterior, con la misma escala.
      barras: [
        {
          etiqueta: 'Esta semana',
          valor: f.actual.centimos,
          textoValor: formatearDinero(f.actual),
          destacada: true,
        },
        {
          etiqueta: 'Semana anterior',
          valor: f.anterior.centimos,
          textoValor: formatearDinero(f.anterior),
        },
      ],
    })),
  }
})

const mejorDia = computed(() => {
  const m = mostrado.value?.torre.mejorDia
  if (!m) return null
  if (m.tipo === 'insuficiente') return { mensaje: m.mensaje, frase: null, barras: [] }
  return {
    mensaje: null,
    frase: textoMejorDia(m.mejor),
    barras: m.promedios.map((p) => ({
      etiqueta: textoDeDia(p.dia),
      valor: p.promedio.centimos,
      textoValor: formatearDinero(p.promedio),
      destacada: p.dia === m.mejor,
    })),
  }
})

/**
 * Cuántas cosas hay que mirar en Ayuda inteligente (lo que ve el botón del final): productos
 * ÚNICOS. Un producto agotado y además parado (o con el precio por revisar) cuenta una sola vez.
 */
const cosasParaMirar = computed(() => {
  if (!mostrado.value) return 0
  const { productosEnAtencion: a, parados, preciosParaRevisar } = mostrado.value.torre
  return new Set([
    ...a.agotados.map((p) => p.productoId),
    ...a.porAcabarse.map((p) => p.productoId),
    ...preciosParaRevisar.map((p) => p.productoId),
    ...parados.productos.map((p) => p.productoId),
  ]).size
})

function irA(nombre: 'alquiler-del-local'): void {
  void router.push({ name: nombre })
}
</script>

<template>
  <div class="vista-control">
    <EncabezadoPagina titulo="Control" />

    <MensajeDeError
      v-if="fallo && !mostrado"
      mensaje="No pudimos calcular el control"
      ayuda="Vuelve a abrir esta pantalla en un momento."
    />
    <p v-else-if="!mostrado" class="calculando">Calculando…</p>

    <!-- 04-torre-de-control: las secciones en su orden. Desde 768 px, dos columnas
         (06-experiencia-de-uso): la primera con lo de hoy y lo que hay que hacer (1–4), la
         segunda con cómo va el negocio (5–7). Cada columna es un bloque: abrir una lista no
         mueve tarjetas de una columna a la otra, y el orden de lectura sigue siendo el de la spec. -->
    <div
      v-else
      class="tablero"
      :class="{ 'tablero--actualizando': actualizando }"
      :aria-busy="actualizando ? 'true' : 'false'"
    >
      <div class="columna">
        <SeccionDeControl titulo="Resumen" :icono="Wallet">
          <SelectorSegmentado
            v-model="periodo"
            :opciones="OPCIONES_DE_PERIODO"
            etiqueta="Periodo del resumen"
            etiqueta-oculta
          />
          <template v-if="resumen">
            <div class="cifras-principales">
              <TarjetaDeCifra
                principal
                titulo="Total vendido"
                :texto-valor="resumen.vendido.valor"
                :texto-detalle="resumen.vendido.detalle"
              />
              <TarjetaDeCifra
                v-if="resumen.mostrarGanancia"
                compacta
                en-linea
                :titulo="resumen.ganancia.titulo"
                :texto-valor="resumen.ganancia.valor"
                :tono="resumen.ganancia.tono"
              />
            </div>
            <div class="cifras">
              <FilaDeDato
                v-for="fila in resumen.filas"
                :key="fila.etiqueta"
                :etiqueta="fila.etiqueta"
                :texto-valor="fila.valor"
              />
            </div>
            <div class="aparte">
              <FilaDeDato etiqueta="Diferencias de conteo" :texto-valor="resumen.diferencias" />
              <p class="nota">No cambia la ganancia: es lo que faltó o sobró al contar.</p>
            </div>
          </template>
        </SeccionDeControl>

        <SeccionDeControl v-if="alquiler" titulo="Alquiler del local" :icono="KeyRound">
          <template v-if="alquiler.configurado">
            <p v-if="alquiler.recordatorio" class="recordatorio" data-recordatorio-del-local>
              {{ alquiler.recordatorio }}
            </p>
            <p class="linea">{{ alquiler.lineas[0] }}</p>
            <BarraDeProgreso
              :actual="alquiler.porcentaje"
              :total="100"
              :texto="`${alquiler.porcentaje} %`"
              etiqueta="Avance del alquiler del local"
            />
            <p class="linea">{{ alquiler.lineas[1] }}</p>
            <RouterLink :to="{ name: 'alquiler-del-local' }" class="cambiar">
              <span>Cambiar</span>
              <ChevronRight aria-hidden="true" class="flecha" />
            </RouterLink>
          </template>
          <template v-else>
            <p class="pregunta">{{ PREGUNTA_DEL_ALQUILER }}</p>
            <Boton
              :texto="BOTON_CONFIGURAR_ALQUILER"
              :icono="KeyRound"
              @click="irA('alquiler-del-local')"
            />
          </template>
        </SeccionDeControl>

        <SeccionDeControl titulo="Tus mejores productos" :icono="Trophy">
          <SelectorSegmentado
            v-model="tipoDeTop"
            :opciones="OPCIONES_DE_TOP"
            etiqueta="Qué ver"
            etiqueta-oculta
          />
          <SelectorSegmentado
            v-model="periodoMasVendidos"
            :opciones="OPCIONES_DE_MAS_VENDIDOS"
            etiqueta="Periodo de los mejores productos"
            etiqueta-oculta
          />
          <template v-if="masVendidos">
            <p v-if="masVendidos.porVeces.length === 0" class="vacio">{{ masVendidos.vacio }}</p>
            <template v-else>
              <h3>
                {{ tipoDeTop === 'VECES' ? 'Los que más se venden' : 'Los que más ganancia dejan' }}
              </h3>
              <ol class="ranking">
                <li
                  v-for="f in tipoDeTop === 'VECES'
                    ? masVendidos.porVeces
                    : masVendidos.porGanancia"
                  :key="f.id"
                >
                  <span class="nombre">{{ pegarCifras(f.nombre) }}</span>
                  <span class="detalle">{{ pegarCifras(f.detalle) }}</span>
                </li>
              </ol>
            </template>
          </template>
        </SeccionDeControl>
      </div>

      <div class="columna">
        <SeccionDeControl titulo="Semana contra semana" :icono="CalendarRange">
          <template v-if="semana">
            <div v-if="semana.mensaje" class="vacio">
              <p>{{ semana.mensaje }}</p>
              <p class="nota">
                Cuando tengas dos semanas de ventas, aquí verás si vendes más o menos.
              </p>
            </div>
            <template v-else>
              <SelectorSegmentado
                v-model="metricaDeSemana"
                :opciones="OPCIONES_DE_SEMANA"
                etiqueta="Qué comparar"
                etiqueta-oculta
              />
              <div
                v-for="fila in semana.filas.filter((f) => f.concepto === metricaDeSemana)"
                :key="fila.concepto"
                class="comparacion"
              >
                <h3>{{ fila.concepto }}</h3>
                <p class="cambio" :class="`cambio--${fila.cambio.tono}`">
                  <span class="flecha" aria-hidden="true">{{ fila.cambio.flecha }}</span>
                  {{ ' ' }}<span>{{ fila.cambio.texto }}</span>
                </p>
                <GraficoBarras titulo="Esta semana y la anterior" :barras="fila.barras" />
              </div>
              <p class="nota">Los últimos 7 días completos (sin hoy) contra los 7 anteriores.</p>
            </template>
          </template>
        </SeccionDeControl>

        <SeccionDeControl titulo="Mejor día de la semana" :icono="CalendarCheck">
          <template v-if="mejorDia">
            <p v-if="mejorDia.mensaje" class="vacio">{{ mejorDia.mensaje }}</p>
            <template v-else>
              <p class="frase">{{ mejorDia.frase }}</p>
              <GraficoColumnas
                titulo="Venta promedio por día"
                descripcion="Venta promedio por día. Se desplaza de lado para ver todos los días"
                :columnas="mejorDia.barras"
              />
              <p class="nota">Promedio por día de la semana, sin contar hoy.</p>
            </template>
          </template>
        </SeccionDeControl>
      </div>
    </div>

    <!-- Lo que el sistema avisa y sugiere (Atención, Para comprar, Productos parados) vive aparte:
         Control es para medir. -->
    <RouterLink v-if="mostrado" :to="{ name: 'ayuda-inteligente' }" class="ayuda">
      <Lightbulb aria-hidden="true" class="ayuda-icono" />
      <span class="ayuda-texto">
        <span class="ayuda-titulo">Ayuda inteligente</span>
        <span v-if="cosasParaMirar > 0" class="ayuda-detalle">
          {{ cosasParaMirar }} {{ plural(cosasParaMirar, 'cosa para mirar', 'cosas para mirar') }}
        </span>
      </span>
      <ChevronRight aria-hidden="true" class="ayuda-flecha" />
    </RouterLink>
  </div>
</template>

<style scoped>
.calculando {
  color: var(--color-texto-suave);
}
.tablero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--espacio-4);
  transition: opacity 150ms ease-out;
}
/* Al cambiar de periodo se deja lo anterior a la vista (sin parpadeo) hasta que llega lo nuevo. */
.tablero--actualizando {
  opacity: 0.6;
}
.columna {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  min-inline-size: 0;
}
@media (min-width: 768px) {
  .tablero {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.aparte {
  padding-top: var(--espacio-2);
  border-top: 2px dashed color-mix(in srgb, var(--color-borde) 45%, transparent);
}
.nota {
  margin: var(--espacio-1) 0 0;
  color: var(--color-texto-suave);
  font-size: 0.95rem;
}
.vacio {
  margin: 0;
  color: var(--color-texto);
  font-weight: 700;
}
.vacio p {
  margin: 0;
}
.vacio .nota {
  font-weight: 400;
}
.cifras-principales {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}

/* Tarjeta Alquiler del local (RN-AN-19). */
.recordatorio {
  margin: 0;
  padding: var(--espacio-2) var(--espacio-3);
  border-left: 6px solid var(--color-primario);
  border-radius: var(--radio-chico);
  background: var(--color-primario-suave);
  font-weight: 700;
  overflow-wrap: break-word;
}
.linea,
.pregunta {
  margin: 0;
  font-weight: 700;
  overflow-wrap: break-word;
}
.cambiar {
  display: inline-flex;
  align-items: center;
  align-self: flex-end;
  gap: var(--espacio-1);
  min-block-size: var(--alto-toque);
  padding-inline: var(--espacio-2);
  color: var(--color-primario);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.flecha {
  inline-size: 1.25em;
  block-size: 1.25em;
  flex: none;
}

h3 {
  margin: var(--espacio-2) 0 0;
  font-size: 1.05rem;
}

.nombre {
  font-weight: 700;
}
.detalle {
  color: var(--color-texto-suave);
}

/* Puestos 1, 2, 3… en un círculo; el número lo da la lista ordenada (el lector dice "1 de 3"). */
.ranking {
  counter-reset: puesto;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}
.ranking li {
  counter-increment: puesto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: var(--espacio-3);
  align-items: baseline;
}
.ranking li::before {
  content: counter(puesto);
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  inline-size: 1.8em;
  block-size: 1.8em;
  border-radius: 999px;
  background: var(--color-primario-suave);
  color: var(--color-primario);
  font-weight: 700;
}
.ranking .nombre,
.ranking .detalle {
  grid-column: 2;
}

.comparacion {
  padding-bottom: var(--espacio-2);
}
.cambio {
  margin: var(--espacio-1) 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-texto);
}
.flecha {
  display: inline-block;
}
.cambio--sube .flecha {
  color: var(--color-exito);
}
.cambio--baja .flecha {
  color: var(--color-peligro);
}

.frase {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

/* Botón del final: lleva a la subvista de ayudas del sistema. */
.ayuda {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  margin-top: var(--espacio-4);
  min-block-size: var(--alto-boton-principal);
  padding: var(--espacio-2) var(--espacio-3);
  border: 2px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-fondo);
  color: var(--color-primario);
  font-size: 1.125rem;
  font-weight: 700;
  text-decoration: none;
}
.ayuda-icono,
.ayuda-flecha {
  inline-size: 1.4em;
  block-size: 1.4em;
  flex: none;
}
.ayuda-texto {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}
.ayuda-titulo {
  font-size: 1rem;
  line-height: 1.25;
}
.ayuda-detalle {
  color: var(--color-texto-suave);
  font-size: 0.95rem;
  font-weight: 400;
}
/* Celular angosto: sin la flecha, el nombre cabe entero aun con letra Muy grande. */
@media (max-width: 479px) {
  .ayuda-flecha {
    display: none;
  }
}
</style>

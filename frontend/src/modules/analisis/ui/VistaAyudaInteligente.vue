<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { CircleHelp, CircleX, Hourglass, ShoppingBasket, Tag, TriangleAlert } from 'lucide-vue-next'
import { useAplicacion } from '@/app/proveer-aplicacion'
import {
  formatearCantidad,
  formatearDinero,
  formatearEntero,
  plural,
} from '@/shared/domain/formato'
import AvisoEnPagina from '@/shared/ui/componentes/AvisoEnPagina.vue'
import Boton from '@/shared/ui/componentes/Boton.vue'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import FilaDeDato from '@/shared/ui/componentes/FilaDeDato.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import { pegarCifras } from '@/shared/ui/texto-sin-cortes'
import type { TorreDeControl } from '../application/torre'
import { SUGERENCIA_PARA_PARADOS } from '../domain/observaciones'
import EnlaceAProducto from './componentes/EnlaceAProducto.vue'
import FilaDeAtencion from './componentes/FilaDeAtencion.vue'
import SeccionDeControl from './componentes/SeccionDeControl.vue'
import { textoPerdidaPorUnidad, textoSinVender } from './textos'

/** Cuántas líneas de la lista para comprar se adelantan en la tarjeta (el resto, "y N más"). */
const LINEAS_EN_EL_RESUMEN = 3

const aplicacion = useAplicacion()
const router = useRouter()

const torre = shallowRef<TorreDeControl | null>(null)
const fallo = ref(false)

onMounted(async () => {
  try {
    torre.value = await aplicacion.analisis.consultarTorre()
  } catch (error) {
    console.error('No se pudo calcular la Ayuda inteligente:', error)
    fallo.value = true
  }
})

const paraComprar = computed(() => {
  if (!torre.value) return null
  const { lineas, total } = torre.value.paraComprar
  return {
    cuantos: `${formatearEntero(lineas.length)} ${plural(lineas.length, 'producto', 'productos')}`,
    primeras: lineas.slice(0, LINEAS_EN_EL_RESUMEN).map((l) => ({
      id: l.productoId,
      nombre: l.nombre,
      cantidad: formatearCantidad(l.cantidad, l.unidad),
    })),
    mas: Math.max(0, lineas.length - LINEAS_EN_EL_RESUMEN),
    total: formatearDinero(total),
  }
})

const parados = computed(() => {
  if (!torre.value) return null
  const { productos, total } = torre.value.parados
  return {
    productos: productos.map((p) => ({
      id: p.productoId,
      nombre: p.nombre,
      dinero: formatearDinero(p.dineroInmovilizado),
      detalle: `${textoSinVender(p.diasSinVender)} · tienes ${formatearCantidad(p.stock, p.unidad)}`,
    })),
    total: formatearDinero(total),
  }
})

const atencion = computed(() => {
  if (!torre.value) return null
  const { atencion: cuantos, productosEnAtencion, preciosParaRevisar } = torre.value
  return {
    agotados: { cantidad: cuantos.agotados, productos: productosEnAtencion.agotados },
    porAcabarse: {
      cantidad: cuantos.porAcabarse,
      productos: productosEnAtencion.porAcabarse.map((p) => ({
        ...p,
        detalle: [`Quedan ${formatearCantidad(p.stock, p.unidad)}`, p.cobertura]
          .filter(Boolean)
          .join(' · '),
      })),
    },
    precios: {
      cantidad: cuantos.preciosParaRevisar,
      productos: preciosParaRevisar.map((p) => ({
        ...p,
        detalle: textoPerdidaPorUnidad(p.perdidaPorUnidad, p.unidad),
      })),
    },
  }
})

function irA(nombre: 'para-comprar' | 'necesito-comprar'): void {
  void router.push({ name: nombre })
}
</script>

<template>
  <div class="vista-ayuda">
    <EncabezadoPagina titulo="Ayuda inteligente" volver />

    <MensajeDeError
      v-if="fallo && !torre"
      mensaje="No pudimos calcular la ayuda"
      ayuda="Vuelve a abrir esta pantalla en un momento."
    />
    <p v-else-if="!torre" class="calculando">Calculando…</p>

    <div v-else class="tablero">
      <SeccionDeControl titulo="Atención" :icono="TriangleAlert">
        <template v-if="atencion">
          <FilaDeAtencion
            etiqueta="Agotados"
            :cantidad="atencion.agotados.cantidad"
            :icono="CircleX"
            tono="peligro"
          >
            <ul class="productos" role="list">
              <li v-for="p in atencion.agotados.productos" :key="p.productoId">
                <EnlaceAProducto :producto-id="p.productoId">
                  <span class="nombre">{{ pegarCifras(p.nombre) }}</span>
                  <span class="detalle">Agotado</span>
                </EnlaceAProducto>
              </li>
            </ul>
          </FilaDeAtencion>
          <FilaDeAtencion
            etiqueta="Queda poco"
            :cantidad="atencion.porAcabarse.cantidad"
            :icono="TriangleAlert"
            tono="atencion"
          >
            <ul class="productos" role="list">
              <li v-for="p in atencion.porAcabarse.productos" :key="p.productoId">
                <EnlaceAProducto :producto-id="p.productoId">
                  <span class="nombre">{{ pegarCifras(p.nombre) }}</span>
                  <span class="detalle">{{ pegarCifras(p.detalle) }}</span>
                </EnlaceAProducto>
              </li>
            </ul>
          </FilaDeAtencion>
          <FilaDeAtencion
            etiqueta="Precios para revisar"
            :cantidad="atencion.precios.cantidad"
            :icono="Tag"
            tono="atencion"
          >
            <ul class="productos" role="list">
              <li v-for="p in atencion.precios.productos" :key="p.productoId">
                <EnlaceAProducto :producto-id="p.productoId">
                  <span class="nombre">{{ pegarCifras(p.nombre) }}</span>
                  <span class="detalle">{{ pegarCifras(p.detalle) }}</span>
                </EnlaceAProducto>
              </li>
            </ul>
          </FilaDeAtencion>
        </template>
      </SeccionDeControl>

      <SeccionDeControl titulo="Para comprar" :icono="ShoppingBasket">
        <template v-if="paraComprar && paraComprar.primeras.length > 0">
          <p class="cuantos">{{ paraComprar.cuantos }}</p>
          <div>
            <FilaDeDato
              v-for="linea in paraComprar.primeras"
              :key="linea.id"
              :etiqueta="linea.nombre"
              :texto-valor="linea.cantidad"
            />
            <p v-if="paraComprar.mas > 0" class="mas">
              y {{ formatearEntero(paraComprar.mas) }} más
            </p>
            <FilaDeDato etiqueta="Total estimado" :texto-valor="paraComprar.total" destacado />
          </div>
          <BotonPrincipal
            texto="Ver la lista para comprar"
            :icono="ShoppingBasket"
            @click="irA('para-comprar')"
          />
        </template>
        <p v-else class="vacio">No hace falta comprar nada por ahora</p>
        <Boton texto="¿Necesito comprar?" :icono="CircleHelp" @click="irA('necesito-comprar')" />
      </SeccionDeControl>

      <SeccionDeControl titulo="Productos parados" :icono="Hourglass">
        <template v-if="parados">
          <div v-if="parados.productos.length === 0" class="vacio">
            <p>Ningún producto está parado</p>
            <p class="nota">Aquí verás lo que no se vende hace 30 días o más.</p>
          </div>
          <template v-else>
            <ul class="parados" role="list">
              <li v-for="p in parados.productos" :key="p.id">
                <FilaDeDato :etiqueta="p.nombre" :texto-valor="p.dinero" />
                <p class="detalle">{{ pegarCifras(p.detalle) }}</p>
              </li>
            </ul>
            <FilaDeDato
              class="total"
              etiqueta="Total de dinero parado"
              :texto-valor="parados.total"
              destacado
            />
            <AvisoEnPagina tono="info" :titulo="SUGERENCIA_PARA_PARADOS" />
          </template>
        </template>
      </SeccionDeControl>
    </div>
  </div>
</template>

<style scoped>
.calculando {
  color: var(--color-texto-suave);
}
.tablero {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
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
.cuantos {
  margin: 0;
  font-weight: 700;
}
.mas {
  margin: var(--espacio-1) 0;
  color: var(--color-texto-suave);
}
.productos,
.parados {
  margin: 0;
  padding: 0;
  list-style: none;
}
.productos li + li,
.parados li + li {
  border-top: 1px solid color-mix(in srgb, var(--color-borde) 30%, transparent);
}
.nombre {
  font-weight: 700;
}
.detalle {
  color: var(--color-texto-suave);
}
.parados .detalle {
  margin: 0 0 var(--espacio-2);
}
</style>

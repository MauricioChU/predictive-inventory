<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAplicacion } from '@/app/proveer-aplicacion'
import { RANGOS_DE_CONFIGURACION } from '@/shared/contratos/configuracion'
import { esErrorDeDominio } from '@/shared/domain/errores'
import BotonPrincipal from '@/shared/ui/componentes/BotonPrincipal.vue'
import CampoNumero from '@/shared/ui/componentes/CampoNumero.vue'
import CampoTexto from '@/shared/ui/componentes/CampoTexto.vue'
import EncabezadoPagina from '@/shared/ui/componentes/EncabezadoPagina.vue'
import MensajeDeError from '@/shared/ui/componentes/MensajeDeError.vue'
import PantallaExito from '@/shared/ui/componentes/PantallaExito.vue'
import { validarCambios } from '../domain/configuracion'

/**
 * Datos de la tienda (fase-1/README, "Configuración del negocio"): nombre (1–40), cada cuántos
 * días compra (1–60), con cuántos días de anticipación avisar (1–14) y desde cuántos días una
 * compra es sobrecompra (7–180, RN-OP-20). Cada error va junto a su campo.
 */
type Campo = 'nombreTienda' | 'diasEntreCompras' | 'diasAnticipacion' | 'diasMaximosDeCompra'
type CampoDeDias = Exclude<Campo, 'nombreTienda'>

const aplicacion = useAplicacion()
const router = useRouter()

const valores = reactive<Record<Campo, string>>({
  nombreTienda: '',
  diasEntreCompras: '',
  diasAnticipacion: '',
  diasMaximosDeCompra: '',
})
const errores = reactive<Partial<Record<Campo, string>>>({})
const leido = ref(false)
const guardando = ref(false)
const guardado = ref(false)
const fallo = ref<string | null>(null)

onMounted(async () => {
  try {
    const configuracion = await aplicacion.tienda.obtenerConfiguracion()
    valores.nombreTienda = configuracion.nombreTienda
    valores.diasEntreCompras = String(configuracion.diasEntreCompras)
    valores.diasAnticipacion = String(configuracion.diasAnticipacion)
    valores.diasMaximosDeCompra = String(configuracion.diasMaximosDeCompra)
    leido.value = true
  } catch (causa) {
    console.error('No se pudieron leer los datos de la tienda:', causa)
    fallo.value = 'No pudimos leer los datos de tu tienda'
  }
})

/** "10" → 10; vacío o con letras → NaN (que la validación rechaza con su mensaje). */
function numero(texto: string): number {
  return texto.trim() === '' ? Number.NaN : Number(texto.trim().replace(',', '.'))
}

function cambios() {
  return {
    nombreTienda: valores.nombreTienda,
    diasEntreCompras: numero(valores.diasEntreCompras),
    diasAnticipacion: numero(valores.diasAnticipacion),
    diasMaximosDeCompra: numero(valores.diasMaximosDeCompra),
  }
}

function validar(): boolean {
  const pedidos = cambios()
  for (const campo of Object.keys(pedidos) as Campo[]) {
    errores[campo] = validarCambios({ [campo]: pedidos[campo] }) ?? undefined
  }
  return Object.values(errores).every((e) => e === undefined)
}

async function guardar(): Promise<void> {
  fallo.value = null
  if (!validar()) return
  guardando.value = true
  try {
    await aplicacion.tienda.actualizarConfiguracion(cambios())
    guardado.value = true
  } catch (causa) {
    if (!esErrorDeDominio(causa)) console.error('No se pudieron guardar los datos:', causa)
    fallo.value = esErrorDeDominio(causa) ? causa.message : 'No se pudieron guardar los cambios'
  } finally {
    guardando.value = false
  }
}

const AYUDAS: Record<CampoDeDias, string> = {
  diasEntreCompras: 'Con esto calculamos cuánto te conviene comprar.',
  diasAnticipacion: 'Te avisamos cuando a un producto le queden estos días o menos.',
  diasMaximosDeCompra: 'Si una compra alcanza para más días, te preguntamos antes de registrarla.',
}
const CAMPOS_DE_DIAS: readonly { campo: CampoDeDias; etiqueta: string }[] = [
  { campo: 'diasEntreCompras', etiqueta: '¿Cada cuántos días compras mercadería?' },
  { campo: 'diasAnticipacion', etiqueta: '¿Con cuántos días de anticipación te aviso?' },
  { campo: 'diasMaximosDeCompra', etiqueta: 'Avísame si una compra alcanza para más de' },
]
</script>

<template>
  <PantallaExito v-if="guardado" titulo="Cambios guardados" :detalle="valores.nombreTienda.trim()">
    <BotonPrincipal texto="Volver a Ajustes" @click="router.push({ name: 'ajustes' })" />
  </PantallaExito>

  <div v-else class="vista-datos-de-la-tienda">
    <EncabezadoPagina titulo="Datos de la tienda" volver />

    <MensajeDeError
      v-if="!leido && fallo"
      :mensaje="fallo"
      ayuda="Vuelve a Ajustes y entra de nuevo en un momento."
    />

    <form v-if="leido" class="formulario" novalidate @submit.prevent="guardar">
      <CampoTexto
        v-model="valores.nombreTienda"
        etiqueta="Nombre de la tienda"
        ayuda="Lo usamos para saludarte y en tus archivos de Excel."
        autocompletar="organization"
        :error="errores.nombreTienda"
      />
      <div v-for="{ campo, etiqueta } in CAMPOS_DE_DIAS" :key="campo" class="campo-de-dias">
        <CampoNumero
          v-model="valores[campo]"
          :etiqueta="etiqueta"
          sufijo="días"
          :minimo="RANGOS_DE_CONFIGURACION[campo].min"
          :error="errores[campo]"
        />
        <p class="ayuda">{{ AYUDAS[campo] }}</p>
      </div>

      <MensajeDeError v-if="fallo" :mensaje="fallo" ayuda="Revisa los datos y vuelve a guardar." />

      <div class="acciones">
        <BotonPrincipal texto="Guardar cambios" tipo="submit" :deshabilitado="guardando" />
      </div>
    </form>
  </div>
</template>

<style scoped>
.vista-datos-de-la-tienda {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-5);
}
.ayuda {
  margin: var(--espacio-2) 0 0;
  color: var(--color-texto-suave);
}
.acciones {
  display: flex;
  flex-direction: column;
}
@media (min-width: 1024px) {
  .vista-datos-de-la-tienda {
    max-width: 40rem;
  }
}
</style>

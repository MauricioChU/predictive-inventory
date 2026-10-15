import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearCantidad, formatearDinero, plural } from '@/shared/domain/formato'

/** "4 unid." ya termina en punto; "2 kg" no. */
function conPunto(texto: string): string {
  return texto.endsWith('.') ? texto : `${texto}.`
}

/**
 * RN-AN-16: una sola frase, según el primer caso que se cumpla. Ninguna plantilla agrega
 * punto final: el de "… y tienes 4 unid." es el de la abreviatura.
 */
export function respuestaNecesitoComprar(s: SituacionDeProducto, precioCompra: Dinero): string {
  const stock = formatearCantidad(s.stock, s.unidad)
  if (s.parado) {
    return `No compres: no se vende hace ${s.parado.diasSinVender} días y tienes ${stock}`
  }
  if (s.enListaParaComprar && s.cantidadSugerida) {
    const sugerido = formatearCantidad(s.cantidadSugerida, s.unidad)
    const costo = formatearDinero(precioCompra.multiplicarPor(s.cantidadSugerida))
    return `Sí, compra ~${sugerido} (${costo})`
  }
  if (s.prediccion) {
    if (s.diasDeCobertura === null) return 'No hace falta: no vendiste en las últimas 4 semanas'
    const dias = plural(s.diasDeCobertura, 'día', 'días')
    return `No hace falta: te alcanza para ~${s.diasDeCobertura} ${dias}`
  }
  return `Tienes ${conPunto(stock)} Todavía no sé cuánto vendes; vuelve a preguntar en unos días`
}

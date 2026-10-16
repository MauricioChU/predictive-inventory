import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearCantidad, formatearDinero, plural } from '@/shared/domain/formato'
import type { CambioEnLista } from './compras'

/** "4 unid." ya termina en punto; "2 kg" no. */
function conPunto(texto: string): string {
  return texto.endsWith('.') ? texto : `${texto}.`
}

/**
 * RN-AN-16: una sola frase, según el primer caso que se cumpla. Ninguna plantilla agrega
 * punto final: el de "… y tienes 4 unid." es el de la abreviatura.
 *
 * Caso 2 con la lista de hoy (RN-AN-08): si el usuario cambió la cantidad, se usa esa; si lo
 * quitó de la lista, no se le contradice y se sigue con el caso 3.
 */
export function respuestaNecesitoComprar(
  s: SituacionDeProducto,
  precioCompra: Dinero,
  cambioDelDia?: CambioEnLista,
): string {
  const stock = formatearCantidad(s.stock, s.unidad)
  if (s.parado) {
    return `No compres: no se vende hace ${s.parado.diasSinVender} días y tienes ${stock}`
  }
  const enLaLista = cambioDelDia ? cambioDelDia.cantidad : s.cantidadSugerida
  if (s.enListaParaComprar && s.cantidadSugerida && enLaLista) {
    const cantidad = formatearCantidad(enLaLista, s.unidad)
    const costo = formatearDinero(precioCompra.multiplicarPor(enLaLista))
    return `Sí, compra ~${cantidad} (${costo})`
  }
  if (s.prediccion) {
    if (s.diasDeCobertura === null) return 'No hace falta: no vendiste en las últimas 4 semanas'
    const dias = plural(s.diasDeCobertura, 'día', 'días')
    return `No hace falta: te alcanza para ~${s.diasDeCobertura} ${dias}`
  }
  return `Tienes ${conPunto(stock)} Todavía no sé cuánto vendes; vuelve a preguntar en unos días`
}

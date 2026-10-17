import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import type { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearCantidad, formatearDinero, plural } from '@/shared/domain/formato'
import type { CambioEnLista } from './compras'

/** "4 unid." ya termina en punto; "2 kg" no. */
function conPunto(texto: string): string {
  return texto.endsWith('.') ? texto : `${texto}.`
}

/** RN-AN-16 caso 2: la cantidad de la lista de hoy, o null si no hay que decir "compra". */
function cantidadAComprar(s: SituacionDeProducto, cambioDelDia?: CambioEnLista): Cantidad | null {
  if (!cambioDelDia) return s.cantidadSugerida
  if (cambioDelDia.cantidad) return cambioDelDia.cantidad
  return s.estado === 'NORMAL' ? null : s.cantidadSugerida
}

/** RN-AN-16: cuál de los cuatro casos respondió (la pantalla elige el tono; el texto lo dice igual). */
export type CasoNecesitoComprar = 'NO_COMPRES' | 'COMPRAR' | 'NO_HACE_FALTA' | 'SIN_PREDICCION'

export interface DecisionNecesitoComprar {
  caso: CasoNecesitoComprar
  /** Una sola frase. */
  respuesta: string
}

/**
 * RN-AN-16: una sola frase, según el primer caso que se cumpla. Ninguna plantilla agrega
 * punto final: el de "… y tienes 4 unid." es el de la abreviatura.
 *
 * Caso 2 con la lista de hoy (RN-AN-08): si el usuario cambió la cantidad, se usa esa. Si lo
 * quitó de la lista y está NORMAL, no se le contradice y se sigue con el caso 3; si está AGOTADO
 * o POR_ACABARSE, quitarlo solo lo saca de la lista: se responde con la cantidad sugerida
 * (nunca "No hace falta" para un producto que se acabó o se está acabando).
 */
export function decidirNecesitoComprar(
  s: SituacionDeProducto,
  precioCompra: Dinero,
  cambioDelDia?: CambioEnLista,
): DecisionNecesitoComprar {
  const stock = formatearCantidad(s.stock, s.unidad)
  if (s.parado) {
    return {
      caso: 'NO_COMPRES',
      respuesta: `No compres: no se vende hace ${s.parado.diasSinVender} días y tienes ${stock}`,
    }
  }
  const aComprar = cantidadAComprar(s, cambioDelDia)
  if (s.enListaParaComprar && aComprar) {
    const cantidad = formatearCantidad(aComprar, s.unidad)
    const costo = formatearDinero(precioCompra.multiplicarPor(aComprar))
    return { caso: 'COMPRAR', respuesta: `Sí, compra ~${cantidad} (${costo})` }
  }
  if (s.prediccion) {
    if (s.diasDeCobertura === null) {
      return {
        caso: 'NO_HACE_FALTA',
        respuesta: 'No hace falta: no vendiste en las últimas 4 semanas',
      }
    }
    const dias = plural(s.diasDeCobertura, 'día', 'días')
    return {
      caso: 'NO_HACE_FALTA',
      respuesta: `No hace falta: te alcanza para ~${s.diasDeCobertura} ${dias}`,
    }
  }
  return {
    caso: 'SIN_PREDICCION',
    respuesta: `Tienes ${conPunto(stock)} Todavía no sé cuánto vendes; vuelve a preguntar en unos días`,
  }
}

/** RN-AN-16: solo la frase (ver decidirNecesitoComprar). */
export function respuestaNecesitoComprar(
  s: SituacionDeProducto,
  precioCompra: Dinero,
  cambioDelDia?: CambioEnLista,
): string {
  return decidirNecesitoComprar(s, precioCompra, cambioDelDia).respuesta
}

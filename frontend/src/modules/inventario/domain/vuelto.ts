import { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearDinero } from '@/shared/domain/formato'

/** RN-OP-13: botones rápidos S/ 10, 20, 50 y 100, en céntimos ("Exacto" lo arma la pantalla). */
export const BILLETES_RAPIDOS: readonly number[] = Object.freeze([1000, 2000, 5000, 10000])

export interface ResultadoDelVuelto {
  puedeConfirmar: boolean
  mensaje: string
  vuelto: Dinero | null
}

const MONTO_INVALIDO = 'Escribe un monto válido, por ejemplo 3.50'

function leerPagado(pagado: string): Dinero | string {
  try {
    const monto = Dinero.deTexto(pagado)
    return monto.esNegativo() ? MONTO_INVALIDO : monto
  } catch (error) {
    if (esErrorDeDominio(error)) return error.message
    throw error
  }
}

/**
 * RN-OP-13: vuelto = pagado − total (opcional, no se guarda). Si lo pagado no alcanza, se
 * muestra "Faltan S/ X" y no se puede confirmar el cobro con ese monto. Sin monto escrito,
 * no hay nada que mostrar y la venta se puede confirmar igual.
 */
export function calcularVuelto(total: Dinero, pagado: string): ResultadoDelVuelto {
  if (pagado.trim() === '') return { puedeConfirmar: true, mensaje: '', vuelto: null }
  const monto = leerPagado(pagado)
  if (typeof monto === 'string') return { puedeConfirmar: false, mensaje: monto, vuelto: null }
  if (monto.menorQue(total)) {
    return {
      puedeConfirmar: false,
      mensaje: `Faltan ${formatearDinero(total.restar(monto))}`,
      vuelto: null,
    }
  }
  const vuelto = monto.restar(total)
  return { puedeConfirmar: true, mensaje: `Vuelto ${formatearDinero(vuelto)}`, vuelto }
}

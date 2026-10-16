import type { TipoDeOperacion } from '@/shared/contratos/operaciones'
import type { MovimientoRegistro, OperacionRegistro } from '@/shared/contratos/registros'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'

/** Línea de una operación de prueba, con montos como los escribe el usuario. */
export interface LineaDePrueba {
  producto: string
  /** Sin signo, salvo en AJUSTE (con signo, p. ej. "-1"). */
  cantidad: string
  costo: string
  precio?: string
}

export interface OpcionesDeOperacion {
  id?: string
  /** "AAAA-MM-DD HH:mm" en hora de la tienda; por defecto, igual a la fecha de la operación. */
  registradaEn?: string
}

const SALEN: readonly TipoDeOperacion[] = ['VENTA', 'MERMA']
let contador = 0

function movimiento(tipo: TipoDeOperacion, linea: LineaDePrueba): MovimientoRegistro {
  const milesimas = Cantidad.deTexto(linea.cantidad, 'KILO').milesimas
  return {
    productoId: linea.producto,
    cantidad: SALEN.includes(tipo) ? -milesimas : milesimas,
    costoUnitario: Dinero.deTexto(linea.costo).centimos,
    precioUnitario: linea.precio === undefined ? null : Dinero.deTexto(linea.precio).centimos,
  }
}

/** Operación de prueba ocurrida `cuando` ("AAAA-MM-DD HH:mm" en hora de la tienda). */
export function nuevaOperacion(
  tipo: Exclude<TipoDeOperacion, 'ANULACION'>,
  cuando: string,
  lineas: readonly LineaDePrueba[],
  opciones: OpcionesDeOperacion = {},
): OperacionRegistro {
  contador += 1
  const movimientos = lineas.map((l) => movimiento(tipo, l))
  return {
    id: opciones.id ?? `op-${contador}`,
    tipo,
    movimientos,
    productoIds: [...new Set(movimientos.map((m) => m.productoId))],
    ocurridaEn: instanteLocal(cuando),
    registradaEn: instanteLocal(opciones.registradaEn ?? cuando),
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'dispositivo-de-prueba',
  }
}

/** Anulación de `original` registrada `cuando` (invierte todos sus movimientos, RN-OP-17). */
export function anulacionDe(original: OperacionRegistro, cuando: string): OperacionRegistro {
  contador += 1
  return {
    ...original,
    id: `op-${contador}`,
    tipo: 'ANULACION',
    movimientos: original.movimientos.map((m) => ({ ...m, cantidad: -m.cantidad })),
    ocurridaEn: instanteLocal(cuando),
    registradaEn: instanteLocal(cuando),
    anulaA: original.id,
  }
}

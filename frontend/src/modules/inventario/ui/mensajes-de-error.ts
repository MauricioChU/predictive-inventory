import { esErrorDeDominio } from '@/shared/domain/errores'

/** Lo que muestra MensajeDeError: el mensaje del dominio tal cual y qué hacer (RN-UX-07). */
export interface ErrorParaMostrar {
  mensaje: string
  ayuda?: string
  /** Código del ErrorDeDominio, para saber junto a qué campo va (undefined si no lo es). */
  codigo?: string
}

/** En qué estaba la persona: la misma falta de stock se arregla distinto en cada caso. */
export type Contexto = 'venta' | 'ingreso' | 'merma' | 'conteo' | 'anulacion' | 'deshacer'

/** RN-UX-07: "Solo quedan 2 unid. de Lejía 1 L. Cambia la cantidad o registra la llegada…". */
export const AYUDA_STOCK_INSUFICIENTE: Record<Contexto, string> = {
  venta: 'Cambia la cantidad o registra la llegada de mercadería.',
  ingreso: 'Cambia la cantidad o registra la llegada de mercadería.',
  merma: 'Cambia la cantidad. Si el stock no cuadra, primero cuéntalo con Contar stock.',
  conteo: 'Revisa la cantidad y vuelve a intentarlo.',
  anulacion:
    'Esa mercadería ya se vendió o se usó. Si el stock no cuadra, cuéntalo con Contar stock.',
  deshacer:
    'Esa mercadería ya se vendió o se usó. Si el stock no cuadra, cuéntalo con Contar stock.',
}

const AYUDA_GENERAL = 'Revisa los datos y vuelve a intentarlo.'

/** Mensajes del dominio que ya dicen qué hacer: no llevan otra línea de ayuda. */
const YA_DICEN_QUE_HACER = new Set([
  'LINEAS_EN_CONFLICTO',
  'DESHACER_VENCIDO',
  'ANULACION_NO_ANULABLE',
  'PRODUCTO_ARCHIVADO',
])

const AYUDAS: Record<string, string> = {
  PRODUCTO_INEXISTENTE: 'Quítalo de la lista y búscalo otra vez.',
  OPERACION_INEXISTENTE: 'Vuelve al Historial y elígela otra vez.',
  OPERACION_YA_ANULADA: 'No hace falta hacer nada más.',
}

/**
 * Convierte lo que lanzó un caso de uso en algo que se puede mostrar. Un ErrorDeDominio se
 * muestra con su mensaje exacto (spec) más una línea de qué hacer; cualquier otro error (p. ej.
 * la base del celular no respondió) se registra en la consola y se muestra en palabras simples,
 * sin códigos técnicos.
 */
export function errorParaMostrar(error: unknown, contexto: Contexto): ErrorParaMostrar {
  if (!esErrorDeDominio(error)) {
    console.error('Falló una operación:', error)
    return {
      mensaje: 'No pudimos guardar esto.',
      ayuda: 'Vuelve a intentarlo. Si sigue pasando, cierra la app y ábrela otra vez.',
    }
  }
  const { codigo, message: mensaje } = error
  if (codigo === 'STOCK_INSUFICIENTE') {
    return { codigo, mensaje, ayuda: AYUDA_STOCK_INSUFICIENTE[contexto] }
  }
  if (YA_DICEN_QUE_HACER.has(codigo)) return { codigo, mensaje }
  return { codigo, mensaje, ayuda: AYUDAS[codigo] ?? AYUDA_GENERAL }
}

import type { TamanoDeLetra } from '@/shared/contratos/configuracion'

/** RN-UX-01: Normal (18 px), Grande (20 px, por defecto) y Muy grande (24 px). */
export const OPCIONES_DE_LETRA: readonly { valor: TamanoDeLetra; etiqueta: string }[] = [
  { valor: 'NORMAL', etiqueta: 'Normal' },
  { valor: 'GRANDE', etiqueta: 'Grande' },
  { valor: 'MUY_GRANDE', etiqueta: 'Muy grande' },
]

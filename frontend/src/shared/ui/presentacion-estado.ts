export type EstadoVisual = 'AGOTADO' | 'POR_ACABARSE' | 'NORMAL'

export const PRESENTACION_DE_ESTADO: Record<
  EstadoVisual,
  { texto: string; color: 'rojo' | 'naranja' | 'verde'; icono: 'círculo-x' | 'advertencia' | 'check'; claseCss: string }
> = {
  AGOTADO: { texto: 'Agotado', color: 'rojo', icono: 'círculo-x', claseCss: 'estado-agotado' },
  POR_ACABARSE: { texto: 'Queda poco', color: 'naranja', icono: 'advertencia', claseCss: 'estado-por-acabarse' },
  NORMAL: { texto: 'Bien', color: 'verde', icono: 'check', claseCss: 'estado-normal' },
}

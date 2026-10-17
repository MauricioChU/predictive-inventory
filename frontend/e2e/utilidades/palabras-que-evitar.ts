// Plan 16, ítem 5: la columna «Evitar» de la guía de palabras (06-experiencia-de-uso). Sin
// dependencias, para que también la pruebe Vitest (tests/configuracion/palabras-que-evitar.spec.ts).

/** «Evitar» de la guía (y lo que se le parece), más fugas técnicas de la programación. */
export const PALABRAS_QUE_EVITAR: readonly { palabra: RegExp; usar: string }[] = [
  { palabra: /\bmermas?\b/i, usar: 'Se dañó · Se derramó · Se venció (o "pérdida")' },
  { palabra: /\bingresos?\b|registrar (la )?entrada|entrada de mercader/i, usar: 'Llegó mercadería' },
  { palabra: /ajustes? de (inventario|stock)/i, usar: 'Contar stock' },
  { palabra: /stock cr[ií]tico|\bumbral\b/i, usar: 'Queda poco · Agotado · Bien' },
  { palabra: /\bcobertura\b/i, usar: 'Se acaba en ~4 días · ¿Necesito comprar?' },
  { palabra: /\bbackups?\b|exportar (a )?json/i, usar: 'Guardar copia' },
  { palabra: /\brevert(ir|ido|ida|imos)?\b|\brollback\b/i, usar: 'Deshacer · Anular' },
  { palabra: /\bundefined\b|\bnull\b|\bNaN\b|\[object |\bInfinity\b/, usar: '(un valor sin mostrar)' },
]

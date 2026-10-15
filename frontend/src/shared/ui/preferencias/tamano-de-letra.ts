export type TamanoDeLetra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'
const CLAVE = 'pi.letra'
const VALIDOS: readonly TamanoDeLetra[] = ['NORMAL', 'GRANDE', 'MUY_GRANDE']

/** Copia rápida en localStorage para aplicar la letra antes de abrir la base de datos (evita parpadeo). La fuente de verdad será la configuración de la tienda. */
export function leerTamanoDeLetraGuardado(): TamanoDeLetra {
  try {
    const valor = localStorage.getItem(CLAVE)
    return VALIDOS.includes(valor as TamanoDeLetra) ? (valor as TamanoDeLetra) : 'GRANDE'
  } catch {
    return 'GRANDE'
  }
}

export function aplicarTamanoDeLetra(tamano: TamanoDeLetra): void {
  document.documentElement.dataset.letra = tamano
  try {
    localStorage.setItem(CLAVE, tamano)
  } catch {
    /* almacenamiento bloqueado: se aplica solo en esta sesión */
  }
}

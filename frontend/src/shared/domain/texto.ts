/** Forma comparable de un texto: sin tildes, en minúsculas y con espacios simples (RN-CAT-01). */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

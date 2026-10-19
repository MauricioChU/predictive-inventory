import { plural } from '@/shared/domain/formato'

/** RN-AL-06: texto del aviso de atención en Inicio ("1 agotado y 1 por acabarse", etc.). */
export function textoDeAtencion(agotados: number, porAcabarse: number): string {
  const partes: string[] = []
  if (agotados > 0) partes.push(`${agotados} ${plural(agotados, 'agotado', 'agotados')}`)
  if (porAcabarse > 0) partes.push(`${porAcabarse} por acabarse`)
  if (partes.length === 0) return 'Todo bien: no falta nada'
  return partes.join(' y ')
}

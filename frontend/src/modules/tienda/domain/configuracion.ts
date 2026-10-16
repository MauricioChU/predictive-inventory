import {
  RANGOS_DE_CONFIGURACION,
  type ConfiguracionDeNegocio,
} from '../../../shared/contratos/configuracion'

type CampoDeDias = 'diasEntreCompras' | 'diasAnticipacion' | 'diasMaximosDeCompra'

const CAMPOS_DE_DIAS: readonly CampoDeDias[] = [
  'diasEntreCompras',
  'diasAnticipacion',
  'diasMaximosDeCompra',
]

/**
 * Valida los cambios de configuración que vienen en el formulario (parcial): solo revisa
 * los campos presentes en `cambios`. Devuelve el primer mensaje de error, o `null` si todo
 * está dentro de los rangos de `RANGOS_DE_CONFIGURACION`.
 */
export function validarCambios(cambios: Partial<ConfiguracionDeNegocio>): string | null {
  if (cambios.nombreTienda !== undefined) {
    const nombre = cambios.nombreTienda.trim()
    if (nombre === '') return 'Escribe el nombre de tu tienda'
    if (nombre.length > RANGOS_DE_CONFIGURACION.nombreTienda.max) {
      return 'El nombre de la tienda puede tener hasta 40 letras'
    }
  }

  for (const campo of CAMPOS_DE_DIAS) {
    const valor = cambios[campo]
    if (valor === undefined) continue
    const { min, max } = RANGOS_DE_CONFIGURACION[campo]
    if (!Number.isInteger(valor) || valor < min || valor > max) {
      return `Elige un número entre ${min} y ${max}`
    }
  }

  return null
}

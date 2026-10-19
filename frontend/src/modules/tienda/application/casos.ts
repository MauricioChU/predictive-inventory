import { ErrorDeDominio } from '../../../shared/domain/errores'
import { normalizarAlquilerDelLocal } from '../../../shared/domain/alquiler-del-local'
import {
  CONFIGURACION_INICIAL,
  type ConfiguracionDeNegocio,
  type EstadoDelSistema,
  type TamanoDeLetra,
} from '../../../shared/contratos/configuracion'
import type {
  ConfiguracionRegistro,
  EstadoDelSistemaRegistro,
} from '../../../shared/contratos/registros'
import { validarCambios } from '../domain/configuracion'
import type { DependenciasDeTienda } from './puertos'

function sinClave<T extends { clave: string }>(registro: T): Omit<T, 'clave'> {
  const copia: Partial<T> = { ...registro }
  delete copia.clave
  return copia as Omit<T, 'clave'>
}

/** Campo del aviso del local: nace en `null` y los registros anteriores no lo traen. */
const SISTEMA_SIN_AVISOS_DEL_LOCAL: Pick<EstadoDelSistema, 'ultimoPagoDelLocalAvisado'> = {
  ultimoPagoDelLocalAvisado: null,
}

/** Ola 3, ruling 1: el evento sale tras el commit de la unidad de trabajo MÁS EXTERNA. */
function publicarAlConfirmar(deps: DependenciasDeTienda): void {
  deps.uow.alConfirmar(() => deps.bus.publicar({ tipo: 'ConfiguracionActualizada' }))
}

export async function obtenerConfiguracion(
  deps: DependenciasDeTienda,
): Promise<ConfiguracionDeNegocio> {
  const registro = await deps.repositorio.negocio()
  // Un registro de una versión anterior no trae los campos nuevos: se completan con los iniciales.
  return registro
    ? { ...CONFIGURACION_INICIAL, ...sinClave(registro) }
    : { ...CONFIGURACION_INICIAL }
}

/** Crea el estado del sistema la primera vez que se consulta, y lo deja guardado. */
export async function estadoDelSistema(deps: DependenciasDeTienda): Promise<EstadoDelSistema> {
  // RN-SIS-09: casi siempre ya existe (cada venta lo consulta): basta una lectura, que no hace
  // fila como una escritura.
  const guardado = await deps.uow.leer(() => deps.repositorio.sistema())
  if (guardado) return { ...SISTEMA_SIN_AVISOS_DEL_LOCAL, ...sinClave(guardado) }

  // Volver a leer y crear va en una sola unidad de trabajo: dos primeras consultas simultáneas
  // no pueden crear dos dispositivoId distintos.
  return deps.uow.ejecutar(async () => {
    const existente = await deps.repositorio.sistema()
    if (existente) return { ...SISTEMA_SIN_AVISOS_DEL_LOCAL, ...sinClave(existente) }

    const nuevo: EstadoDelSistemaRegistro = {
      clave: 'sistema',
      dispositivoId: deps.ids.nuevo(),
      primeraVezCompletada: false,
      ultimoRespaldoEn: null,
      almacenamientoPersistente: 'DESCONOCIDO',
      ...SISTEMA_SIN_AVISOS_DEL_LOCAL,
    }
    await deps.repositorio.guardarSistema(nuevo)
    return sinClave(nuevo)
  })
}

export async function actualizarConfiguracion(
  deps: DependenciasDeTienda,
  cambios: Partial<ConfiguracionDeNegocio>,
): Promise<void> {
  const error = validarCambios(cambios)
  if (error) throw new ErrorDeDominio('CONFIGURACION_INVALIDA', error)

  await deps.uow.ejecutar(async () => {
    const actual = await obtenerConfiguracion(deps)
    const limpios: Partial<ConfiguracionDeNegocio> = { ...cambios }
    if (cambios.nombreTienda !== undefined) limpios.nombreTienda = cambios.nombreTienda.trim()
    if (cambios.alquilerDelLocal !== undefined) {
      limpios.alquilerDelLocal = normalizarAlquilerDelLocal(cambios.alquilerDelLocal)
    }
    const actualizada: ConfiguracionRegistro = { ...actual, ...limpios, clave: 'negocio' }
    await deps.repositorio.guardarNegocio(actualizada)
    publicarAlConfirmar(deps)
  })
}

export async function actualizarEstadoDelSistema(
  deps: DependenciasDeTienda,
  cambios: Partial<EstadoDelSistema>,
): Promise<void> {
  await deps.uow.ejecutar(async () => {
    const actual = await estadoDelSistema(deps)
    const actualizado: EstadoDelSistemaRegistro = { ...actual, ...cambios, clave: 'sistema' }
    await deps.repositorio.guardarSistema(actualizado)
  })
}

export async function completarPrimeraVez(
  deps: DependenciasDeTienda,
  datos: { nombreTienda: string; tamanoDeLetra: TamanoDeLetra },
): Promise<void> {
  const error = validarCambios({ nombreTienda: datos.nombreTienda })
  if (error) throw new ErrorDeDominio('CONFIGURACION_INVALIDA', error)

  await deps.uow.ejecutar(async () => {
    const actual = await obtenerConfiguracion(deps)
    const actualizada: ConfiguracionRegistro = {
      ...actual,
      nombreTienda: datos.nombreTienda.trim(),
      tamanoDeLetra: datos.tamanoDeLetra,
      clave: 'negocio',
    }
    await deps.repositorio.guardarNegocio(actualizada)

    const estado = await estadoDelSistema(deps)
    const estadoActualizado: EstadoDelSistemaRegistro = {
      ...estado,
      primeraVezCompletada: true,
      clave: 'sistema',
    }
    await deps.repositorio.guardarSistema(estadoActualizado)
    publicarAlConfirmar(deps)
  })
}

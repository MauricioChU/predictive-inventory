import { Cantidad } from '../../../shared/domain/cantidad'
import { ErrorDeDominio } from '../../../shared/domain/errores'
import {
  crearRespaldo,
  leerRespaldo,
  resumenDeCopia,
  type ResumenDeCopia,
} from '../domain/formato-de-respaldo'
import { nombreDeArchivoCopia } from '../domain/nombres-de-archivo'
import type { ArchivoGenerado, DependenciasDeRespaldo } from './puertos'

/** RN-RE-03: hay que confirmar estas dos frases, en este orden, para restaurar una copia. */
export const CONFIRMACIONES_PARA_RESTAURAR = [
  'Se reemplazarán todos los datos de este celular por los de la copia. ¿Continuar?',
  'Esto no se puede deshacer. ¿Seguro que quieres restaurar?',
] as const

const TIPO_JSON = 'application/json'

/** RN-RE-02: respaldo completo. Guarda el momento como "último respaldo" del dispositivo. */
export async function guardarCopia(deps: DependenciasDeRespaldo): Promise<ArchivoGenerado> {
  const datos = await deps.almacen.leerTodo()
  const existencias = await deps.inventario().existencias()
  const ahora = deps.reloj.ahora()
  const respaldo = crearRespaldo(datos, existencias, ahora)

  const configuracion = await deps.tienda().configuracion()
  const nombre = nombreDeArchivoCopia(configuracion.nombreTienda, ahora)
  const contenido = new Blob([JSON.stringify(respaldo)], { type: TIPO_JSON })

  await deps.tienda().actualizarEstadoDelSistema({ ultimoRespaldoEn: ahora })

  return { nombre, tipo: TIPO_JSON, contenido }
}

/** RN-RE-03: valida la copia y arma lo que hay que mostrarle al usuario antes de restaurar. */
export async function prepararRestauracion(
  _deps: DependenciasDeRespaldo,
  texto: string,
): Promise<{ resumen: ResumenDeCopia; confirmaciones: typeof CONFIRMACIONES_PARA_RESTAURAR }> {
  const respaldo = leerRespaldo(texto)
  const resumen = resumenDeCopia(respaldo.control, respaldo.datos.operaciones)
  return { resumen, confirmaciones: CONFIRMACIONES_PARA_RESTAURAR }
}

/**
 * RN-RE-03/04: reemplaza todos los datos por los de la copia, dentro de una sola unidad de
 * trabajo. Si la copia es inválida, se lanza antes de tocar nada. Si tras reconstruir las
 * existencias no coinciden con el control, la unidad de trabajo revierte todo.
 */
export async function restaurarCopia(
  deps: DependenciasDeRespaldo,
  texto: string,
  datos: { confirmaciones: number },
): Promise<void> {
  if (datos.confirmaciones < CONFIRMACIONES_PARA_RESTAURAR.length) {
    throw new ErrorDeDominio('CONFIRMACIONES_INSUFICIENTES', 'Confirma dos veces para restaurar')
  }

  const respaldo = leerRespaldo(texto)

  await deps.uow.ejecutar(async () => {
    await deps.almacen.reemplazarTodo(respaldo.datos)
    await deps.reconstructor.reconstruirTodo()

    const existencias = await deps.inventario().existencias()
    for (const [productoId, milesimasEsperadas] of Object.entries(
      respaldo.control.stockPorProducto,
    )) {
      const real = existencias.get(productoId) ?? Cantidad.cero()
      if (real.milesimas !== milesimasEsperadas) {
        throw new ErrorDeDominio(
          'COPIA_NO_CUADRA',
          'La copia tiene datos que no cuadran. No se cambió nada',
        )
      }
    }
  })
}

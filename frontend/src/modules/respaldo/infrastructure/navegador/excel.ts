import { ErrorDeDominio } from '../../../../shared/domain/errores'
import { normalizar } from '../../../../shared/domain/texto'
import readXlsxFile from 'read-excel-file/browser'
import writeXlsxFile from 'write-excel-file/browser'
import type { CeldaDeExcel, HojaDeExcel } from '../../domain/hojas-de-excel'
import type { GeneradorDeExcel, LectorDeExcel } from '../../application/puertos'

function celda(c: CeldaDeExcel) {
  if (typeof c.valor === 'number') {
    return { value: c.valor, type: Number, format: c.formato }
  }
  return { value: c.valor, type: String }
}

/** Genera un .xlsx real con write-excel-file (entrada para navegador). */
export class GeneradorDeExcelDelNavegador implements GeneradorDeExcel {
  async generar(hojas: readonly HojaDeExcel[]): Promise<Blob> {
    const sheets = hojas.map((hoja) => ({
      sheet: hoja.nombre,
      data: [
        hoja.columnas.map((nombre) => ({ value: nombre, type: String })),
        ...hoja.filas.map((fila) => fila.map(celda)),
      ],
    }))
    return writeXlsxFile(sheets).toBlob()
  }
}

/** Lee la hoja "Productos" (o la primera si no existe) de un .xlsx; cada celda como texto. */
export class LectorDeExcelDelNavegador implements LectorDeExcel {
  async leerPrimeraHoja(archivo: Blob): Promise<string[][]> {
    let hojas
    try {
      hojas = await readXlsxFile(archivo)
    } catch {
      throw new ErrorDeDominio(
        'EXCEL_INVALIDO',
        'Este archivo no es un Excel (.xlsx). Usa la plantilla.',
      )
    }
    const hoja = hojas.find((h) => normalizar(h.sheet) === 'productos') ?? hojas[0]
    if (!hoja) return []
    return hoja.data.map((fila) =>
      fila.map((valor) => (valor === null || valor === undefined ? '' : String(valor))),
    )
  }
}

import { diaDe, type Dia, type Instante } from '../../../shared/domain/fecha'
import { normalizar } from '../../../shared/domain/texto'

/** Perú no usa horario de verano: America/Lima es siempre UTC−5 (igual que shared/domain/fecha). */
const DESFASE_MS = -5 * 60 * 60 * 1000

/** Nombre de tienda → fragmento seguro para un nombre de archivo. Vacío → "tienda". */
export function slug(nombreTienda: string): string {
  const base = normalizar(nombreTienda)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return base === '' ? 'tienda' : base
}

/** Hora del día en Lima, como "HHmm" (p. ej. "2030" para las 8:30 p.m.). */
export function horaLocal(instante: Instante): string {
  const local = new Date(Date.parse(instante) + DESFASE_MS)
  const horas = String(local.getUTCHours()).padStart(2, '0')
  const minutos = String(local.getUTCMinutes()).padStart(2, '0')
  return `${horas}${minutos}`
}

/** `inventario-<slug>-AAAA-MM-DD.xlsx` (RN-RE-01). */
export function nombreDeArchivoExcel(nombreTienda: string, dia: Dia): string {
  return `inventario-${slug(nombreTienda)}-${dia}.xlsx`
}

/** `respaldo-<slug>-AAAA-MM-DD-HHmm.json`, con fecha y hora de Lima (RN-RE-02). */
export function nombreDeArchivoCopia(nombreTienda: string, creadoEn: Instante): string {
  return `respaldo-${slug(nombreTienda)}-${diaDe(creadoEn)}-${horaLocal(creadoEn)}.json`
}

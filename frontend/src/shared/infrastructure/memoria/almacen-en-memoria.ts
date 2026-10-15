import { CLAVE_DE_TABLA, type NombreDeTabla, type TablasDeLaApp } from '../../contratos/registros'

type Tablas = { [K in NombreDeTabla]: Map<string, TablasDeLaApp[K]> }

function copiar<T>(valor: T): T {
  // Los Blob (fotos) no se copian: son inmutables.
  if (valor && typeof valor === 'object' && 'imagen' in valor) return { ...valor }
  return structuredClone(valor)
}

/** Base de datos en memoria con las mismas tablas que Dexie. Para pruebas y para la composición de pruebas. */
export class AlmacenEnMemoria {
  private tablas: Tablas = AlmacenEnMemoria.vacias()

  private static vacias(): Tablas {
    return {
      productos: new Map(),
      categorias: new Map(),
      operaciones: new Map(),
      existencias: new Map(),
      resumenes: new Map(),
      configuracion: new Map(),
      avisos: new Map(),
      listaDeCompras: new Map(),
      conteo: new Map(),
      fotos: new Map(),
    }
  }

  guardar<K extends NombreDeTabla>(tabla: K, registro: TablasDeLaApp[K]): void {
    const clave = String(registro[CLAVE_DE_TABLA[tabla] as keyof TablasDeLaApp[K]])
    this.tablas[tabla].set(clave, copiar(registro))
  }

  obtener<K extends NombreDeTabla>(tabla: K, clave: string): TablasDeLaApp[K] | undefined {
    const registro = this.tablas[tabla].get(clave)
    return registro === undefined ? undefined : copiar(registro)
  }

  todos<K extends NombreDeTabla>(tabla: K): TablasDeLaApp[K][] {
    return [...this.tablas[tabla].values()].map(copiar)
  }

  eliminar<K extends NombreDeTabla>(tabla: K, clave: string): void {
    this.tablas[tabla].delete(clave)
  }

  vaciar<K extends NombreDeTabla>(tabla: K): void {
    this.tablas[tabla].clear()
  }

  /** Copia superficial de todas las tablas (los registros nunca se mutan en sitio). */
  instantanea(): Tablas {
    const copia = AlmacenEnMemoria.vacias()
    for (const nombre of Object.keys(this.tablas) as NombreDeTabla[]) {
      ;(copia[nombre] as Map<string, unknown>) = new Map(this.tablas[nombre] as Map<string, unknown>)
    }
    return copia
  }

  restaurar(instantanea: Tablas): void {
    this.tablas = instantanea
  }
}

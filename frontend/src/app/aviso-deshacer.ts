import { inject, ref, type InjectionKey, type Ref } from 'vue'

export interface OpcionesAvisoDeshacer {
  mensaje: string
  segundos?: number
  alDeshacer: () => void
}

export interface ContextoAvisoDeshacer {
  activo: Ref<OpcionesAvisoDeshacer | undefined>
  mostrar: (opciones: OpcionesAvisoDeshacer) => void
  cerrar: () => void
}

/** LayoutApp provee este contexto para que cualquier pantalla pueda pedir un aviso Deshacer global (RN-OP-18). */
export const CLAVE_AVISO_DESHACER: InjectionKey<ContextoAvisoDeshacer> = Symbol('aviso-deshacer')

export function crearContextoAvisoDeshacer(): ContextoAvisoDeshacer {
  const activo = ref<OpcionesAvisoDeshacer>()
  return {
    activo,
    mostrar(opciones: OpcionesAvisoDeshacer) {
      activo.value = opciones
    },
    cerrar() {
      activo.value = undefined
    },
  }
}

export function useAvisoDeshacer(): ContextoAvisoDeshacer {
  const contexto = inject(CLAVE_AVISO_DESHACER)
  if (!contexto) throw new Error('useAvisoDeshacer debe usarse dentro de LayoutApp')
  return contexto
}

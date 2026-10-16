import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './shared/ui/estilos/tokens.css'
import './shared/ui/estilos/base.css'

import { createApp, type App as AppDeVue } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { arrancar } from './app/arranque'
import { useEstadoGlobal } from './app/estado-global'
import { exponerAplicacionParaPruebas } from './app/ganchos-de-prueba'
import { crearInfraestructuraDelNavegador } from './app/infraestructura-navegador'
import { motivoDelError, type MotivoSinDatos } from './app/motivo-sin-datos'
import { proveerAplicacion } from './app/proveer-aplicacion'
import { escucharRutasDeNotificaciones } from './app/rutas-de-notificaciones'
import PantallaSinDatos from './app/vistas/PantallaSinDatos.vue'
import {
  aplicarTamanoDeLetra,
  leerTamanoDeLetraGuardado,
} from './shared/ui/preferencias/tamano-de-letra'

// La copia rápida de la letra, antes de abrir la base: sin parpadeo. Después manda la
// configuración de la tienda (abrirApp y el estado global).
aplicarTamanoDeLetra(leerTamanoDeLetraGuardado())

/** Lo montado en #app (la app o la pantalla sin datos): se reemplaza si hace falta. */
let montada: AppDeVue | null = null

function mostrarPantallaSinDatos(motivo: MotivoSinDatos): void {
  montada?.unmount()
  montada = createApp(PantallaSinDatos, { motivo })
  montada.mount('#app')
}

void arrancar({
  crearInfraestructura: () =>
    crearInfraestructuraDelNavegador(undefined, {
      // Otra pestaña abrió una versión más nueva: esta ya no puede seguir con la base vieja.
      alActualizarseLaBase: () => mostrarPantallaSinDatos('actualizada'),
    }),
  montar(aplicacion, inicio) {
    const app = createApp(App)
    const pinia = createPinia()
    app.use(pinia)
    app.use(router)
    app.use(proveerAplicacion(aplicacion))
    useEstadoGlobal(pinia).conectar(aplicacion, inicio)
    escucharRutasDeNotificaciones(router)
    exponerAplicacionParaPruebas(aplicacion)
    app.mount('#app')
    montada = app
  },
  mostrarError(error) {
    console.error('No se pudieron abrir los datos de la app:', error)
    mostrarPantallaSinDatos(motivoDelError(error))
  },
})

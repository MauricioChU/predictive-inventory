import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './shared/ui/estilos/tokens.css'
import './shared/ui/estilos/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { arrancar } from './app/arranque'
import { useEstadoGlobal } from './app/estado-global'
import { exponerAplicacionParaPruebas } from './app/ganchos-de-prueba'
import { crearInfraestructuraDelNavegador } from './app/infraestructura-navegador'
import { proveerAplicacion } from './app/proveer-aplicacion'
import { escucharRutasDeNotificaciones } from './app/rutas-de-notificaciones'
import ErrorDeArranque from './app/vistas/ErrorDeArranque.vue'
import {
  aplicarTamanoDeLetra,
  leerTamanoDeLetraGuardado,
} from './shared/ui/preferencias/tamano-de-letra'

// La copia rápida de la letra, antes de abrir la base: sin parpadeo. Después manda la
// configuración de la tienda (abrirApp y el estado global).
aplicarTamanoDeLetra(leerTamanoDeLetraGuardado())

void arrancar({
  crearInfraestructura: () => crearInfraestructuraDelNavegador(),
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
  },
  mostrarError(error) {
    console.error('No se pudieron abrir los datos de la app:', error)
    createApp(ErrorDeArranque).mount('#app')
  },
})

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
import { crearMontaje } from './app/montaje'
import { motivoDelError } from './app/motivo-sin-datos'
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

/** Lo montado en #app (la app o la pantalla sin datos) y cuándo se reemplaza: `crearMontaje`. */
const montaje = crearMontaje({
  montarApp(aplicacion, inicio) {
    const app = createApp(App)
    const pinia = createPinia()
    app.use(pinia)
    app.use(router)
    app.use(proveerAplicacion(aplicacion))
    const desconectarEstado = useEstadoGlobal(pinia).conectar(aplicacion, inicio)
    const dejarDeEscucharRutas = escucharRutasDeNotificaciones(router)
    const retirarGancho = exponerAplicacionParaPruebas(aplicacion)
    app.mount('#app')
    return () => {
      // Sin suscripciones al bus, re-evaluaciones pendientes ni ganchos de una aplicación cuya
      // base ya se cerró.
      desconectarEstado()
      aplicacion.detener()
      dejarDeEscucharRutas()
      retirarGancho()
      app.unmount()
    }
  },
  montarSinDatos(motivo) {
    const pantalla = createApp(PantallaSinDatos, { motivo })
    pantalla.mount('#app')
    return () => pantalla.unmount()
  },
})

void arrancar({
  crearInfraestructura: () =>
    crearInfraestructuraDelNavegador(undefined, {
      // Otra pestaña abrió una versión más nueva: esta ya no puede seguir con la base vieja.
      alActualizarseLaBase: () => montaje.seActualizoLaBase(),
    }),
  montar: (aplicacion, inicio) => montaje.montarApp(aplicacion, inicio),
  mostrarError(error) {
    console.error('No se pudieron abrir los datos de la app:', error)
    montaje.mostrarError(motivoDelError(error))
  },
})

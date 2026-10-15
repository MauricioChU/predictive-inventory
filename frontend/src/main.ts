import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './shared/ui/estilos/tokens.css'
import './shared/ui/estilos/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import {
  aplicarTamanoDeLetra,
  leerTamanoDeLetraGuardado,
} from './shared/ui/preferencias/tamano-de-letra'

aplicarTamanoDeLetra(leerTamanoDeLetraGuardado())

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

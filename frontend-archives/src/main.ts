import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { configurarApi } from './api/client'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const auth = useAuthStore(pinia)
configurarApi({
  token: () => auth.token,
  noAutorizado: () => {
    auth.cerrarSesion()
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  },
  cambioPassword: () => router.push({ name: 'cambiar-password' }),
})

app.mount('#app')

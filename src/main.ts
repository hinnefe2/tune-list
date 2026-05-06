import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

import App from './App.vue'
import { router } from './router'
import { primevueOptions } from './primevue'
import { useAuthStore } from './stores/auth'

import 'primeicons/primeicons.css'
import './style.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(PrimeVue, primevueOptions)
  app.use(ToastService)
  app.use(ConfirmationService)

  // Resolve session before mounting so the router guard sees it on first navigation.
  await useAuthStore().init()

  app.use(router)
  app.mount('#app')
}

bootstrap()

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)

async function entrar() {
  error.value = ''
  cargando.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const destino =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/'
    router.push(auth.usuario?.debeCambiarPassword ? { name: 'cambiar-password' } : destino)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div
    class="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/40"
  >
    <div class="absolute right-4 top-4"><ThemeToggle /></div>
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <span
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow dark:bg-emerald-500 dark:text-slate-950"
          ><Icon name="archive" class="!h-6 !w-6"
        /></span>
        <h1 class="text-xl font-semibold">Archivo y Correspondencia</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Gobierno Autónomo Municipal</p>
      </div>
      <form class="card card-pad space-y-4" @submit.prevent="entrar">
        <div>
          <label class="label" for="u">Usuario</label>
          <input
            id="u"
            v-model="username"
            class="input"
            autocomplete="username"
            required
            autofocus
          />
        </div>
        <div>
          <label class="label" for="p">Contraseña</label>
          <input
            id="p"
            v-model="password"
            type="password"
            class="input"
            autocomplete="current-password"
            required
          />
        </div>
        <p
          v-if="error"
          class="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          role="alert"
        >
          <Icon name="alert" class="!h-4 !w-4 mt-0.5" /> {{ error }}
        </p>
        <button class="btn-primary w-full" :disabled="cargando">
          {{ cargando ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
      <p class="mt-4 text-center text-xs text-slate-500">
        Ley N° 2341 · Ley N° 1178 · Normativa ABNB
      </p>
    </div>
  </div>
</template>

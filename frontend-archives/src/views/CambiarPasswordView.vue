<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const actual = ref(''),
  nueva = ref(''),
  repetir = ref('')
const error = ref(''),
  cargando = ref(false)
const valida = computed(() => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(nueva.value))

async function guardar() {
  error.value = ''
  if (nueva.value !== repetir.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }
  cargando.value = true
  try {
    await api.post('/auth/cambiar-password', { actual: actual.value, nueva: nueva.value })
    if (auth.usuario) auth.usuario.debeCambiarPassword = false
    toast.ok('Contraseña actualizada')
    router.push({ name: 'dashboard' })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}
function salir() {
  auth.cerrarSesion()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center px-4">
    <div class="absolute right-4 top-4"><ThemeToggle /></div>
    <form class="card card-pad w-full max-w-sm space-y-4" @submit.prevent="guardar">
      <div>
        <h1 class="text-lg font-semibold">Cambie su contraseña</h1>
        <p v-if="auth.usuario?.debeCambiarPassword" class="hint">
          Por seguridad, debe definir una contraseña personal antes de continuar.
        </p>
      </div>
      <div>
        <label class="label" for="a">Contraseña actual</label
        ><input
          id="a"
          v-model="actual"
          type="password"
          class="input"
          autocomplete="current-password"
          required
        />
      </div>
      <div>
        <label class="label" for="n">Nueva contraseña</label>
        <input
          id="n"
          v-model="nueva"
          type="password"
          class="input"
          autocomplete="new-password"
          required
        />
        <p class="hint" :class="nueva && !valida && 'text-rose-600'">
          Mínimo 8 caracteres, con letras y números.
        </p>
      </div>
      <div>
        <label class="label" for="r">Repita la nueva contraseña</label
        ><input
          id="r"
          v-model="repetir"
          type="password"
          class="input"
          autocomplete="new-password"
          required
        />
      </div>
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <div class="flex gap-2">
        <button class="btn-primary flex-1" :disabled="cargando || !valida">Guardar</button>
        <button type="button" class="btn-ghost" @click="salir">Salir</button>
      </div>
    </form>
  </div>
</template>

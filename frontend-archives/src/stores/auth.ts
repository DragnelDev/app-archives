import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { Rol } from '@/utils/ui'

export interface Usuario {
  id: number
  username: string
  nombres: string
  apellidos: string
  cargo?: string
  email?: string
  rol: Rol
  unidadId: number
  unidadNombre: string
  unidadSigla: string
  debeCambiarPassword: boolean
}

const KEY = 'token'

export const useAuthStore = defineStore('auth', () => {
  // sessionStorage: la sesión se cierra al cerrar la pestaña (equipos compartidos en ventanilla)
  const token = ref<string | null>(sessionStorage.getItem(KEY))
  const usuario = ref<Usuario | null>(null)
  const cargado = ref(false)

  const rol = computed(() => usuario.value?.rol)
  const nombre = computed(() =>
    usuario.value ? `${usuario.value.nombres} ${usuario.value.apellidos}` : '',
  )
  const tiene = (...roles: Rol[]) => !!rol.value && roles.includes(rol.value)

  async function login(username: string, password: string) {
    const r = await api.post<{ accessToken: string; usuario: Usuario }>('/auth/login', {
      username,
      password,
    })
    token.value = r.accessToken
    sessionStorage.setItem(KEY, r.accessToken)
    usuario.value = r.usuario
    cargado.value = true
  }

  async function cargarPerfil() {
    if (!token.value) {
      cargado.value = true
      return
    }
    try {
      usuario.value = await api.get<Usuario>('/auth/me')
    } catch {
      cerrarSesion()
    }
    cargado.value = true
  }

  function cerrarSesion() {
    token.value = null
    usuario.value = null
    sessionStorage.removeItem(KEY)
  }

  return { token, usuario, cargado, rol, nombre, tiene, login, cargarPerfil, cerrarSesion }
})

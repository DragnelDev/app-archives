<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useAuthStore } from '@/stores/auth'
import { ROLES, type Rol } from '@/utils/ui'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const menuAbierto = ref(false)

interface Item {
  to: string
  label: string
  icon: string
  roles?: Rol[]
  exacto?: boolean
}
const R = {
  ADMIN: 'ROLE_ADMIN',
  VEN: 'ROLE_VENTANILLA',
  JEFE: 'ROLE_JEFE',
  TEC: 'ROLE_TECNICO',
  ARC: 'ROLE_ARCHIVISTA',
} as const
const principal: Item[] = [
  { to: '/', label: 'Inicio', icon: 'home', exacto: true },
  { to: '/hojas-ruta/nueva', label: 'Nueva Hoja de Ruta', icon: 'plus', roles: [R.VEN] },
  { to: '/bandeja', label: 'Correspondencia', icon: 'inbox' },
  { to: '/expedientes', label: 'Expedientes', icon: 'folder' },
  {
    to: '/archivo/transferencias',
    label: 'Transferencias',
    icon: 'archive',
    roles: [R.JEFE, R.TEC, R.ARC, R.ADMIN],
  },
  { to: '/archivo/topografia', label: 'Topografía de archivo', icon: 'pin' },
]
const admin: Item[] = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: 'users', roles: [R.ADMIN] },
  { to: '/admin/unidades', label: 'Unidades', icon: 'building', roles: [R.ADMIN] },
  { to: '/admin/series', label: 'Cuadro de clasificación', icon: 'tag', roles: [R.ADMIN] },
  { to: '/admin/auditoria', label: 'Auditoría', icon: 'shield', roles: [R.ADMIN] },
]
const visibles = (xs: Item[]) => xs.filter((i) => !i.roles || auth.tiene(...i.roles))
const itemsPrincipal = computed(() => visibles(principal))
const itemsAdmin = computed(() => visibles(admin))

const iniciales = computed(() =>
  auth.usuario ? (auth.usuario.nombres[0]! + auth.usuario.apellidos[0]!).toUpperCase() : '',
)
watch(
  () => route.fullPath,
  () => {
    menuAbierto.value = false
  },
)

function salir() {
  auth.cerrarSesion()
  router.push({ name: 'login' })
}
const enlace =
  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
const activo =
  'router-link-active !bg-emerald-50 !text-emerald-800 dark:!bg-emerald-500/10 dark:!text-emerald-300'
</script>

<template>
  <div class="min-h-screen lg:pl-64">
    <div
      v-if="menuAbierto"
      class="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
      @click="menuAbierto = false"
    />
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0"
      :class="menuAbierto && '!translate-x-0'"
    >
      <div class="flex items-center gap-3 px-5 py-4">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-950"
          ><Icon name="archive"
        /></span>
        <div class="leading-tight">
          <p class="text-sm font-semibold">Archivo y Correspondencia</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Gobierno Autónomo Municipal</p>
        </div>
      </div>
      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Navegación principal">
        <RouterLink
          v-for="i in itemsPrincipal"
          :key="i.to"
          :to="i.to"
          :class="enlace"
          :active-class="i.exacto ? '' : activo"
          :exact-active-class="i.exacto ? activo : ''"
        >
          <Icon :name="i.icon" /> {{ i.label }}
        </RouterLink>
        <template v-if="itemsAdmin.length">
          <p
            class="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
          >
            Administración
          </p>
          <RouterLink
            v-for="i in itemsAdmin"
            :key="i.to"
            :to="i.to"
            :class="enlace"
            :active-class="activo"
            ><Icon :name="i.icon" /> {{ i.label }}</RouterLink
          >
        </template>
      </nav>
      <div class="border-t border-slate-200 p-3 dark:border-slate-800">
        <div class="flex items-center gap-3 rounded-lg px-2 py-2">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
            >{{ iniciales }}</span
          >
          <div class="min-w-0 flex-1 leading-tight">
            <p class="truncate text-sm font-medium">{{ auth.nombre }}</p>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">
              {{ auth.rol && ROLES[auth.rol] }} · {{ auth.usuario?.unidadSigla }}
            </p>
          </div>
          <button
            type="button"
            class="btn-ghost !p-2"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            @click="salir"
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </aside>

    <div class="flex min-h-screen flex-col">
      <header
        class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 sm:px-6"
      >
        <button
          type="button"
          class="btn-ghost !p-2 lg:hidden"
          aria-label="Abrir menú"
          @click="menuAbierto = true"
        >
          <Icon name="menu" />
        </button>
        <h1 class="flex-1 truncate text-base font-semibold">{{ route.meta.titulo }}</h1>
        <ThemeToggle />
      </header>
      <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6"><RouterView /></main>
    </div>
  </div>
</template>

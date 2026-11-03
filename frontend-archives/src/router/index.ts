import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Rol } from '@/utils/ui'

declare module 'vue-router' {
  interface RouteMeta {
    publica?: boolean
    roles?: Rol[]
    titulo?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { publica: true, titulo: 'Ingresar' },
    },
    {
      path: '/cambiar-password',
      name: 'cambiar-password',
      component: () => import('@/views/CambiarPasswordView.vue'),
      meta: { titulo: 'Cambiar contraseña' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { titulo: 'Inicio' },
        },
        {
          path: 'bandeja',
          name: 'bandeja',
          component: () => import('@/views/BandejaView.vue'),
          meta: { titulo: 'Bandeja de correspondencia' },
        },
        {
          path: 'hojas-ruta/nueva',
          name: 'hr-nueva',
          component: () => import('@/views/HojaRutaNuevaView.vue'),
          meta: { roles: ['ROLE_VENTANILLA'], titulo: 'Nueva Hoja de Ruta' },
        },
        {
          path: 'hojas-ruta/:id',
          name: 'hr-detalle',
          component: () => import('@/views/HojaRutaDetalleView.vue'),
          props: true,
          meta: { titulo: 'Hoja de Ruta' },
        },
        {
          path: 'expedientes',
          name: 'expedientes',
          component: () => import('@/views/ExpedientesView.vue'),
          meta: {
            roles: [
              'ROLE_JEFE',
              'ROLE_TECNICO',
              'ROLE_VENTANILLA',
              'ROLE_ARCHIVISTA',
              'ROLE_ADMIN',
            ],
            titulo: 'Expedientes',
          },
        },
        {
          path: 'expedientes/:id',
          name: 'expediente',
          component: () => import('@/views/ExpedienteView.vue'),
          props: true,
          meta: { titulo: 'Expediente' },
        },
        {
          path: 'archivo/transferencias',
          name: 'transferencias',
          component: () => import('@/views/TransferenciasView.vue'),
          meta: {
            roles: ['ROLE_JEFE', 'ROLE_TECNICO', 'ROLE_ARCHIVISTA', 'ROLE_ADMIN'],
            titulo: 'Transferencias documentales',
          },
        },
        {
          path: 'archivo/topografia',
          name: 'topografia',
          component: () => import('@/views/TopografiaView.vue'),
          meta: { titulo: 'Topografía del Archivo Central' },
        },
        {
          path: 'admin/usuarios',
          name: 'admin-usuarios',
          component: () => import('@/views/admin/UsuariosView.vue'),
          meta: { roles: ['ROLE_ADMIN'], titulo: 'Usuarios' },
        },
        {
          path: 'admin/unidades',
          name: 'admin-unidades',
          component: () => import('@/views/admin/UnidadesView.vue'),
          meta: { roles: ['ROLE_ADMIN'], titulo: 'Unidades organizacionales' },
        },
        {
          path: 'admin/series',
          name: 'admin-series',
          component: () => import('@/views/admin/SeriesView.vue'),
          meta: { roles: ['ROLE_ADMIN'], titulo: 'Cuadro de Clasificación (ICA)' },
        },
        {
          path: 'admin/auditoria',
          name: 'admin-auditoria',
          component: () => import('@/views/admin/AuditoriaView.vue'),
          meta: { roles: ['ROLE_ADMIN'], titulo: 'Auditoría' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.cargado) await auth.cargarPerfil()
  if (to.meta.publica) return auth.usuario && to.name === 'login' ? { name: 'dashboard' } : true
  if (!auth.usuario)
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  if (auth.usuario.debeCambiarPassword && to.name !== 'cambiar-password')
    return { name: 'cambiar-password' }
  if (to.meta.roles && !auth.tiene(...to.meta.roles)) return { name: 'dashboard' }
  return true
})

router.afterEach((to) => {
  document.title = `${to.meta.titulo ?? 'Archivo'} · GAM`
})

export default router

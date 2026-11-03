<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api/client'
import AdminCrud, { type Campo } from '@/components/AdminCrud.vue'
import Modal from '@/components/Modal.vue'
import { useToastStore } from '@/stores/toast'
import { ROLES, fechaHora } from '@/utils/ui'

const toast = useToastStore()
const unidades = ref<{ value: number; label: string }[]>([])
const temporal = ref<{ usuario: string; clave: string } | null>(null)
onMounted(async () => {
  unidades.value = (await api.get('/catalogos/unidades')).map((u: any) => ({
    value: u.id,
    label: `${u.sigla} · ${u.nombre}`,
  }))
})

const columnas = [
  { key: 'username', label: 'Usuario', clase: 'font-mono text-xs' },
  {
    key: 'apellidos',
    label: 'Funcionario',
    formato: (_: string, f: any) => `${f.apellidos}, ${f.nombres}`,
  },
  { key: 'rol', label: 'Rol', formato: (v: keyof typeof ROLES) => ROLES[v] },
  { key: 'unidadSigla', label: 'Unidad' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'ultimoAcceso', label: 'Último acceso', formato: (v: string) => fechaHora(v) },
  {
    key: 'activo',
    label: 'Estado',
    formato: (v: boolean, f: any) => (!v ? 'Inactivo' : f.bloqueado ? 'Bloqueado' : 'Activo'),
  },
]
const campos = (): Campo[] => [
  { key: 'username', label: 'Usuario', requerido: true, soloCrear: true, max: 50 },
  {
    key: 'password',
    label: 'Contraseña inicial',
    tipo: 'password',
    requerido: true,
    soloCrear: true,
  },
  { key: 'nombres', label: 'Nombres', requerido: true, max: 100 },
  { key: 'apellidos', label: 'Apellidos', requerido: true, max: 100 },
  { key: 'ci', label: 'C.I.', max: 20 },
  { key: 'email', label: 'Correo electrónico', tipo: 'email' },
  { key: 'cargo', label: 'Cargo', max: 120, ancho: 'completo' },
  {
    key: 'rol',
    label: 'Rol',
    tipo: 'select',
    requerido: true,
    opciones: Object.entries(ROLES).map(([value, label]) => ({ value, label })),
  },
  { key: 'unidadId', label: 'Unidad', tipo: 'select', requerido: true, opciones: unidades.value },
  { key: 'activo', label: 'Usuario activo', tipo: 'checkbox', soloEditar: true },
]

async function resetear(f: any, recargar: () => void) {
  if (!confirm(`¿Restablecer la contraseña de ${f.username}? Se generará una clave temporal.`))
    return
  try {
    const r = await api.post(`/admin/usuarios/${f.id}/restablecer-password`)
    temporal.value = { usuario: f.username, clave: r.passwordTemporal }
    recargar()
  } catch (e) {
    toast.error((e as Error).message)
  }
}
</script>

<template>
  <AdminCrud
    endpoint="/admin/usuarios"
    singular="usuario"
    :columnas="columnas"
    :campos="campos()"
    :busqueda="['username', 'nombres', 'apellidos', 'cargo', 'unidadSigla']"
  >
    <template #acciones="{ fila, recargar }"
      ><button class="btn-ghost btn-sm" @click="resetear(fila, recargar)">
        Restablecer clave
      </button></template
    >
  </AdminCrud>
  <Modal :abierto="!!temporal" titulo="Contraseña temporal" @cerrar="temporal = null">
    <p class="text-sm">
      Entregue esta clave a <b>{{ temporal?.usuario }}</b
      >. Se muestra una sola vez y deberá cambiarla al ingresar.
    </p>
    <p
      class="mt-3 select-all rounded-lg bg-slate-100 p-3 text-center font-mono text-lg tracking-wide dark:bg-slate-800"
    >
      {{ temporal?.clave }}
    </p>
    <template #pie
      ><button class="btn-primary" @click="temporal = null">Entendido</button></template
    >
  </Modal>
</template>

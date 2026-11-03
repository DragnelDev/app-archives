<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api/client'
import AdminCrud, { type Campo } from '@/components/AdminCrud.vue'
import { etiqueta } from '@/utils/ui'

const padres = ref<{ value: number; label: string }[]>([])
onMounted(async () => {
  padres.value = (await api.get('/catalogos/unidades')).map((u: any) => ({
    value: u.id,
    label: `${u.sigla} · ${u.nombre}`,
  }))
})
const columnas = [
  { key: 'codigo', label: 'Código', clase: 'font-mono text-xs' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'sigla', label: 'Sigla' },
  { key: 'tipo', label: 'Tipo', formato: (v: string) => etiqueta(v) },
  { key: 'padreSigla', label: 'Depende de' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'activo', label: 'Estado', formato: (v: boolean) => (v ? 'Activa' : 'Inactiva') },
]
const campos = (): Campo[] => [
  { key: 'codigo', label: 'Código', requerido: true, max: 20 },
  { key: 'sigla', label: 'Sigla', requerido: true, max: 20 },
  { key: 'nombre', label: 'Nombre', requerido: true, max: 200, ancho: 'completo' },
  {
    key: 'tipo',
    label: 'Tipo',
    tipo: 'select',
    requerido: true,
    opciones: ['DESPACHO', 'SECRETARIA', 'DIRECCION', 'UNIDAD', 'ARCHIVO', 'VENTANILLA'].map(
      (v) => ({ value: v, label: etiqueta(v) }),
    ),
  },
  {
    key: 'padreId',
    label: 'Depende de',
    tipo: 'select',
    opciones: padres.value,
    vacio: 'Ninguna (nivel superior)',
  },
  { key: 'activo', label: 'Unidad activa', tipo: 'checkbox' },
]
</script>

<template>
  <AdminCrud
    endpoint="/admin/unidades"
    singular="unidad"
    :columnas="columnas"
    :campos="campos()"
    :busqueda="['codigo', 'nombre', 'sigla']"
  />
</template>

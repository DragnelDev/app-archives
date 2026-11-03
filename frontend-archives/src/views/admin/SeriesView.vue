<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api/client'
import AdminCrud, { type Campo } from '@/components/AdminCrud.vue'
import { etiqueta } from '@/utils/ui'

const unidades = ref<{ value: number; label: string }[]>([])
onMounted(async () => {
  unidades.value = (await api.get('/catalogos/unidades')).map((u: any) => ({
    value: u.id,
    label: `${u.sigla} · ${u.nombre}`,
  }))
})
const columnas = [
  { key: 'codigo', label: 'Código', clase: 'font-mono text-xs' },
  { key: 'nombre', label: 'Serie documental' },
  { key: 'unidadSigla', label: 'Unidad' },
  {
    key: 'retencionGestionAnios',
    label: 'Archivo de Gestión',
    formato: (v: number) => `${v} años`,
  },
  { key: 'retencionCentralAnios', label: 'Archivo Central', formato: (v: number) => `${v} años` },
  { key: 'disposicionFinal', label: 'Disposición final', formato: (v: string) => etiqueta(v) },
  { key: 'activo', label: 'Estado', formato: (v: boolean) => (v ? 'Vigente' : 'Inactiva') },
]
const campos = (): Campo[] => [
  { key: 'codigo', label: 'Código', requerido: true, max: 30 },
  {
    key: 'unidadId',
    label: 'Unidad productora',
    tipo: 'select',
    opciones: unidades.value,
    vacio: 'Transversal / todas',
  },
  { key: 'nombre', label: 'Nombre de la serie', requerido: true, max: 200, ancho: 'completo' },
  { key: 'descripcion', label: 'Descripción / alcance', tipo: 'textarea' },
  {
    key: 'retencionGestionAnios',
    label: 'Retención en Archivo de Gestión (años)',
    tipo: 'number',
    requerido: true,
    min: 0,
  },
  {
    key: 'retencionCentralAnios',
    label: 'Retención en Archivo Central (años)',
    tipo: 'number',
    requerido: true,
    min: 0,
  },
  {
    key: 'disposicionFinal',
    label: 'Disposición final',
    tipo: 'select',
    requerido: true,
    ancho: 'completo',
    opciones: ['CONSERVACION_PERMANENTE', 'MUESTREO', 'ELIMINACION'].map((v) => ({
      value: v,
      label: etiqueta(v),
    })),
  },
  { key: 'activo', label: 'Serie vigente', tipo: 'checkbox' },
]
</script>

<template>
  <AdminCrud
    endpoint="/admin/series"
    singular="serie"
    :columnas="columnas"
    :campos="campos()"
    :busqueda="['codigo', 'nombre']"
  />
</template>

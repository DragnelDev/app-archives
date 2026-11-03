<script setup lang="ts">
import Icon from './Icon.vue'
import { fecha, fechaHora, plazo } from '@/utils/ui'

defineProps<{ movimientos: any[]; cadenaIntegra?: boolean }>()

const ICONO: Record<string, string> = {
  REGISTRO: 'inbox',
  DERIVACION: 'arrow',
  DEVOLUCION: 'arrow',
  CONCLUSION: 'check',
  ARCHIVO: 'archive',
}
const COLOR: Record<string, string> = {
  REGISTRO: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  DERIVACION: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  DEVOLUCION: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  CONCLUSION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ARCHIVO: 'bg-slate-200 text-slate-700 dark:bg-slate-600/30 dark:text-slate-200',
}
const TITULO: Record<string, string> = {
  REGISTRO: 'Registro en Ventanilla',
  DERIVACION: 'Derivación',
  DEVOLUCION: 'Devolución / informe',
  CONCLUSION: 'Trámite concluido',
  ARCHIVO: 'Archivado',
}
</script>

<template>
  <div>
    <ol class="relative ml-4 space-y-5 border-l border-slate-200 dark:border-slate-700">
      <li v-for="(m, i) in movimientos" :key="m.id" class="ml-6">
        <span
          class="absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900"
          :class="COLOR[m.accion]"
        >
          <Icon :name="ICONO[m.accion] ?? 'arrow'" class="!h-4 !w-4" />
        </span>
        <div class="flex flex-wrap items-baseline justify-between gap-x-3">
          <h4 class="text-sm font-semibold">
            {{ TITULO[m.accion] ?? m.accion }}
            <span class="font-normal text-slate-400">· pase {{ m.orden }}</span>
          </h4>
          <time class="text-xs text-slate-500 dark:text-slate-400">{{
            fechaHora(m.fechaEnvio)
          }}</time>
        </div>
        <p class="mt-0.5 text-sm">
          <span class="font-medium">{{ m.remitenteNombre }}</span>
          <span class="text-slate-500 dark:text-slate-400"> ({{ m.remitenteUnidad }})</span>
          <template v-if="m.destinatarioNombre && m.accion !== 'REGISTRO'">
            <Icon name="arrow" class="mx-1 inline !h-3.5 !w-3.5 text-slate-400" />
            <span class="font-medium">{{ m.destinatarioNombre }}</span>
            <span class="text-slate-500 dark:text-slate-400"> ({{ m.destinatarioUnidad }})</span>
          </template>
        </p>
        <blockquote
          class="mt-1.5 rounded-md border-l-2 border-emerald-500 bg-slate-50 px-3 py-1.5 text-sm italic text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
        >
          “{{ m.proveido }}”
        </blockquote>
        <div
          class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"
        >
          <span v-if="m.fechaLimite" class="inline-flex items-center gap-1"
            ><Icon name="clock" class="!h-3.5 !w-3.5" /> Plazo: {{ fecha(m.fechaLimite) }} ({{
              m.plazoDias
            }}
            d hábiles)</span
          >
          <span v-if="m.accion !== 'REGISTRO' && m.destinatarioNombre">
            <template v-if="m.fechaRecepcion"
              >Recepcionado {{ fechaHora(m.fechaRecepcion) }}</template
            >
            <span
              v-else-if="i === movimientos.length - 1"
              class="badge bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30"
              >Pendiente de recepción</span
            >
          </span>
          <code
            class="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-slate-800"
            title="Huella encadenada del pase"
            >#{{ m.hashCorto }}</code
          >
        </div>
      </li>
    </ol>
    <p
      v-if="cadenaIntegra !== undefined"
      class="mt-4 flex items-center gap-1.5 text-xs"
      :class="cadenaIntegra ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'"
    >
      <Icon :name="cadenaIntegra ? 'shield' : 'alert'" class="!h-4 !w-4" />
      {{
        cadenaIntegra
          ? 'Historial inalterado: la cadena de huellas es íntegra.'
          : '¡ATENCIÓN! La cadena de huellas del historial no coincide: posible manipulación.'
      }}
    </p>
  </div>
</template>

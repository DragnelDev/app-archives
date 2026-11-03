<script setup lang="ts">
import { RouterLink } from 'vue-router'
defineProps<{
  etiqueta: string
  valor: number | string
  tono?: 'neutral' | 'ok' | 'aviso' | 'peligro'
  enlace?: string
}>()
const BARRA = {
  neutral: 'bg-slate-300 dark:bg-slate-600',
  ok: 'bg-emerald-500',
  aviso: 'bg-amber-500',
  peligro: 'bg-rose-500',
}
const NUM = {
  neutral: '',
  ok: 'text-emerald-700 dark:text-emerald-400',
  aviso: 'text-amber-700 dark:text-amber-400',
  peligro: 'text-rose-700 dark:text-rose-400',
}
</script>

<template>
  <component
    :is="enlace ? RouterLink : 'div'"
    :to="enlace"
    class="card relative block overflow-hidden p-4 transition"
    :class="enlace && 'hover:border-emerald-400 dark:hover:border-emerald-600'"
  >
    <span class="absolute inset-y-0 left-0 w-1" :class="BARRA[tono ?? 'neutral']" />
    <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ etiqueta }}</p>
    <p class="mt-1 text-3xl font-semibold tabular-nums" :class="NUM[tono ?? 'neutral']">
      {{ valor }}
    </p>
  </component>
</template>

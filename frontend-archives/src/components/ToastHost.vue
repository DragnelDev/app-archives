<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import Icon from './Icon.vue'
const toast = useToastStore()
const clase = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
  error:
    'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100',
  info: 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg"
        :class="clase[t.tipo]"
        role="status"
      >
        <Icon :name="t.tipo === 'error' ? 'alert' : 'check'" />
        <span class="flex-1">{{ t.texto }}</span>
        <button
          type="button"
          class="opacity-60 hover:opacity-100"
          aria-label="Cerrar"
          @click="toast.quitar(t.id)"
        >
          <Icon name="x" class="!h-4 !w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

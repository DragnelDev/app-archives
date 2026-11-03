<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ pagina: number; porPagina: number; total: number }>()
const emit = defineEmits<{ cambiar: [p: number] }>()
const paginas = computed(() => Math.max(1, Math.ceil(props.total / props.porPagina)))
const desde = computed(() => (props.total ? (props.pagina - 1) * props.porPagina + 1 : 0))
const hasta = computed(() => Math.min(props.total, props.pagina * props.porPagina))
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400"
  >
    <span>{{ desde }}–{{ hasta }} de {{ total }}</span>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="btn-secondary btn-sm"
        :disabled="pagina <= 1"
        @click="emit('cambiar', pagina - 1)"
      >
        Anterior
      </button>
      <span class="px-2">Pág. {{ pagina }} / {{ paginas }}</span>
      <button
        type="button"
        class="btn-secondary btn-sm"
        :disabled="pagina >= paginas"
        @click="emit('cambiar', pagina + 1)"
      >
        Siguiente
      </button>
    </div>
  </div>
</template>

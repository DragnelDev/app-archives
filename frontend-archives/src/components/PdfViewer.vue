<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { api } from '@/api/client'
import Icon from './Icon.vue'

/** Visor PDF integrado: obtiene el archivo con el token de sesión y lo muestra en línea (sin descarga local). */
const props = defineProps<{ documentoId: number | null }>()
const url = ref<string | null>(null)
const cargando = ref(false)
const error = ref('')

function liberar() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = null
}

watch(
  () => props.documentoId,
  async (id) => {
    liberar()
    error.value = ''
    if (!id) return
    cargando.value = true
    try {
      url.value = await api.blobUrl(`/documentos/${id}/archivo`)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      cargando.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(liberar)
</script>

<template>
  <div class="flex h-full min-h-[60vh] flex-col bg-slate-100 dark:bg-slate-950">
    <div
      v-if="cargando"
      class="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500"
    >
      <span
        class="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
      />
      Cargando documento…
    </div>
    <div
      v-else-if="error"
      class="m-4 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
    >
      <Icon name="alert" /> {{ error }}
    </div>
    <template v-else-if="url">
      <iframe
        :src="`${url}#toolbar=1&navpanes=0&view=FitH`"
        title="Visor de documento PDF"
        class="h-full min-h-[70vh] w-full flex-1 border-0"
      />
      <a
        :href="url"
        target="_blank"
        rel="noopener"
        class="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-emerald-700 hover:underline dark:border-slate-800 dark:bg-slate-900 dark:text-emerald-400"
        >¿No se visualiza? Abrir en una pestaña nueva</a
      >
    </template>
  </div>
</template>

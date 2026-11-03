<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(defineProps<{ abierto: boolean; titulo?: string; ancho?: string }>(), {
  ancho: 'max-w-3xl',
})
const emit = defineEmits<{ cerrar: [] }>()
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.abierto) emit('cerrar')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="abierto"
        class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px]"
        @click="emit('cerrar')"
      />
    </Transition>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-x-full"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-x-full"
    >
      <aside
        v-if="abierto"
        class="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        :class="ancho"
        role="dialog"
        aria-modal="true"
      >
        <header
          class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
        >
          <h2 class="truncate text-sm font-semibold">{{ titulo }}</h2>
          <button
            type="button"
            class="btn-ghost !p-1.5"
            aria-label="Cerrar panel"
            @click="emit('cerrar')"
          >
            <Icon name="x" />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto"><slot /></div>
      </aside>
    </Transition>
  </Teleport>
</template>

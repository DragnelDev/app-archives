<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(defineProps<{ abierto: boolean; titulo: string; ancho?: string }>(), {
  ancho: 'max-w-lg',
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
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="abierto"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[1px] sm:items-center"
        @mousedown.self="emit('cerrar')"
      >
        <div class="card w-full shadow-2xl" :class="ancho" role="dialog" aria-modal="true">
          <header
            class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800"
          >
            <h2 class="text-base font-semibold">{{ titulo }}</h2>
            <button
              type="button"
              class="btn-ghost !p-1.5"
              aria-label="Cerrar"
              @click="emit('cerrar')"
            >
              <Icon name="x" />
            </button>
          </header>
          <div class="px-5 py-4"><slot /></div>
          <footer
            v-if="$slots.pie"
            class="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800"
          >
            <slot name="pie" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

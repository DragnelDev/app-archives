<script setup lang="ts">
import Icon from './Icon.vue'
import { useThemeStore } from '@/stores/theme'
const tema = useThemeStore()
</script>

<template>
  <button
    type="button"
    class="btn-ghost !p-2"
    :title="tema.oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
    :aria-label="tema.oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
    @click="tema.alternar()"
  >
    <Icon :name="tema.oscuro ? 'sun' : 'moon'" />
  </button>
</template>

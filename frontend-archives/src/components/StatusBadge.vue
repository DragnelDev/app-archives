<script setup lang="ts">
import { ESTADO_CLASES, etiqueta } from '@/utils/ui'
defineProps<{ valor?: string | null }>()
</script>

<template>
  <span v-if="valor" class="badge" :class="ESTADO_CLASES[valor] ?? ESTADO_CLASES.NORMAL">{{
    etiqueta(valor)
  }}</span>
</template>

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  tipo: 'ok' | 'error' | 'info'
  texto: string
}

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([])
  let n = 0
  function mostrar(tipo: Toast['tipo'], texto: string, ms = 4500) {
    const id = ++n
    items.value.push({ id, tipo, texto })
    setTimeout(() => quitar(id), ms)
  }
  const quitar = (id: number) => {
    items.value = items.value.filter((t) => t.id !== id)
  }
  return {
    items,
    quitar,
    ok: (t: string) => mostrar('ok', t),
    error: (t: string) => mostrar('error', t, 7000),
    info: (t: string) => mostrar('info', t),
  }
})

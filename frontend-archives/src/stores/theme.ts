import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const oscuro = ref(document.documentElement.classList.contains('dark'))

  function aplicar() {
    document.documentElement.classList.toggle('dark', oscuro.value)
    try {
      localStorage.setItem('tema', oscuro.value ? 'oscuro' : 'claro')
    } catch {
      /* modo privado */
    }
  }
  function alternar() {
    oscuro.value = !oscuro.value
    aplicar()
  }

  return { oscuro, alternar }
})

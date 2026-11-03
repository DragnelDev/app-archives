<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import Paginacion from '@/components/Paginacion.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { etiqueta, fecha } from '@/utils/ui'

const router = useRouter()
const f = reactive({ estado: '', texto: '', pagina: 1 })
const datos = ref<{ items: any[]; total: number; porPagina: number }>({
  items: [],
  total: 0,
  porPagina: 20,
})
const cargando = ref(false)
let tmr: ReturnType<typeof setTimeout>

async function cargar() {
  cargando.value = true
  try {
    datos.value = await api.get('/expedientes', { estado: f.estado, q: f.texto, pagina: f.pagina })
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)
onBeforeUnmount(() => clearTimeout(tmr))
watch(
  () => f.estado,
  () => {
    f.pagina = 1
    cargar()
  },
)
watch(
  () => f.texto,
  () => {
    clearTimeout(tmr)
    tmr = setTimeout(() => {
      f.pagina = 1
      cargar()
    }, 300)
  },
)
</script>

<template>
  <div class="card">
    <div class="flex flex-wrap items-end gap-3 p-3">
      <div class="relative min-w-[14rem] flex-1">
        <Icon
          name="search"
          class="pointer-events-none absolute left-3 top-2.5 !h-4 !w-4 text-slate-400"
        />
        <input
          v-model="f.texto"
          type="search"
          class="input !pl-9"
          placeholder="Buscar por código o título…"
          aria-label="Buscar expedientes"
        />
      </div>
      <div>
        <label class="label" for="ee">Estado</label>
        <select id="ee" v-model="f.estado" class="input">
          <option value="">Todos</option>
          <option v-for="e in ['ABIERTO', 'CERRADO', 'TRANSFERIDO']" :key="e" :value="e">
            {{ etiqueta(e) }}
          </option>
        </select>
      </div>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Expediente</th>
            <th>Título</th>
            <th>Estado</th>
            <th>Unidad</th>
            <th>Serie</th>
            <th class="text-right">Fojas</th>
            <th>Apertura</th>
          </tr>
        </thead>
        <tbody :class="cargando && 'opacity-50'">
          <tr
            v-for="e in datos.items"
            :key="e.id"
            class="click"
            tabindex="0"
            @click="router.push(`/expedientes/${e.id}`)"
            @keydown.enter="router.push(`/expedientes/${e.id}`)"
          >
            <td class="whitespace-nowrap">
              <span
                class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >{{ e.codigo }}</span
              >
              <div class="text-xs text-slate-500">{{ e.hojaRutaCodigo }}</div>
            </td>
            <td class="max-w-sm">
              <div class="line-clamp-2">{{ e.titulo }}</div>
            </td>
            <td><StatusBadge :valor="e.estado" /></td>
            <td class="text-xs">{{ e.unidadSigla }}</td>
            <td class="text-xs">{{ e.serieCodigo || '—' }}</td>
            <td class="text-right tabular-nums">{{ e.totalFojas }}</td>
            <td class="whitespace-nowrap text-xs text-slate-500">{{ fecha(e.fechaApertura) }}</td>
          </tr>
          <tr v-if="!datos.items.length && !cargando">
            <td colspan="7" class="py-12 text-center text-slate-500">
              No hay expedientes. Se abren desde una Hoja de Ruta en trámite.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Paginacion
      :pagina="f.pagina"
      :por-pagina="datos.porPagina"
      :total="datos.total"
      @cambiar="
        (p) => {
          f.pagina = p
          cargar()
        }
      "
    />
  </div>
</template>

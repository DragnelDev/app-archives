<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import Paginacion from '@/components/Paginacion.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { ESTADO_CLASES, etiqueta, fecha, plazo } from '@/utils/ui'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const conBandeja = auth.tiene('ROLE_VENTANILLA', 'ROLE_JEFE', 'ROLE_TECNICO')
const pestanas = conBandeja
  ? [
      { k: 'mia', t: 'En mi bandeja' },
      { k: 'enviados', t: 'Enviados' },
      { k: 'vencidas', t: 'Vencidas' },
      { k: 'todas', t: 'Todas' },
    ]
  : [
      { k: 'todas', t: 'Todas' },
      { k: 'vencidas', t: 'Vencidas' },
    ]
const q = route.query
const f = reactive({
  bandeja: String(q.bandeja ?? pestanas[0]!.k),
  gestion: '' as string | number,
  estado: '',
  prioridad: '',
  texto: '',
  pagina: 1,
})
const datos = ref<{ items: any[]; total: number; porPagina: number }>({
  items: [],
  total: 0,
  porPagina: 20,
})
const gestiones = ref<number[]>([])
const cargando = ref(false)
const error = ref('')
let ctl: AbortController | null = null
let tmr: ReturnType<typeof setTimeout>

async function cargar() {
  ctl?.abort()
  ctl = new AbortController()
  cargando.value = true
  error.value = ''
  try {
    datos.value = await api.get(
      '/correspondencia',
      {
        bandeja: f.bandeja,
        gestion: f.gestion,
        estado: f.estado,
        prioridad: f.prioridad,
        q: f.texto,
        pagina: f.pagina,
      },
      ctl.signal,
    )
  } catch (e) {
    if ((e as Error).name !== 'AbortError') error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  gestiones.value = await api.get('/catalogos/gestiones')
  cargar()
})
onBeforeUnmount(() => {
  ctl?.abort()
  clearTimeout(tmr)
})
watch(
  () => [f.bandeja, f.gestion, f.estado, f.prioridad],
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
watch(
  () => route.query.bandeja,
  (v) => {
    if (typeof v === 'string' && v !== f.bandeja && pestanas.some((p) => p.k === v)) f.bandeja = v
  },
)
function pestana(k: string) {
  f.bandeja = k
  router.replace({ query: { bandeja: k } })
}
const hayFiltros = computed(() => f.gestion || f.estado || f.prioridad || f.texto)
function limpiar() {
  f.gestion = ''
  f.estado = ''
  f.prioridad = ''
  f.texto = ''
}
</script>

<template>
  <div class="card">
    <div class="flex flex-wrap gap-1 border-b border-slate-200 px-3 pt-2 dark:border-slate-800">
      <button
        v-for="p in pestanas"
        :key="p.k"
        type="button"
        class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition"
        :class="
          f.bandeja === p.k
            ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        "
        @click="pestana(p.k)"
      >
        {{ p.t }}
      </button>
    </div>

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
          placeholder="Buscar por código, CITE, remitente o asunto…"
          aria-label="Búsqueda instantánea"
        />
      </div>
      <div>
        <label class="label" for="fg">Gestión</label>
        <select id="fg" v-model="f.gestion" class="input">
          <option value="">Todas</option>
          <option v-for="g in gestiones" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="fe">Estado</label>
        <select id="fe" v-model="f.estado" class="input">
          <option value="">Todos</option>
          <option
            v-for="e in ['REGISTRADO', 'DERIVADO', 'CONCLUIDO', 'ARCHIVADO']"
            :key="e"
            :value="e"
          >
            {{ etiqueta(e) }}
          </option>
        </select>
      </div>
      <div>
        <label class="label" for="fp">Prioridad</label>
        <select id="fp" v-model="f.prioridad" class="input">
          <option value="">Todas</option>
          <option v-for="e in ['NORMAL', 'URGENTE', 'MUY_URGENTE']" :key="e" :value="e">
            {{ etiqueta(e) }}
          </option>
        </select>
      </div>
      <button v-if="hayFiltros" type="button" class="btn-ghost" @click="limpiar">Limpiar</button>
    </div>

    <p v-if="error" class="err px-4 pb-3">{{ error }}</p>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Hoja de Ruta</th>
            <th>Asunto / Remitente</th>
            <th>Estado</th>
            <th>En poder de</th>
            <th>Plazo</th>
            <th>Recepción</th>
          </tr>
        </thead>
        <tbody :class="cargando && 'opacity-50'">
          <tr
            v-for="h in datos.items"
            :key="h.id"
            class="click"
            tabindex="0"
            @click="router.push(`/hojas-ruta/${h.id}`)"
            @keydown.enter="router.push(`/hojas-ruta/${h.id}`)"
          >
            <td class="whitespace-nowrap">
              <span
                class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >{{ h.codigo }}</span
              >
              <div class="text-xs text-slate-500">{{ h.citeOrigen || 'S/C' }}</div>
            </td>
            <td class="max-w-md">
              <div class="line-clamp-2 font-medium">{{ h.asunto }}</div>
              <div class="text-xs text-slate-500">
                {{ h.remitente
                }}<template v-if="h.institucionOrigen"> · {{ h.institucionOrigen }}</template>
              </div>
            </td>
            <td class="whitespace-nowrap">
              <StatusBadge :valor="h.estado" />
              <span
                v-if="h.prioridad !== 'NORMAL'"
                class="badge ml-1"
                :class="ESTADO_CLASES[h.prioridad]"
                >{{ etiqueta(h.prioridad) }}</span
              >
              <div
                v-if="
                  h.estado === 'DERIVADO' && h.usuarioActualId === auth.usuario?.id && !h.recibida
                "
                class="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400"
              >
                ● Por recepcionar
              </div>
            </td>
            <td class="whitespace-nowrap text-xs">
              <b class="font-medium">{{ h.unidadActualSigla || '—' }}</b>
              <div class="text-slate-500">{{ h.usuarioActualNombre }}</div>
            </td>
            <td class="whitespace-nowrap">
              <span
                v-if="plazo(h.diasRestantes)"
                class="badge"
                :class="plazo(h.diasRestantes)!.clase"
                >{{ plazo(h.diasRestantes)!.texto }}</span
              ><span v-else class="text-slate-400">—</span>
            </td>
            <td class="whitespace-nowrap text-xs text-slate-500">{{ fecha(h.fechaRecepcion) }}</td>
          </tr>
          <tr v-if="!datos.items.length && !cargando">
            <td colspan="6" class="py-12 text-center text-slate-500">
              No se encontraron Hojas de Ruta con estos criterios.
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

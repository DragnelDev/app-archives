<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import Modal from '@/components/Modal.vue'
import { useToastStore } from '@/stores/toast'

export interface Campo {
  key: string
  label: string
  tipo?: 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'textarea'
  opciones?: { value: string | number; label: string }[]
  requerido?: boolean
  soloCrear?: boolean
  soloEditar?: boolean
  max?: number
  min?: number
  ancho?: 'completo'
  vacio?: string
}
export interface Columna {
  key: string
  label: string
  formato?: (v: any, fila: any) => string
  clase?: string
}

const props = defineProps<{
  endpoint: string
  singular: string
  columnas: Columna[]
  campos: Campo[]
  busqueda?: string[]
}>()
const toast = useToastStore()
const filas = ref<any[]>([])
const cargando = ref(true)
const q = ref('')
const modal = ref(false)
const editando = ref<any | null>(null)
const form = reactive<Record<string, any>>({})
const guardando = ref(false)
const error = ref('')

async function cargar() {
  cargando.value = true
  try {
    filas.value = await api.get(props.endpoint)
  } catch (e) {
    toast.error((e as Error).message)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)
defineExpose({ cargar })

const visibles = computed(() => {
  const t = q.value.trim().toLowerCase()
  if (!t) return filas.value
  const claves = props.busqueda ?? props.columnas.map((c) => c.key)
  return filas.value.filter((f) =>
    claves.some((k) =>
      String(f[k] ?? '')
        .toLowerCase()
        .includes(t),
    ),
  )
})
const camposForm = computed(() =>
  props.campos.filter((c) => (editando.value ? !c.soloCrear : !c.soloEditar)),
)

function abrir(fila?: any) {
  editando.value = fila ?? null
  error.value = ''
  for (const c of props.campos)
    form[c.key] = fila
      ? (fila[c.key] ?? (c.tipo === 'checkbox' ? true : ''))
      : c.tipo === 'checkbox'
        ? true
        : ''
  modal.value = true
}

async function guardar() {
  error.value = ''
  guardando.value = true
  const body: Record<string, any> = {}
  for (const c of camposForm.value) {
    const v = form[c.key]
    if (c.tipo === 'checkbox') body[c.key] = !!v
    else if (
      c.tipo === 'number' ||
      (c.tipo === 'select' && typeof c.opciones?.[0]?.value === 'number')
    )
      body[c.key] = v === '' || v == null ? (c.requerido ? undefined : null) : Number(v)
    else if (v !== '' && v != null) body[c.key] = v
  }
  try {
    if (editando.value) await api.put(`${props.endpoint}/${editando.value.id}`, body)
    else await api.post(props.endpoint, body)
    toast.ok(`${props.singular} ${editando.value ? 'actualizado' : 'creado'}`)
    modal.value = false
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="flex flex-wrap items-center gap-3 p-3">
      <div class="relative min-w-[14rem] flex-1">
        <Icon
          name="search"
          class="pointer-events-none absolute left-3 top-2.5 !h-4 !w-4 text-slate-400"
        />
        <input
          v-model="q"
          type="search"
          class="input !pl-9"
          placeholder="Filtrar…"
          aria-label="Filtrar listado"
        />
      </div>
      <button class="btn-primary" @click="abrir()">
        <Icon name="plus" /> Nuevo {{ singular }}
      </button>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th v-for="c in columnas" :key="c.key">{{ c.label }}</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody :class="cargando && 'opacity-50'">
          <tr v-for="f in visibles" :key="f.id" :class="f.activo === false && 'opacity-50'">
            <td v-for="c in columnas" :key="c.key" :class="c.clase">
              {{ c.formato ? c.formato(f[c.key], f) : (f[c.key] ?? '—') }}
            </td>
            <td class="whitespace-nowrap text-right">
              <slot name="acciones" :fila="f" :recargar="cargar" /><button
                class="btn-ghost btn-sm"
                @click="abrir(f)"
              >
                Editar
              </button>
            </td>
          </tr>
          <tr v-if="!visibles.length && !cargando">
            <td :colspan="columnas.length + 1" class="py-10 text-center text-slate-500">
              Sin registros.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal
    :abierto="modal"
    :titulo="`${editando ? 'Editar' : 'Nuevo'} ${singular}`"
    ancho="max-w-2xl"
    @cerrar="modal = false"
  >
    <form id="fadmin" class="grid gap-4 sm:grid-cols-2" @submit.prevent="guardar">
      <div
        v-for="c in camposForm"
        :key="c.key"
        :class="(c.ancho === 'completo' || c.tipo === 'textarea') && 'sm:col-span-2'"
      >
        <label v-if="c.tipo !== 'checkbox'" class="label" :for="`f-${c.key}`"
          >{{ c.label }}<template v-if="c.requerido"> *</template></label
        >
        <select
          v-if="c.tipo === 'select'"
          :id="`f-${c.key}`"
          v-model="form[c.key]"
          class="input"
          :required="c.requerido"
        >
          <option value="">{{ c.vacio ?? 'Seleccione…' }}</option>
          <option v-for="o in c.opciones" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <textarea
          v-else-if="c.tipo === 'textarea'"
          :id="`f-${c.key}`"
          v-model="form[c.key]"
          rows="2"
          class="input"
        />
        <label v-else-if="c.tipo === 'checkbox'" class="flex items-center gap-2 pt-6 text-sm"
          ><input v-model="form[c.key]" type="checkbox" class="h-4 w-4 accent-emerald-600" />
          {{ c.label }}</label
        >
        <input
          v-else
          :id="`f-${c.key}`"
          v-model="form[c.key]"
          :type="c.tipo ?? 'text'"
          class="input"
          :required="c.requerido"
          :maxlength="c.max"
          :min="c.min"
          :autocomplete="c.tipo === 'password' ? 'new-password' : 'off'"
        />
      </div>
      <p v-if="error" class="err sm:col-span-2" role="alert">{{ error }}</p>
    </form>
    <template #pie
      ><button class="btn-secondary" @click="modal = false">Cancelar</button
      ><button class="btn-primary" form="fadmin" :disabled="guardando">Guardar</button></template
    >
  </Modal>
</template>

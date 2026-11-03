<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import Modal from '@/components/Modal.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { fecha } from '@/utils/ui'

const auth = useAuthStore()
const toast = useToastStore()
const filas = ref<any[]>([])
const texto = ref('')
const cargando = ref(false)
const cajas = ref<any[]>([])
const modal = ref(false)
const caja = reactive({ codigo: '', estante: 'E01', cuerpo: 'A', balda: 1, capacidad: 8 })
const esArchivista = auth.tiene('ROLE_ARCHIVISTA')
let tmr: ReturnType<typeof setTimeout>

async function cargar() {
  cargando.value = true
  try {
    filas.value = await api.get('/archivo/topografia', { q: texto.value })
    if (auth.tiene('ROLE_ARCHIVISTA', 'ROLE_ADMIN')) cajas.value = await api.get('/archivo/cajas')
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)
onBeforeUnmount(() => clearTimeout(tmr))
watch(texto, () => {
  clearTimeout(tmr)
  tmr = setTimeout(cargar, 300)
})

// Agrupa por ubicación física: Estante / Cuerpo / Balda
const grupos = computed(() => {
  const m = new Map<string, { clave: string; items: any[] }>()
  for (const f of filas.value) {
    const k = `Estante ${f.estante} · Cuerpo ${f.cuerpo} · Balda ${f.balda}`
    if (!m.has(k)) m.set(k, { clave: k, items: [] })
    m.get(k)!.items.push(f)
  }
  return [...m.values()]
})

async function crear() {
  try {
    await api.post('/archivo/cajas', {
      ...caja,
      balda: Number(caja.balda),
      capacidad: Number(caja.capacidad),
    })
    toast.ok(`Caja ${caja.codigo} registrada`)
    modal.value = false
    caja.codigo = ''
    await cargar()
  } catch (e) {
    toast.error((e as Error).message)
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[14rem] flex-1">
        <Icon
          name="search"
          class="pointer-events-none absolute left-3 top-2.5 !h-4 !w-4 text-slate-400"
        />
        <input
          v-model="texto"
          type="search"
          class="input !pl-9"
          placeholder="Buscar por expediente, HR, título o caja…"
          aria-label="Buscar en el archivo"
        />
      </div>
      <button v-if="esArchivista" class="btn-secondary" @click="modal = true">
        <Icon name="plus" /> Nueva caja
      </button>
    </div>

    <div v-if="cajas.length" class="card card-pad">
      <h3 class="h-section mb-3">Cajas registradas ({{ cajas.length }})</h3>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="c in cajas"
          :key="c.id"
          class="rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-700"
        >
          <div class="flex justify-between">
            <b class="font-mono text-xs">{{ c.codigo }}</b
            ><span class="text-xs text-slate-500"
              >{{ c.estante }}/{{ c.cuerpo }}/{{ c.balda }}</span
            >
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              class="h-full bg-emerald-500"
              :style="{ width: `${(c.ocupacion / c.capacidad) * 100}%` }"
            />
          </div>
          <p class="mt-1 text-xs text-slate-500">
            {{ c.ocupacion }} / {{ c.capacidad }} expedientes
          </p>
        </div>
      </div>
    </div>

    <p v-if="!grupos.length && !cargando" class="card card-pad py-12 text-center text-slate-500">
      Aún no hay expedientes ubicados en el Archivo Central.
    </p>
    <section v-for="g in grupos" :key="g.clave" class="card">
      <h3
        class="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-800"
      >
        <Icon name="pin" class="!h-4 !w-4 text-emerald-600" /> {{ g.clave }}
      </h3>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Caja</th>
              <th>Expediente</th>
              <th>Unidad</th>
              <th>Serie / disposición</th>
              <th class="text-right">Fojas</th>
              <th>Fin de retención</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in g.items" :key="f.expedienteId">
              <td class="font-mono text-xs font-semibold">{{ f.cajaCodigo }}</td>
              <td>
                <span
                  class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                  >{{ f.codigo }}</span
                >
                <div class="max-w-xs truncate text-xs text-slate-500">{{ f.titulo }}</div>
              </td>
              <td class="text-xs">{{ f.unidadSigla }}</td>
              <td class="text-xs">
                {{ f.serieCodigo }}
                <div class="text-slate-500">
                  {{ f.disposicionFinal?.replace(/_/g, ' ').toLowerCase() }}
                </div>
              </td>
              <td class="text-right tabular-nums">{{ f.fojasTotal }}</td>
              <td class="whitespace-nowrap text-xs">
                {{ fecha(f.finRetencion) }}
                <span
                  v-if="f.retencionVencida"
                  class="badge bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30"
                  >Cumplida</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <Modal :abierto="modal" titulo="Registrar caja archivadora" @cerrar="modal = false">
    <form id="fcaja" class="grid gap-4 sm:grid-cols-2" @submit.prevent="crear">
      <div class="sm:col-span-2">
        <label class="label" for="cc">Código de caja *</label
        ><input
          id="cc"
          v-model="caja.codigo"
          class="input"
          required
          maxlength="30"
          placeholder="CJ-0007"
        />
      </div>
      <div>
        <label class="label" for="ce">Estante *</label
        ><input id="ce" v-model="caja.estante" class="input" required maxlength="10" />
      </div>
      <div>
        <label class="label" for="cu">Cuerpo *</label
        ><input id="cu" v-model="caja.cuerpo" class="input" required maxlength="10" />
      </div>
      <div>
        <label class="label" for="cb">Balda *</label
        ><input id="cb" v-model.number="caja.balda" type="number" min="1" class="input" required />
      </div>
      <div>
        <label class="label" for="ck">Capacidad (expedientes)</label
        ><input
          id="ck"
          v-model.number="caja.capacidad"
          type="number"
          min="1"
          class="input"
          required
        />
      </div>
    </form>
    <template #pie
      ><button class="btn-secondary" @click="modal = false">Cancelar</button
      ><button class="btn-primary" form="fcaja" :disabled="!caja.codigo">
        Registrar
      </button></template
    >
  </Modal>
</template>

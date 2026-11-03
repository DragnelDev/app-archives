<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/client'
import Modal from '@/components/Modal.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Icon from '@/components/Icon.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { fecha, fechaHora } from '@/utils/ui'

const auth = useAuthStore()
const toast = useToastStore()
const lista = ref<any[]>([])
const estado = ref('')
const cargando = ref(false)
const trabajando = ref(false)

const esArchivista = auth.tiene('ROLE_ARCHIVISTA')
const puedeSolicitar = auth.tiene('ROLE_JEFE', 'ROLE_TECNICO')

async function cargar() {
  cargando.value = true
  try {
    lista.value = await api.get('/archivo/transferencias', { estado: estado.value })
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

// ---- Solicitud
const modalSol = ref(false)
const candidatos = ref<any[]>([])
const sel = ref<number[]>([])
const obs = ref('')
async function abrirSolicitud() {
  candidatos.value = (await api.get('/expedientes', { estado: 'CERRADO', porPagina: 100 })).items
  sel.value = []
  obs.value = ''
  modalSol.value = true
}
async function solicitar() {
  trabajando.value = true
  try {
    const t = await api.post('/archivo/transferencias', {
      expedienteIds: sel.value,
      observaciones: obs.value || undefined,
    })
    toast.ok(`Transferencia ${t.codigo} solicitada`)
    modalSol.value = false
    await cargar()
  } catch (e) {
    toast.error((e as Error).message)
  } finally {
    trabajando.value = false
  }
}

// ---- Detalle / aprobación
const det = ref<any>(null)
const cajas = ref<any[]>([])
const asign = reactive<Record<number, number | ''>>({})
const motivo = ref('')
const rechazando = ref(false)
async function abrir(id: number) {
  det.value = await api.get(`/archivo/transferencias/${id}`)
  motivo.value = ''
  rechazando.value = false
  if (esArchivista && det.value.estado === 'SOLICITADA') {
    cajas.value = await api.get('/archivo/cajas')
    for (const d of det.value.detalle) asign[d.expedienteId] = ''
  }
}
const completo = computed(() => det.value?.detalle.every((d: any) => asign[d.expedienteId]))
const libres = (c: any) => c.capacidad - c.ocupacion
async function aprobar() {
  trabajando.value = true
  try {
    await api.post(`/archivo/transferencias/${det.value.id}/aprobar`, {
      asignaciones: det.value.detalle.map((d: any) => ({
        expedienteId: d.expedienteId,
        cajaId: Number(asign[d.expedienteId]),
      })),
    })
    toast.ok('Transferencia aprobada: expedientes ubicados y Hojas de Ruta archivadas')
    det.value = null
    await cargar()
  } catch (e) {
    toast.error((e as Error).message)
  } finally {
    trabajando.value = false
  }
}
async function rechazar() {
  trabajando.value = true
  try {
    await api.post(`/archivo/transferencias/${det.value.id}/rechazar`, { motivo: motivo.value })
    toast.ok('Transferencia rechazada')
    det.value = null
    await cargar()
  } catch (e) {
    toast.error((e as Error).message)
  } finally {
    trabajando.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="flex flex-wrap items-end justify-between gap-3 p-3">
      <div>
        <label class="label" for="te">Estado</label>
        <select id="te" v-model="estado" class="input" @change="cargar">
          <option value="">Todos</option>
          <option>SOLICITADA</option>
          <option>APROBADA</option>
          <option>RECHAZADA</option>
        </select>
      </div>
      <button v-if="puedeSolicitar" class="btn-primary" @click="abrirSolicitud">
        <Icon name="plus" /> Solicitar transferencia
      </button>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Código</th>
            <th>Unidad</th>
            <th>Solicitante</th>
            <th class="text-right">Expedientes</th>
            <th>Estado</th>
            <th>Solicitud</th>
          </tr>
        </thead>
        <tbody :class="cargando && 'opacity-50'">
          <tr
            v-for="t in lista"
            :key="t.id"
            class="click"
            tabindex="0"
            @click="abrir(t.id)"
            @keydown.enter="abrir(t.id)"
          >
            <td class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {{ t.codigo }}
            </td>
            <td>{{ t.unidadOrigen }}</td>
            <td>{{ t.solicitante }}</td>
            <td class="text-right tabular-nums">{{ t.expedientes }}</td>
            <td><StatusBadge :valor="t.estado" /></td>
            <td class="text-xs text-slate-500">{{ fechaHora(t.fechaSolicitud) }}</td>
          </tr>
          <tr v-if="!lista.length && !cargando">
            <td colspan="6" class="py-12 text-center text-slate-500">
              Sin transferencias registradas.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal
    :abierto="modalSol"
    titulo="Solicitar transferencia al Archivo Central"
    ancho="max-w-2xl"
    @cerrar="modalSol = false"
  >
    <p v-if="!candidatos.length" class="py-6 text-center text-sm text-slate-500">
      No hay expedientes CERRADOS de su unidad pendientes de transferir.
    </p>
    <ul v-else class="max-h-72 space-y-1 overflow-y-auto">
      <li v-for="c in candidatos" :key="c.id">
        <label
          class="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          <input
            v-model="sel"
            type="checkbox"
            :value="c.id"
            class="mt-1 h-4 w-4 accent-emerald-600"
          />
          <span class="min-w-0 flex-1 text-sm"
            ><span class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{{
              c.codigo
            }}</span>
            · {{ c.totalFojas }} fojas · cierre {{ fecha(c.fechaCierre)
            }}<span class="block truncate text-slate-600 dark:text-slate-400">{{
              c.titulo
            }}</span></span
          >
        </label>
      </li>
    </ul>
    <div class="mt-3">
      <label class="label" for="ob">Observaciones</label
      ><input id="ob" v-model="obs" class="input" maxlength="500" />
    </div>
    <template #pie
      ><button class="btn-secondary" @click="modalSol = false">Cancelar</button
      ><button class="btn-primary" :disabled="!sel.length || trabajando" @click="solicitar">
        Solicitar ({{ sel.length }})
      </button></template
    >
  </Modal>

  <Modal
    :abierto="!!det"
    :titulo="det ? `Transferencia ${det.codigo}` : ''"
    ancho="max-w-4xl"
    @cerrar="det = null"
  >
    <template v-if="det">
      <div class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <StatusBadge :valor="det.estado" /><span
          >Origen: <b>{{ det.unidadOrigen }}</b></span
        ><span
          >Solicita: <b>{{ det.solicitante }}</b></span
        >
        <span v-if="det.aprobador"
          >Resuelve: <b>{{ det.aprobador }}</b> ({{ fechaHora(det.fechaAprobacion) }})</span
        >
      </div>
      <p
        v-if="det.motivoRechazo"
        class="mb-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
      >
        Motivo de rechazo: {{ det.motivoRechazo }}
      </p>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Serie</th>
              <th class="text-right">Fojas</th>
              <th>
                {{ det.estado === 'SOLICITADA' && esArchivista ? 'Asignar caja' : 'Ubicación' }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in det.detalle" :key="d.id">
              <td>
                <span
                  class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                  >{{ d.expedienteCodigo }}</span
                >
                <div class="max-w-xs truncate text-xs text-slate-500">{{ d.titulo }}</div>
              </td>
              <td class="text-xs">{{ d.serieCodigo || '—' }}</td>
              <td class="text-right tabular-nums">{{ d.fojasTotal }}</td>
              <td>
                <select
                  v-if="esArchivista && det.estado === 'SOLICITADA'"
                  v-model="asign[d.expedienteId]"
                  class="input !py-1.5"
                  :aria-label="`Caja para ${d.expedienteCodigo}`"
                >
                  <option value="">Seleccione caja…</option>
                  <option v-for="c in cajas" :key="c.id" :value="c.id" :disabled="libres(c) <= 0">
                    {{ c.codigo }} — {{ c.estante }}/{{ c.cuerpo }}/balda {{ c.balda }} ({{
                      libres(c)
                    }}
                    libres)
                  </option>
                </select>
                <span v-else-if="d.cajaCodigo" class="text-sm"
                  ><b>{{ d.cajaCodigo }}</b>
                  <span class="text-xs text-slate-500">· {{ d.ubicacion }}</span></span
                ><span v-else class="text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="esArchivista && det.estado === 'SOLICITADA' && rechazando" class="mt-4">
        <label class="label" for="mo">Motivo del rechazo *</label
        ><textarea id="mo" v-model="motivo" rows="2" class="input" maxlength="500" />
      </div>
    </template>
    <template v-if="det && esArchivista && det.estado === 'SOLICITADA'" #pie>
      <template v-if="!rechazando"
        ><button class="btn-secondary" @click="rechazando = true">Rechazar</button
        ><button class="btn-primary" :disabled="!completo || trabajando" @click="aprobar">
          Aprobar y ubicar
        </button></template
      >
      <template v-else
        ><button class="btn-secondary" @click="rechazando = false">Volver</button
        ><button
          class="btn-danger"
          :disabled="motivo.trim().length < 5 || trabajando"
          @click="rechazar"
        >
          Confirmar rechazo
        </button></template
      >
    </template>
  </Modal>
</template>

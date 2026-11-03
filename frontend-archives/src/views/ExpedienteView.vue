<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import Modal from '@/components/Modal.vue'
import PdfViewer from '@/components/PdfViewer.vue'
import SlideOver from '@/components/SlideOver.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useToastStore } from '@/stores/toast'
import { TIPOS_DOC, fecha } from '@/utils/ui'

const props = defineProps<{ id: string }>()
const toast = useToastStore()
const e = ref<any>(null)
const pdfs = ref<any[]>([])
const series = ref<any[]>([])
const error = ref('')
const trabajando = ref(false)
const modalCierre = ref(false)
const serieCierre = ref<string | number>('')
const visor = reactive({ abierto: false, id: null as number | null, titulo: '' })
const nuevo = reactive({
  tipo: 'INFORME_TECNICO',
  titulo: '',
  cite: '',
  fechaDocumento: '',
  cantidad: 1,
  archivoId: '' as string | number,
})

async function cargar() {
  try {
    e.value = await api.get(`/expedientes/${props.id}`)
    const hr = await api.get(`/correspondencia/${e.value.hojaRutaId}`)
    pdfs.value = hr.documentos
  } catch (x) {
    error.value = (x as Error).message
  }
}
onMounted(cargar)
watch(() => props.id, cargar)

// --- Vista previa del foliado (la validación definitiva la hace PostgreSQL)
const inicio = computed(() => e.value?.siguienteFoja ?? 1)
const fin = computed(() => inicio.value + Math.max(1, Number(nuevo.cantidad) || 1) - 1)
const ultimoCuerpo = computed(() => e.value?.cuerpos?.[e.value.cuerpos.length - 1])
const cuerpoDestino = computed(() => {
  const c = ultimoCuerpo.value
  if (!c) return 1
  return fin.value - c.fojaInicio + 1 <= e.value.fojasPorCuerpo
    ? c.numeroCuerpo
    : c.numeroCuerpo + 1
})
const abreCuerpo = computed(
  () => ultimoCuerpo.value && cuerpoDestino.value !== ultimoCuerpo.value.numeroCuerpo,
)
const excede = computed(() => Number(nuevo.cantidad) > (e.value?.fojasPorCuerpo ?? 200))
const ultimoDoc = computed(() => e.value?.documentos?.[e.value.documentos.length - 1])

function elegirPdf() {
  const p = pdfs.value.find((x) => x.id === Number(nuevo.archivoId))
  if (p?.paginas) nuevo.cantidad = p.paginas
  if (p && !nuevo.titulo) nuevo.titulo = p.nombreOriginal.replace(/\.pdf$/i, '')
}

async function agregar() {
  trabajando.value = true
  try {
    await api.post(`/expedientes/${props.id}/documentos`, {
      tipo: nuevo.tipo,
      titulo: nuevo.titulo,
      cite: nuevo.cite || undefined,
      fechaDocumento: nuevo.fechaDocumento || undefined,
      fojaInicio: inicio.value,
      fojaFin: fin.value,
      archivoId: nuevo.archivoId ? Number(nuevo.archivoId) : undefined,
    })
    toast.ok(`Documento foliado: fojas ${inicio.value}–${fin.value}`)
    Object.assign(nuevo, { titulo: '', cite: '', cantidad: 1, archivoId: '' })
    await cargar()
  } catch (x) {
    toast.error((x as Error).message)
  } finally {
    trabajando.value = false
  }
}
async function anular(d: any) {
  if (
    !confirm(
      `¿Anular «${d.titulo}» (fojas ${d.fojaInicio}–${d.fojaFin})? Las fojas quedarán disponibles para volver a foliarse.`,
    )
  )
    return
  try {
    await api.post(`/expedientes/documentos/${d.id}/anular`)
    toast.ok('Documento anulado')
    await cargar()
  } catch (x) {
    toast.error((x as Error).message)
  }
}
async function abrirCierre() {
  if (!series.value.length) series.value = await api.get('/catalogos/series')
  serieCierre.value = e.value.serieId ?? ''
  modalCierre.value = true
}
async function cerrar() {
  trabajando.value = true
  try {
    await api.post(`/expedientes/${props.id}/cerrar`, {
      serieId: serieCierre.value ? Number(serieCierre.value) : undefined,
    })
    toast.ok('Expediente cerrado. Ya puede solicitarse su transferencia al Archivo Central.')
    modalCierre.value = false
    await cargar()
  } catch (x) {
    toast.error((x as Error).message)
  } finally {
    trabajando.value = false
  }
}
function ver(d: any) {
  visor.id = d.archivoId
  visor.titulo = d.titulo
  visor.abierto = true
}
</script>

<template>
  <p v-if="error" class="err">{{ error }}</p>
  <div v-else-if="!e" class="card h-48 animate-pulse" />
  <div v-else class="space-y-5">
    <section class="card card-pad">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              {{ e.codigo }}
            </h2>
            <StatusBadge :valor="e.estado" />
            <span
              class="badge"
              :class="
                e.foliadoIntegro
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30'
                  : 'bg-rose-50 text-rose-700 ring-rose-600/20'
              "
            >
              <Icon :name="e.foliadoIntegro ? 'shield' : 'alert'" class="!h-3.5 !w-3.5" />
              {{
                e.foliadoIntegro ? 'Foliado correlativo íntegro' : 'Foliado con inconsistencias'
              }}</span
            >
          </div>
          <p class="mt-2 font-medium">{{ e.titulo }}</p>
        </div>
        <div class="flex gap-2">
          <RouterLink :to="`/hojas-ruta/${e.hojaRutaId}`" class="btn-secondary"
            ><Icon name="link" /> {{ e.hojaRutaCodigo }}</RouterLink
          >
          <button v-if="e.permisos.puedeCerrar" class="btn-primary" @click="abrirCierre">
            <Icon name="check" /> Cerrar expediente
          </button>
        </div>
      </div>
      <dl class="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt class="text-xs text-slate-500">Unidad productora</dt>
          <dd class="font-medium">{{ e.unidadSigla }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Serie (ICA)</dt>
          <dd class="font-medium">
            {{ e.serieCodigo ? `${e.serieCodigo} · ${e.serieNombre}` : 'Sin asignar' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Total de fojas</dt>
          <dd class="font-medium">{{ e.totalFojas }} en {{ e.cuerpos.length }} cuerpo(s)</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Apertura / cierre</dt>
          <dd class="font-medium">{{ fecha(e.fechaApertura) }} → {{ fecha(e.fechaCierre) }}</dd>
        </div>
        <template v-if="e.finRetencionGestion">
          <div>
            <dt class="text-xs text-slate-500">Fin retención en Archivo de Gestión</dt>
            <dd class="font-medium">{{ fecha(e.finRetencionGestion) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Fin retención en Archivo Central</dt>
            <dd class="font-medium">
              {{ fecha(e.finRetencionCentral) }}
              <span class="text-xs font-normal text-slate-500"
                >({{ e.disposicionFinal?.replace(/_/g, ' ').toLowerCase() }})</span
              >
            </dd>
          </div>
        </template>
      </dl>
    </section>

    <!-- Cuerpos -->
    <section class="card card-pad">
      <h3 class="h-section mb-3">
        Cuerpos del expediente
        <span class="font-normal normal-case">(máx. {{ e.fojasPorCuerpo }} fojas por cuerpo)</span>
      </h3>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="c in e.cuerpos"
          :key="c.id"
          class="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
        >
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-semibold">Cuerpo {{ c.numeroCuerpo }}</span
            ><span class="font-mono text-xs text-slate-500"
              >f. {{ c.fojaInicio }}–{{ c.fojaFin }}</span
            >
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              class="h-full rounded-full bg-emerald-500"
              :style="{ width: `${Math.min(100, (c.fojas / e.fojasPorCuerpo) * 100)}%` }"
            />
          </div>
          <p class="mt-1 text-xs text-slate-500">{{ c.fojas }} / {{ e.fojasPorCuerpo }} fojas</p>
        </div>
      </div>
    </section>

    <!-- Documentos foliados -->
    <section class="card">
      <h3 class="h-section px-4 pt-4 sm:px-5">Documentos foliados</h3>
      <div class="table-wrap mt-2">
        <table class="tbl">
          <thead>
            <tr>
              <th>Fojas</th>
              <th>Cuerpo</th>
              <th>Documento</th>
              <th>Autor</th>
              <th>Fecha</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in e.documentos" :key="d.id">
              <td class="whitespace-nowrap font-mono text-xs">
                {{ d.fojaInicio
                }}<template v-if="d.fojaFin !== d.fojaInicio">–{{ d.fojaFin }}</template
                ><span class="ml-1 text-slate-400">({{ d.fojas }})</span>
              </td>
              <td class="text-center">{{ d.numeroCuerpo }}</td>
              <td>
                <div class="font-medium">{{ d.titulo }}</div>
                <div class="text-xs text-slate-500">
                  {{ TIPOS_DOC[d.tipo] }}<template v-if="d.cite"> · {{ d.cite }}</template>
                </div>
              </td>
              <td class="text-xs">{{ d.autorNombre }}</td>
              <td class="whitespace-nowrap text-xs text-slate-500">
                {{ fecha(d.fechaDocumento) }}
              </td>
              <td class="whitespace-nowrap text-right">
                <button v-if="d.archivoId" class="btn-ghost btn-sm" title="Ver PDF" @click="ver(d)">
                  <Icon name="eye" class="!h-4 !w-4" /> PDF
                </button>
                <button
                  v-if="e.permisos.puedeFoliar && d.id === ultimoDoc?.id && d.tipo !== 'ORIGEN'"
                  class="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                  @click="anular(d)"
                >
                  Anular
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Registrar documento -->
    <section v-if="e.permisos.puedeFoliar" class="card card-pad">
      <h3 class="h-section mb-4">Foliar nuevo documento</h3>
      <form class="grid gap-4 sm:grid-cols-6" @submit.prevent="agregar">
        <div class="sm:col-span-2">
          <label class="label" for="nt">Tipo</label>
          <select id="nt" v-model="nuevo.tipo" class="input">
            <option v-for="(t, k) in TIPOS_DOC" v-show="k !== 'ORIGEN'" :key="k" :value="k">
              {{ t }}
            </option>
          </select>
        </div>
        <div class="sm:col-span-4">
          <label class="label" for="ntt">Título / referencia *</label
          ><input
            id="ntt"
            v-model="nuevo.titulo"
            class="input"
            required
            minlength="3"
            maxlength="300"
          />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="nc">CITE del documento</label
          ><input id="nc" v-model="nuevo.cite" class="input" maxlength="100" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="nf">Fecha del documento</label
          ><input id="nf" v-model="nuevo.fechaDocumento" type="date" class="input" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="na">PDF vinculado</label>
          <select id="na" v-model="nuevo.archivoId" class="input" @change="elegirPdf">
            <option value="">Sin PDF</option>
            <option v-for="p in pdfs" :key="p.id" :value="p.id">
              {{ p.nombreOriginal }}{{ p.paginas ? ` (${p.paginas} pág.)` : '' }}
            </option>
          </select>
        </div>

        <div
          class="sm:col-span-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-500/5"
        >
          <div class="grid items-end gap-4 sm:grid-cols-3">
            <div>
              <label class="label">Foja inicial (automática)</label>
              <div class="input !bg-slate-100 font-mono dark:!bg-slate-900">{{ inicio }}</div>
            </div>
            <div>
              <label class="label" for="nq">Cantidad de fojas *</label
              ><input
                id="nq"
                v-model.number="nuevo.cantidad"
                type="number"
                min="1"
                :max="e.fojasPorCuerpo"
                class="input"
                required
              />
            </div>
            <div>
              <label class="label">Foja final</label>
              <div class="input !bg-slate-100 font-mono dark:!bg-slate-900">{{ fin }}</div>
            </div>
          </div>
          <p class="mt-3 text-sm">
            <b>Se foliará: fojas {{ inicio }}–{{ fin }}</b> en el <b>cuerpo {{ cuerpoDestino }}</b>
            <span v-if="abreCuerpo" class="text-amber-700 dark:text-amber-400">
              (se abrirá un cuerpo nuevo: el actual no tiene capacidad)</span
            >.
          </p>
          <p v-if="excede" class="err">
            Un documento no puede superar {{ e.fojasPorCuerpo }} fojas.
          </p>
          <p class="hint">
            La numeración es correlativa: la base de datos rechaza baches y solapes.
          </p>
        </div>
        <div class="flex justify-end sm:col-span-6">
          <button class="btn-primary" :disabled="trabajando || excede || !nuevo.titulo">
            Registrar documento
          </button>
        </div>
      </form>
    </section>
  </div>

  <Modal :abierto="modalCierre" titulo="Cerrar expediente" @cerrar="modalCierre = false">
    <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
      Al cerrarlo no podrá foliarse más documentos. Verifique el foliado ({{ e?.totalFojas }} fojas)
      antes de continuar.
    </p>
    <label class="label" for="sc">Serie documental (define los plazos de retención) *</label>
    <select id="sc" v-model="serieCierre" class="input">
      <option value="" disabled>Seleccione…</option>
      <option v-for="s in series" :key="s.id" :value="s.id">
        {{ s.codigo }} · {{ s.nombre }} ({{ s.retencionGestionAnios }}+{{
          s.retencionCentralAnios
        }}
        años)
      </option>
    </select>
    <template #pie
      ><button class="btn-secondary" @click="modalCierre = false">Cancelar</button
      ><button class="btn-primary" :disabled="!serieCierre || trabajando" @click="cerrar">
        Cerrar expediente
      </button></template
    >
  </Modal>

  <SlideOver
    :abierto="visor.abierto"
    :titulo="visor.titulo"
    ancho="max-w-4xl"
    @cerrar="visor.abierto = false"
  >
    <PdfViewer v-if="visor.abierto" :documento-id="visor.id" />
  </SlideOver>
</template>

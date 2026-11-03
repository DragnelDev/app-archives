<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import Modal from '@/components/Modal.vue'
import PdfViewer from '@/components/PdfViewer.vue'
import SlideOver from '@/components/SlideOver.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Timeline from '@/components/Timeline.vue'
import { useToastStore } from '@/stores/toast'
import { ESTADO_CLASES, bytes, etiqueta, fecha, fechaHora, plazo } from '@/utils/ui'

const props = defineProps<{ id: string }>()
const router = useRouter()
const toast = useToastStore()
const hr = ref<any>(null)
const error = ref('')
const trabajando = ref(false)

const destinatarios = ref<any[]>([])
const series = ref<any[]>([])
const modal = ref<'' | 'derivar' | 'concluir' | 'expediente'>('')
const form = reactive({
  destinatarioUsuarioId: '' as string | number,
  proveido: '',
  plazoDias: '' as string | number,
  serieId: '' as string | number,
  titulo: '',
})
const visor = reactive({ abierto: false, id: null as number | null, nombre: '' })

async function cargar() {
  error.value = ''
  try {
    hr.value = await api.get(`/correspondencia/${props.id}`)
  } catch (e) {
    error.value = (e as Error).message
  }
}
onMounted(cargar)
watch(() => props.id, cargar)

async function ejecutar(fn: () => Promise<unknown>, ok: string) {
  trabajando.value = true
  try {
    await fn()
    toast.ok(ok)
    modal.value = ''
    await cargar()
  } catch (e) {
    toast.error((e as Error).message)
  } finally {
    trabajando.value = false
  }
}

const recibir = () =>
  ejecutar(() => api.post(`/correspondencia/${props.id}/recibir`), 'Hoja de Ruta recepcionada')

async function abrirModal(m: 'derivar' | 'concluir' | 'expediente') {
  Object.assign(form, {
    destinatarioUsuarioId: '',
    proveido: '',
    plazoDias: '',
    serieId: hr.value.serieId ?? '',
    titulo: '',
  })
  if (m === 'derivar' && !destinatarios.value.length)
    destinatarios.value = await api.get('/catalogos/destinatarios')
  if (m === 'expediente' && !series.value.length) series.value = await api.get('/catalogos/series')
  modal.value = m
}
const derivar = () =>
  ejecutar(
    () =>
      api.post(`/correspondencia/${props.id}/derivar`, {
        destinatarioUsuarioId: Number(form.destinatarioUsuarioId),
        proveido: form.proveido,
        plazoDias: form.plazoDias ? Number(form.plazoDias) : undefined,
      }),
    'Hoja de Ruta derivada',
  )
const concluir = () =>
  ejecutar(
    () => api.post(`/correspondencia/${props.id}/concluir`, { proveido: form.proveido }),
    'Trámite concluido',
  )
async function abrirExpediente() {
  trabajando.value = true
  try {
    const e = await api.post('/expedientes', {
      hojaRutaId: Number(props.id),
      serieId: form.serieId ? Number(form.serieId) : undefined,
      titulo: form.titulo || undefined,
    })
    toast.ok(`Expediente ${e.codigo} abierto`)
    router.push(`/expedientes/${e.id}`)
  } catch (e) {
    toast.error((e as Error).message)
  } finally {
    trabajando.value = false
  }
}

async function subir(e: Event) {
  const input = e.target as HTMLInputElement
  const a = input.files?.[0]
  if (!a) return
  const fd = new FormData()
  fd.append('archivo', a)
  await ejecutar(
    () => api.upload(`/documentos/hoja-ruta/${props.id}`, fd),
    `PDF «${a.name}» adjuntado`,
  )
  input.value = ''
}
function ver(d: any) {
  visor.id = d.id
  visor.nombre = d.nombreOriginal
  visor.abierto = true
}

const p = computed(() => hr.value?.permisos ?? {})
const pl = computed(() => (hr.value?.estado === 'DERIVADO' ? plazo(hr.value?.diasRestantes) : null))
const valDerivar = computed(() => !!form.destinatarioUsuarioId && form.proveido.trim().length >= 3)
</script>

<template>
  <p v-if="error" class="err">{{ error }}</p>
  <div v-else-if="!hr" class="card h-48 animate-pulse" />

  <div v-else class="space-y-5">
    <!-- Cabecera -->
    <section class="card card-pad">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              {{ hr.codigo }}
            </h2>
            <StatusBadge :valor="hr.estado" />
            <span
              v-if="hr.prioridad !== 'NORMAL'"
              class="badge"
              :class="ESTADO_CLASES[hr.prioridad]"
              >{{ etiqueta(hr.prioridad) }}</span
            >
            <span v-if="pl" class="badge" :class="pl.clase"
              ><Icon name="clock" class="!h-3.5 !w-3.5" /> {{ pl.texto }}</span
            >
          </div>
          <p class="mt-2 text-base font-medium">{{ hr.asunto }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="p.puedeRecibir" class="btn-primary" :disabled="trabajando" @click="recibir">
            <Icon name="check" /> Recepcionar
          </button>
          <button v-if="p.puedeDerivar" class="btn-secondary" @click="abrirModal('derivar')">
            <Icon name="arrow" /> Derivar
          </button>
          <button v-if="p.puedeConcluir" class="btn-secondary" @click="abrirModal('concluir')">
            <Icon name="check" /> Concluir trámite
          </button>
        </div>
      </div>
      <p
        v-if="p.puedeRecibir"
        class="mt-3 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
      >
        Esta Hoja de Ruta le fue derivada. Debe <b>recepcionarla</b> para poder derivarla, foliar o
        concluirla.
      </p>

      <dl class="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt class="text-xs text-slate-500">CITE de origen</dt>
          <dd class="font-medium">{{ hr.citeOrigen || 'S/C' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Remitente</dt>
          <dd class="font-medium">
            {{ hr.remitente
            }}<span v-if="hr.remitenteCargo" class="block text-xs font-normal text-slate-500">{{
              hr.remitenteCargo
            }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Institución</dt>
          <dd class="font-medium">{{ hr.institucionOrigen || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Fecha de recepción</dt>
          <dd class="font-medium">{{ fechaHora(hr.fechaRecepcion) }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Fojas iniciales</dt>
          <dd class="font-medium">
            {{ hr.fojasIniciales
            }}<span v-if="hr.anexos" class="text-xs font-normal text-slate-500">
              · {{ hr.anexos }}</span
            >
          </dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">En poder de</dt>
          <dd class="font-medium">
            {{ hr.usuarioActualNombre || '—'
            }}<span class="block text-xs font-normal text-slate-500">{{
              hr.unidadActualNombre
            }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Plazo vigente</dt>
          <dd class="font-medium">{{ fecha(hr.fechaLimite) }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Serie documental</dt>
          <dd class="font-medium">
            {{ hr.serieCodigo ? `${hr.serieCodigo} · ${hr.serieNombre}` : 'Sin asignar' }}
          </dd>
        </div>
      </dl>
    </section>

    <div class="grid gap-5 lg:grid-cols-5">
      <!-- Línea de tiempo -->
      <section class="card card-pad lg:col-span-3">
        <h3 class="h-section mb-5">Historial de derivaciones</h3>
        <Timeline :movimientos="hr.movimientos" :cadena-integra="hr.cadenaIntegra" />
      </section>

      <div class="space-y-5 lg:col-span-2">
        <!-- Documentos digitales -->
        <section class="card card-pad">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="h-section">Documentos digitales</h3>
            <label v-if="p.puedeAdjuntar" class="btn-secondary btn-sm cursor-pointer"
              ><Icon name="upload" class="!h-4 !w-4" /> Adjuntar PDF<input
                type="file"
                accept="application/pdf,.pdf"
                class="sr-only"
                @change="subir"
            /></label>
          </div>
          <p v-if="!hr.documentos.length" class="py-4 text-center text-sm text-slate-500">
            Sin PDF adjuntos.
          </p>
          <ul v-else class="space-y-2">
            <li v-for="d in hr.documentos" :key="d.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-2.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-slate-700 dark:hover:bg-emerald-500/5"
                @click="ver(d)"
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                  ><Icon name="document"
                /></span>
                <span class="min-w-0 flex-1"
                  ><span class="block truncate text-sm font-medium">{{ d.nombreOriginal }}</span>
                  <span class="text-xs text-slate-500"
                    >{{ d.paginas ? `${d.paginas} pág. · ` : '' }}{{ bytes(d.tamanoBytes) }}</span
                  ></span
                >
                <Icon name="eye" class="text-slate-400" />
              </button>
            </li>
          </ul>
        </section>

        <!-- Expediente -->
        <section class="card card-pad">
          <h3 class="h-section mb-3">Expediente y foliado</h3>
          <RouterLink
            v-if="hr.expedienteId"
            :to="`/expedientes/${hr.expedienteId}`"
            class="btn-secondary w-full"
            ><Icon name="folder" /> Ver expediente foliado</RouterLink
          >
          <template v-else>
            <p class="mb-3 text-sm text-slate-500">
              Aún no se abrió el expediente. Al abrirlo, las {{ hr.fojasIniciales }} foja(s)
              iniciales quedan registradas como documento de origen.
            </p>
            <button
              v-if="p.puedeFoliar"
              class="btn-primary w-full"
              @click="abrirModal('expediente')"
            >
              <Icon name="folder" /> Abrir expediente
            </button>
          </template>
        </section>
      </div>
    </div>
  </div>

  <!-- Modales de acción -->
  <Modal :abierto="modal === 'derivar'" titulo="Derivar Hoja de Ruta" @cerrar="modal = ''">
    <div class="space-y-4">
      <div>
        <label class="label" for="dd">Destinatario *</label>
        <select id="dd" v-model="form.destinatarioUsuarioId" class="input">
          <option value="" disabled>Seleccione…</option>
          <option v-for="d in destinatarios" :key="d.id" :value="d.id">
            {{ d.unidadSigla }} — {{ d.nombre }} ({{
              d.cargo || etiqueta(d.rol.replace('ROLE_', ''))
            }})
          </option>
        </select>
      </div>
      <div>
        <label class="label" for="dp">Proveído *</label
        ><textarea
          id="dp"
          v-model="form.proveido"
          rows="3"
          class="input"
          maxlength="1000"
          placeholder="Instrucción formal para el destinatario"
        />
      </div>
      <div>
        <label class="label" for="dl">Plazo (días hábiles)</label
        ><input
          id="dl"
          v-model="form.plazoDias"
          type="number"
          min="1"
          max="60"
          class="input"
          placeholder="Por defecto según destinatario"
        />
      </div>
    </div>
    <template #pie
      ><button class="btn-secondary" @click="modal = ''">Cancelar</button
      ><button class="btn-primary" :disabled="!valDerivar || trabajando" @click="derivar">
        Derivar
      </button></template
    >
  </Modal>

  <Modal :abierto="modal === 'concluir'" titulo="Concluir trámite" @cerrar="modal = ''">
    <label class="label" for="cp">Conclusión / respuesta emitida *</label>
    <textarea
      id="cp"
      v-model="form.proveido"
      rows="4"
      class="input"
      maxlength="1000"
      placeholder="Ej. Se emitió el informe INF-DAF-001/2026 y se notificó al interesado."
    />
    <p class="hint">
      Quedará registrado de forma inmutable en el historial. Luego podrá cerrar el expediente.
    </p>
    <template #pie
      ><button class="btn-secondary" @click="modal = ''">Cancelar</button
      ><button
        class="btn-primary"
        :disabled="form.proveido.trim().length < 3 || trabajando"
        @click="concluir"
      >
        Concluir
      </button></template
    >
  </Modal>

  <Modal :abierto="modal === 'expediente'" titulo="Abrir expediente" @cerrar="modal = ''">
    <div class="space-y-4">
      <div>
        <label class="label" for="et">Título del expediente</label
        ><input
          id="et"
          v-model="form.titulo"
          class="input"
          maxlength="300"
          :placeholder="hr?.asunto?.slice(0, 80)"
        />
      </div>
      <div>
        <label class="label" for="es">Serie documental (ICA)</label>
        <select id="es" v-model="form.serieId" class="input">
          <option value="">Asignar antes del cierre</option>
          <option v-for="s in series" :key="s.id" :value="s.id">
            {{ s.codigo }} · {{ s.nombre }}
          </option>
        </select>
      </div>
    </div>
    <template #pie
      ><button class="btn-secondary" @click="modal = ''">Cancelar</button
      ><button class="btn-primary" :disabled="trabajando" @click="abrirExpediente">
        Abrir expediente
      </button></template
    >
  </Modal>

  <!-- Visor PDF integrado -->
  <SlideOver
    :abierto="visor.abierto"
    :titulo="visor.nombre"
    ancho="max-w-4xl"
    @cerrar="visor.abierto = false"
  >
    <PdfViewer v-if="visor.abierto" :documento-id="visor.id" />
  </SlideOver>
</template>

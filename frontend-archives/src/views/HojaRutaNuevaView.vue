<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const toast = useToastStore()
const jefes = ref<any[]>([])
const series = ref<any[]>([])
const archivo = ref<File | null>(null)
const guardando = ref(false)
const error = ref('')
const f = reactive({
  citeOrigen: '',
  remitente: '',
  remitenteCargo: '',
  institucionOrigen: '',
  asunto: '',
  tipoDocumento: 'EXTERNO',
  prioridad: 'NORMAL',
  fojasIniciales: 1,
  anexos: '',
  serieId: '' as string | number,
  destinatarioUsuarioId: '' as string | number,
  proveido: '',
  plazoDias: '' as string | number,
})

onMounted(async () => {
  ;[jefes.value, series.value] = await Promise.all([
    api.get('/catalogos/destinatarios'),
    api.get('/catalogos/series'),
  ])
})
const valido = computed(
  () =>
    f.remitente.trim().length >= 3 &&
    f.asunto.trim().length >= 5 &&
    f.fojasIniciales >= 1 &&
    !!f.destinatarioUsuarioId,
)

function elegirArchivo(e: Event) {
  const a = (e.target as HTMLInputElement).files?.[0] ?? null
  if (a && a.size > 25 * 1024 * 1024) {
    error.value = 'El PDF supera los 25 MB'
    archivo.value = null
    return
  }
  archivo.value = a
  error.value = ''
}

/** Flujo: 1) registrar (queda REGISTRADO) → 2) adjuntar escaneo → 3) derivar al Jefe. Si falla un paso, la HR queda en su bandeja. */
async function registrar() {
  error.value = ''
  guardando.value = true
  let hr: { id: number; codigo: string } | null = null
  try {
    hr = await api.post('/correspondencia', {
      citeOrigen: f.citeOrigen || undefined,
      remitente: f.remitente,
      remitenteCargo: f.remitenteCargo || undefined,
      institucionOrigen: f.institucionOrigen || undefined,
      asunto: f.asunto,
      tipoDocumento: f.tipoDocumento,
      prioridad: f.prioridad,
      fojasIniciales: Number(f.fojasIniciales),
      anexos: f.anexos || undefined,
      serieId: f.serieId ? Number(f.serieId) : undefined,
    })
    if (archivo.value) {
      const fd = new FormData()
      fd.append('archivo', archivo.value)
      fd.append('descripcion', 'Documento original escaneado')
      await api.upload(`/documentos/hoja-ruta/${hr!.id}`, fd)
    }
    await api.post(`/correspondencia/${hr!.id}/derivar`, {
      destinatarioUsuarioId: Number(f.destinatarioUsuarioId),
      proveido: f.proveido.trim() || 'Para su atención y trámite',
      plazoDias: f.plazoDias ? Number(f.plazoDias) : undefined,
    })
    toast.ok(`Hoja de Ruta ${hr!.codigo} registrada y derivada`)
    router.push(`/hojas-ruta/${hr!.id}`)
  } catch (e) {
    error.value = (e as Error).message
    if (hr) {
      toast.error(
        `La HR ${hr.codigo} se registró, pero un paso posterior falló. Continúe desde su bandeja.`,
      )
      router.push(`/hojas-ruta/${hr.id}`)
    }
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <form class="mx-auto max-w-4xl space-y-5" @submit.prevent="registrar">
    <section class="card card-pad">
      <h2 class="h-section mb-4">Documento recibido</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="cite">CITE de origen</label
          ><input
            id="cite"
            v-model="f.citeOrigen"
            class="input"
            placeholder="Ej. CITE-ASOC/045/2026"
            maxlength="100"
          />
        </div>
        <div>
          <label class="label" for="td">Procedencia</label>
          <select id="td" v-model="f.tipoDocumento" class="input">
            <option value="EXTERNO">Externa</option>
            <option value="INTERNO">Interna</option>
          </select>
        </div>
        <div>
          <label class="label" for="rem">Remitente *</label
          ><input id="rem" v-model="f.remitente" class="input" required maxlength="200" />
        </div>
        <div>
          <label class="label" for="rc">Cargo del remitente</label
          ><input id="rc" v-model="f.remitenteCargo" class="input" maxlength="150" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="ins">Institución / organización de origen</label
          ><input id="ins" v-model="f.institucionOrigen" class="input" maxlength="200" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="as">Asunto / referencia *</label
          ><textarea
            id="as"
            v-model="f.asunto"
            class="input"
            rows="3"
            required
            minlength="5"
            maxlength="2000"
          />
        </div>
        <div>
          <label class="label" for="fo">Fojas recibidas *</label
          ><input
            id="fo"
            v-model.number="f.fojasIniciales"
            type="number"
            min="1"
            max="5000"
            class="input"
            required
          />
          <p class="hint">
            Cuente las hojas del documento original: serán las primeras fojas del expediente.
          </p>
        </div>
        <div>
          <label class="label" for="an">Anexos</label
          ><input
            id="an"
            v-model="f.anexos"
            class="input"
            maxlength="200"
            placeholder="Ej. 1 CD, 2 planos"
          />
        </div>
        <div>
          <label class="label" for="pr">Prioridad</label>
          <select id="pr" v-model="f.prioridad" class="input">
            <option value="NORMAL">Normal</option>
            <option value="URGENTE">Urgente</option>
            <option value="MUY_URGENTE">Muy urgente</option>
          </select>
        </div>
        <div>
          <label class="label" for="se">Serie documental (ICA)</label>
          <select id="se" v-model="f.serieId" class="input">
            <option value="">Asignar después</option>
            <option v-for="s in series" :key="s.id" :value="s.id">
              {{ s.codigo }} · {{ s.nombre }}
            </option>
          </select>
        </div>
      </div>
    </section>

    <section class="card card-pad">
      <h2 class="h-section mb-4">Escaneo (PDF)</h2>
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/40 dark:border-slate-700 dark:hover:bg-emerald-500/5"
      >
        <Icon name="upload" class="!h-7 !w-7 text-slate-400" />
        <span class="text-sm font-medium">{{
          archivo ? archivo.name : 'Seleccione el PDF del documento escaneado'
        }}</span>
        <span class="text-xs text-slate-500">{{
          archivo ? `${(archivo.size / 1024 / 1024).toFixed(2)} MB` : 'Solo PDF · máximo 25 MB'
        }}</span>
        <input type="file" accept="application/pdf,.pdf" class="sr-only" @change="elegirArchivo" />
      </label>
    </section>

    <section class="card card-pad">
      <h2 class="h-section mb-4">Derivación inicial</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="de">Derivar a (Jefe de unidad) *</label>
          <select id="de" v-model="f.destinatarioUsuarioId" class="input" required>
            <option value="" disabled>Seleccione…</option>
            <option v-for="j in jefes" :key="j.id" :value="j.id">
              {{ j.unidadNombre }} — {{ j.nombre }}
            </option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="pv">Proveído</label
          ><input
            id="pv"
            v-model="f.proveido"
            class="input"
            maxlength="1000"
            placeholder="Para su atención y trámite"
          />
        </div>
        <div>
          <label class="label" for="pl">Plazo (días hábiles)</label
          ><input
            id="pl"
            v-model="f.plazoDias"
            type="number"
            min="1"
            max="60"
            class="input"
            placeholder="Sin plazo"
          />
        </div>
      </div>
    </section>

    <p
      v-if="error"
      class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="flex justify-end gap-2">
      <button type="button" class="btn-secondary" @click="router.back()">Cancelar</button>
      <button class="btn-primary" :disabled="!valido || guardando">
        {{ guardando ? 'Registrando…' : 'Registrar y derivar' }}
      </button>
    </div>
  </form>
</template>

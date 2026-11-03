<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import Icon from '@/components/Icon.vue'
import StatCard from '@/components/StatCard.vue'
import { useAuthStore } from '@/stores/auth'
import { ESTADO_CLASES, ROLES, etiqueta, fecha, fechaHora, plazo } from '@/utils/ui'

const auth = useAuthStore()
const d = ref<any>(null)
const error = ref('')
onMounted(async () => {
  try {
    d.value = await api.get('/dashboard')
  } catch (e) {
    error.value = (e as Error).message
  }
})

const totalEstados = computed(() =>
  Object.values<number>(d.value?.porEstado ?? {}).reduce((a, b) => a + b, 0),
)
const BARRAS: Record<string, string> = {
  REGISTRADO: 'bg-sky-500',
  DERIVADO: 'bg-amber-500',
  CONCLUIDO: 'bg-emerald-500',
  ARCHIVADO: 'bg-slate-400',
}
const ACCION: Record<string, string> = {
  REGISTRO: 'registró',
  DERIVACION: 'derivó',
  DEVOLUCION: 'devolvió',
  CONCLUSION: 'concluyó',
  ARCHIVO: 'archivó',
}
const hora = new Date().getHours()
const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">{{ saludo }}, {{ auth.usuario?.nombres }}</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ auth.rol && ROLES[auth.rol] }} · {{ auth.usuario?.unidadNombre }}
        </p>
      </div>
      <RouterLink v-if="auth.tiene('ROLE_VENTANILLA')" to="/hojas-ruta/nueva" class="btn-primary"
        ><Icon name="plus" /> Nueva Hoja de Ruta</RouterLink
      >
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <div v-if="!d && !error" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" class="card h-24 animate-pulse" />
    </div>

    <template v-if="d">
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          v-for="t in d.tarjetas"
          :key="t.clave"
          :etiqueta="t.etiqueta"
          :valor="t.valor"
          :tono="t.tono"
          :enlace="t.enlace"
        />
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <section class="card card-pad lg:col-span-2">
          <h3 class="h-section mb-3 flex items-center gap-2">
            <Icon name="alert" class="!h-4 !w-4" /> Alertas y plazos
          </h3>
          <p v-if="!d.alertas.length" class="py-6 text-center text-sm text-slate-500">
            Sin alertas pendientes. ✔
          </p>
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="a in d.alertas" :key="a.tipo + a.id">
              <RouterLink
                :to="a.tipo === 'TRANSFERENCIA' ? '/archivo/transferencias' : `/hojas-ruta/${a.id}`"
                class="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span
                  class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                  >{{ a.codigo }}</span
                >
                <span class="min-w-0 flex-1 truncate text-sm">{{ a.asunto }}</span>
                <span
                  v-if="plazo(a.diasRestantes)"
                  class="badge"
                  :class="plazo(a.diasRestantes)!.clase"
                  >{{ plazo(a.diasRestantes)!.texto }}</span
                >
                <span v-if="a.fechaLimite" class="hidden text-xs text-slate-500 sm:inline">{{
                  fecha(a.fechaLimite)
                }}</span>
              </RouterLink>
            </li>
          </ul>
        </section>

        <section class="card card-pad">
          <h3 class="h-section mb-3">Hojas de Ruta {{ d.gestion }} por estado</h3>
          <ul class="space-y-3">
            <li v-for="(n, est) in d.porEstado" :key="est">
              <div class="mb-1 flex justify-between text-sm">
                <span class="badge" :class="ESTADO_CLASES[est]">{{ etiqueta(String(est)) }}</span
                ><span class="tabular-nums font-medium">{{ n }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  class="h-full rounded-full transition-all"
                  :class="BARRAS[est]"
                  :style="{ width: totalEstados ? `${(n / totalEstados) * 100}%` : '0%' }"
                />
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section class="card card-pad">
        <h3 class="h-section mb-3">Actividad reciente</h3>
        <p v-if="!d.actividad.length" class="py-4 text-center text-sm text-slate-500">
          Aún no hay movimientos.
        </p>
        <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="m in d.actividad" :key="m.id">
            <RouterLink
              :to="`/hojas-ruta/${m.hojaRutaId}`"
              class="flex flex-wrap items-baseline gap-x-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span
                class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >{{ m.codigo }}</span
              >
              <span
                ><b class="font-medium">{{ m.remitenteNombre }}</b> {{ ACCION[m.accion]
                }}<template v-if="m.destinatarioNombre && m.accion !== 'REGISTRO'">
                  a <b class="font-medium">{{ m.destinatarioNombre }}</b></template
                ></span
              >
              <span class="ml-auto text-xs text-slate-500">{{ fechaHora(m.fechaEnvio) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

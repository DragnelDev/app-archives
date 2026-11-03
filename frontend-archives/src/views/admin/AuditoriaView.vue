<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { api } from '@/api/client'
import Modal from '@/components/Modal.vue'
import Paginacion from '@/components/Paginacion.vue'
import { fechaHora } from '@/utils/ui'

const TABLAS = [
  'hojas_ruta',
  'hoja_ruta_movimientos',
  'expedientes',
  'expediente_cuerpos',
  'documentos_internos',
  'documentos_digitales',
  'transferencias',
  'detalle_transferencia_cajas',
  'cajas_archivo',
  'usuarios',
  'unidades_organizacionales',
  'cuadro_clasificacion',
]
const f = reactive({ tabla: '', accion: '', registroId: '', pagina: 1 })
const datos = ref<{ items: any[]; total: number; porPagina: number }>({
  items: [],
  total: 0,
  porPagina: 50,
})
const sel = ref<any | null>(null)
const cargando = ref(false)

async function cargar() {
  cargando.value = true
  try {
    datos.value = await api.get('/auditoria', { ...f })
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)
watch(
  () => [f.tabla, f.accion, f.registroId],
  () => {
    f.pagina = 1
    cargar()
  },
)

/** Solo los campos que cambiaron (UPDATE) o todos (INSERT). */
const cambios = computed(() => {
  const a = sel.value?.datosAntes ?? {},
    d = sel.value?.datosDespues ?? {}
  return [...new Set([...Object.keys(a), ...Object.keys(d)])]
    .filter((k) => sel.value?.accion === 'INSERT' || JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .map((k) => ({ k, antes: a[k], despues: d[k] }))
})
const fmt = (v: unknown) => (v === undefined ? '' : JSON.stringify(v))
const COLOR: Record<string, string> = {
  INSERT: 'text-emerald-600',
  UPDATE: 'text-amber-600',
  VIEW: 'text-sky-600',
}
</script>

<template>
  <div class="card">
    <div class="flex flex-wrap items-end gap-3 p-3">
      <div>
        <label class="label" for="at">Tabla</label
        ><select id="at" v-model="f.tabla" class="input">
          <option value="">Todas</option>
          <option v-for="t in TABLAS" :key="t">{{ t }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="aa">Acción</label
        ><select id="aa" v-model="f.accion" class="input">
          <option value="">Todas</option>
          <option>INSERT</option>
          <option>UPDATE</option>
          <option>VIEW</option>
        </select>
      </div>
      <div>
        <label class="label" for="ar">ID de registro</label
        ><input id="ar" v-model.lazy="f.registroId" class="input w-32" />
      </div>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Tabla</th>
            <th>Registro</th>
            <th />
          </tr>
        </thead>
        <tbody :class="cargando && 'opacity-50'">
          <tr v-for="a in datos.items" :key="a.id">
            <td class="whitespace-nowrap text-xs">{{ fechaHora(a.fecha) }}</td>
            <td class="text-xs">{{ a.usuarioNombre || '—' }}</td>
            <td class="text-xs font-semibold" :class="COLOR[a.accion]">{{ a.accion }}</td>
            <td class="font-mono text-xs">{{ a.tabla }}</td>
            <td class="font-mono text-xs">{{ a.registroId }}</td>
            <td class="text-right">
              <button class="btn-ghost btn-sm" @click="sel = a">Detalle</button>
            </td>
          </tr>
          <tr v-if="!datos.items.length && !cargando">
            <td colspan="6" class="py-10 text-center text-slate-500">Sin eventos.</td>
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

  <Modal
    :abierto="!!sel"
    :titulo="sel ? `${sel.accion} · ${sel.tabla} #${sel.registroId}` : ''"
    ancho="max-w-3xl"
    @cerrar="sel = null"
  >
    <div class="table-wrap max-h-96 overflow-y-auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Antes</th>
            <th>Después</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cambios" :key="c.k">
            <td class="font-mono text-xs">{{ c.k }}</td>
            <td class="break-all font-mono text-xs text-rose-600 dark:text-rose-400">
              {{ fmt(c.antes) }}
            </td>
            <td class="break-all font-mono text-xs text-emerald-700 dark:text-emerald-400">
              {{ fmt(c.despues) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Modal>
</template>

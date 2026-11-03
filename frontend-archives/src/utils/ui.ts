export type Rol =
  'ROLE_ADMIN' | 'ROLE_VENTANILLA' | 'ROLE_JEFE' | 'ROLE_TECNICO' | 'ROLE_ARCHIVISTA'

export const ROLES: Record<Rol, string> = {
  ROLE_ADMIN: 'Administrador',
  ROLE_VENTANILLA: 'Ventanilla',
  ROLE_JEFE: 'Jefe de unidad',
  ROLE_TECNICO: 'Técnico',
  ROLE_ARCHIVISTA: 'Archivista',
}

const SKY =
  'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30'
const AMBER =
  'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30'
const EMERALD =
  'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30'
const SLATE =
  'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30'
const ROSE =
  'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30'
const ORANGE =
  'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/30'

export const ESTADO_CLASES: Record<string, string> = {
  REGISTRADO: SKY,
  DERIVADO: AMBER,
  CONCLUIDO: EMERALD,
  ARCHIVADO: SLATE,
  ABIERTO: SKY,
  CERRADO: EMERALD,
  TRANSFERIDO: SLATE,
  SOLICITADA: AMBER,
  APROBADA: EMERALD,
  RECHAZADA: ROSE,
  NORMAL: SLATE,
  URGENTE: ORANGE,
  MUY_URGENTE: ROSE,
}

export const TIPOS_DOC: Record<string, string> = {
  ORIGEN: 'Documento de origen',
  INFORME_TECNICO: 'Informe técnico',
  INFORME_LEGAL: 'Informe legal',
  NOTA: 'Nota',
  CARTA: 'Carta',
  RESOLUCION: 'Resolución',
  PROVEIDO: 'Proveído',
  OTRO: 'Otro',
}

export const etiqueta = (s?: string | null) =>
  s
    ? s
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase())
    : ''

const fFecha = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/La_Paz',
})
const fFechaHora = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/La_Paz',
})

/** Acepta 'YYYY-MM-DD' (fecha pura, sin desfase horario) o ISO con hora. */
export function fecha(v?: string | null): string {
  if (!v) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/')
  return fFecha.format(new Date(v))
}
export const fechaHora = (v?: string | null) =>
  v ? fFechaHora.format(new Date(v)).replace(',', '') : '—'

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Texto y clase para los días restantes de un plazo. */
export function plazo(dias?: number | null): { texto: string; clase: string } | null {
  if (dias == null) return null
  if (dias < 0) return { texto: `Vencido hace ${-dias} d`, clase: ROSE }
  if (dias === 0) return { texto: 'Vence hoy', clase: ROSE }
  if (dias <= 2) return { texto: `${dias} d restantes`, clase: AMBER }
  return { texto: `${dias} d restantes`, clase: SLATE }
}

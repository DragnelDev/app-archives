const BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

let onNoAutorizado: () => void = () => {}
let onCambioPassword: () => void = () => {}
let tokenActual: () => string | null = () => null
export function configurarApi(cfg: {
  token: () => string | null
  noAutorizado: () => void
  cambioPassword: () => void
}) {
  tokenActual = cfg.token
  onNoAutorizado = cfg.noAutorizado
  onCambioPassword = cfg.cambioPassword
}

interface Opciones {
  body?: unknown
  form?: FormData
  query?: Record<string, unknown>
  signal?: AbortSignal
}

function url(path: string, query?: Record<string, unknown>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const s = q.toString()
  return `${BASE}${path}${s ? `?${s}` : ''}`
}

async function pedir(method: string, path: string, o: Opciones = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  const t = tokenActual()
  if (t) headers.Authorization = `Bearer ${t}`
  if (o.body !== undefined) headers['Content-Type'] = 'application/json'
  let r: Response
  try {
    r = await fetch(url(path, o.query), {
      method,
      headers,
      body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
      signal: o.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }
  if (!r.ok) {
    let msg = `Error ${r.status}`,
      code: string | undefined
    try {
      const j = await r.json()
      msg = Array.isArray(j.message) ? j.message.join(' · ') : (j.message ?? msg)
      code = j.error
    } catch {
      /* cuerpo no JSON */
    }
    if (r.status === 401 && path !== '/auth/login') onNoAutorizado()
    if (r.status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') onCambioPassword()
    throw new ApiError(r.status, msg, code)
  }
  return r
}

async function json<T>(method: string, path: string, o?: Opciones): Promise<T> {
  const r = await pedir(method, path, o)
  return (r.status === 204 ? undefined : await r.json()) as T
}

export const api = {
  get: <T = any>(p: string, query?: Record<string, unknown>, signal?: AbortSignal) =>
    json<T>('GET', p, { query, signal }),
  post: <T = any>(p: string, body?: unknown) => json<T>('POST', p, { body: body ?? {} }),
  put: <T = any>(p: string, body?: unknown) => json<T>('PUT', p, { body }),
  delete: <T = any>(p: string) => json<T>('DELETE', p),
  upload: <T = any>(p: string, form: FormData) => json<T>('POST', p, { form }),
  /** Descarga un binario autenticado (PDF) y lo expone como URL local para el visor: no se guarda en disco. */
  async blobUrl(p: string): Promise<string> {
    const r = await pedir('GET', p)
    return URL.createObjectURL(await r.blob())
  },
}

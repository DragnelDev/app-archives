/** snake_case -> camelCase, recursivo (las consultas SQL crudas devuelven snake_case). */
export function toCamel<T = any>(v: any): T {
  if (Array.isArray(v)) return v.map(toCamel) as any;
  if (
    v &&
    typeof v === 'object' &&
    !(v instanceof Date) &&
    !Buffer.isBuffer(v)
  ) {
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [
        k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()),
        toCamel(x),
      ]),
    ) as any;
  }
  return v;
}

/**
 * TypeORM devuelve `[filas, n]` para UPDATE/DELETE ... RETURNING y `filas` para SELECT/INSERT.
 * Normaliza ambos casos a un arreglo de filas.
 */
export function filas<T = any>(r: any): T[] {
  if (
    Array.isArray(r) &&
    r.length === 2 &&
    Array.isArray(r[0]) &&
    typeof r[1] === 'number'
  )
    return r[0];
  return r as T[];
}

const TZ = 'America/La_Paz';

/** Fecha (YYYY-MM-DD) hoy en Bolivia. */
export function hoyBolivia(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function gestionActual(d = new Date()): number {
  return Number(hoyBolivia(d).slice(0, 4));
}

/** Suma días hábiles (lunes a viernes) a una fecha YYYY-MM-DD. No considera feriados. */
export function sumarDiasHabiles(desde: string, dias: number): string {
  const [y, m, d] = desde.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(y, m - 1, d));
  let n = 0;
  while (n < dias) {
    f.setUTCDate(f.getUTCDate() + 1);
    const dow = f.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return f.toISOString().slice(0, 10);
}

export function pad(n: number, len = 5): string {
  return String(n).padStart(len, '0');
}

export interface Paginado<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export function paginar(pagina?: number, porPagina?: number) {
  const p = Math.max(1, Math.floor(pagina || 1));
  const l = Math.min(100, Math.max(1, Math.floor(porPagina || 20)));
  return { pagina: p, porPagina: l, offset: (p - 1) * l };
}

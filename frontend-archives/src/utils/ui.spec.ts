import { describe, expect, it } from 'vitest'
import { bytes, etiqueta, fecha, plazo } from './ui'

describe('formato', () => {
  it('fecha pura no sufre desfase de zona horaria', () =>
    expect(fecha('2026-03-01')).toBe('01/03/2026'))
  it('etiqueta', () => expect(etiqueta('MUY_URGENTE')).toBe('Muy urgente'))
  it('bytes', () => {
    expect(bytes(512)).toBe('512 B')
    expect(bytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
  it('plazo', () => {
    expect(plazo(-3)?.texto).toBe('Vencido hace 3 d')
    expect(plazo(0)?.texto).toBe('Vence hoy')
    expect(plazo(null)).toBeNull()
  })
})

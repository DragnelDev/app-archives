import { describe, expect, it } from 'vitest';
import {
  filas,
  gestionActual,
  hoyBolivia,
  pad,
  paginar,
  sumarDiasHabiles,
  toCamel,
} from './util.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import { visibilidadHR } from './acceso.js';
import { Rol } from './enums.js';

describe('util', () => {
  it('toCamel convierte claves anidadas y respeta fechas', () => {
    const d = new Date();
    expect(
      toCamel({
        hoja_ruta_id: 1,
        sub_obj: { foja_fin: 2 },
        lista: [{ a_b: 1 }],
        f: d,
      }),
    ).toEqual({
      hojaRutaId: 1,
      subObj: { fojaFin: 2 },
      lista: [{ aB: 1 }],
      f: d,
    });
  });
  it('filas normaliza el formato [filas, n] de UPDATE ... RETURNING', () => {
    expect(filas([[{ id: 1 }], 1])).toEqual([{ id: 1 }]);
    expect(filas([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
  });
  it('sumarDiasHabiles salta sábados y domingos', () => {
    expect(sumarDiasHabiles('2026-11-06', 1)).toBe('2026-11-09'); // viernes -> lunes
    expect(sumarDiasHabiles('2026-11-02', 5)).toBe('2026-11-09');
    expect(sumarDiasHabiles('2026-11-07', 1)).toBe('2026-11-09'); // sábado -> lunes
  });
  it('pad, paginar y gestión', () => {
    expect(pad(7)).toBe('00007');
    expect(paginar(3, 500)).toEqual({ pagina: 3, porPagina: 100, offset: 200 });
    expect(paginar(0, 0)).toEqual({ pagina: 1, porPagina: 20, offset: 0 });
    expect(hoyBolivia(new Date('2026-01-01T02:00:00Z'))).toBe('2025-12-31'); // UTC-4
    expect(gestionActual(new Date('2026-06-15T12:00:00Z'))).toBe(2026);
  });
});

describe('PDF', () => {
  it('detecta la firma %PDF y rechaza otros contenidos', () => {
    expect(DocumentosService.esPdf(Buffer.from('%PDF-1.7\n...contenido'))).toBe(
      true,
    );
    expect(
      DocumentosService.esPdf(
        Buffer.from('MZ\x90\x00 ejecutable disfrazado.pdf'),
      ),
    ).toBe(false);
    expect(DocumentosService.esPdf(Buffer.from('%PDF'))).toBe(false);
  });
});

describe('visibilidad por rol', () => {
  const u = (rol: Rol) => ({
    id: 7,
    unidadId: 3,
    rol,
    username: 'x',
    nombre: 'x',
    debeCambiarPassword: false,
  });
  it('Jefe filtra por unidad y Técnico por usuario', () => {
    expect(visibilidadHR(u(Rol.JEFE), 1).params).toEqual([3]);
    expect(visibilidadHR(u(Rol.TECNICO), 1).params).toEqual([7]);
  });
  it('Archivista solo ve concluidas/archivadas; Ventanilla todas', () => {
    expect(visibilidadHR(u(Rol.ARCHIVISTA), 1).sql).toContain('CONCLUIDO');
    expect(visibilidadHR(u(Rol.VENTANILLA), 1).sql).toBe('TRUE');
  });
});

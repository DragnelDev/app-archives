import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';

export const DEMO_PASSWORD = 'Demo#2026';

/**
 * Datos de DEMOSTRACIÓN (SEED_DEMO=true). El Cuadro de Clasificación real debe
 * elaborarlo el GAM junto con el ABNB; las series y plazos aquí son ilustrativos.
 */
export class DemoSeed {
  constructor(
    private readonly ds: DataSource,
    private readonly log: Logger,
  ) {}

  async ejecutar() {
    const [{ n }] = await this.ds.query(
      `SELECT count(*)::int AS n FROM unidades_organizacionales WHERE codigo = 'VEN'`,
    );
    if (n > 0) return;
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await this.ds.transaction(async (m) => {
      const unidades: [string, string, string, string][] = [
        ['VEN', 'Ventanilla Única de Correspondencia', 'VEN', 'VENTANILLA'],
        ['SMG', 'Secretaría Municipal General', 'SMG', 'SECRETARIA'],
        ['DAF', 'Dirección Administrativa Financiera', 'DAF', 'DIRECCION'],
        ['DJU', 'Dirección Jurídica', 'DJU', 'DIRECCION'],
        ['DOP', 'Dirección de Obras Públicas', 'DOP', 'DIRECCION'],
        ['ACE', 'Archivo Central', 'ACE', 'ARCHIVO'],
      ];
      const id: Record<string, number> = {};
      for (const [c, nombre, sigla, tipo] of unidades) {
        const [r] = await m.query(
          `INSERT INTO unidades_organizacionales (codigo,nombre,sigla,tipo) VALUES ($1,$2,$3,$4) RETURNING id`,
          [c, nombre, sigla, tipo],
        );
        id[c] = r.id;
      }
      const usuarios: [string, string, string, string, string, string][] = [
        [
          'ventanilla',
          'Ana',
          'Quispe Rojas',
          'ROLE_VENTANILLA',
          'VEN',
          'Encargada de Ventanilla',
        ],
        [
          'smg',
          'Roberto',
          'Vargas Peña',
          'ROLE_JEFE',
          'SMG',
          'Secretario Municipal General',
        ],
        [
          'jefe.daf',
          'Carlos',
          'Mamani Condori',
          'ROLE_JEFE',
          'DAF',
          'Director Administrativo Financiero',
        ],
        [
          'tecnico.daf',
          'Lucía',
          'Flores Ticona',
          'ROLE_TECNICO',
          'DAF',
          'Técnico Administrativo',
        ],
        [
          'jefe.dju',
          'Patricia',
          'Copa Mendoza',
          'ROLE_JEFE',
          'DJU',
          'Directora Jurídica',
        ],
        [
          'tecnico.dju',
          'Jorge',
          'Salinas Cruz',
          'ROLE_TECNICO',
          'DJU',
          'Abogado',
        ],
        [
          'jefe.dop',
          'Luis',
          'Choque Álvarez',
          'ROLE_JEFE',
          'DOP',
          'Director de Obras Públicas',
        ],
        [
          'tecnico.dop',
          'Marcela',
          'Gutiérrez Rojas',
          'ROLE_TECNICO',
          'DOP',
          'Ingeniera Civil',
        ],
        [
          'archivista',
          'Marcos',
          'Huanca Tola',
          'ROLE_ARCHIVISTA',
          'ACE',
          'Responsable de Archivo Central',
        ],
      ];
      for (const [u, nombres, apellidos, rol, un, cargo] of usuarios) {
        await m.query(
          `INSERT INTO usuarios (username,password_hash,nombres,apellidos,rol,unidad_id,cargo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [u, hash, nombres, apellidos, rol, id[un], cargo],
        );
      }
      const series: [string, string, number, number, string][] = [
        ['100.01', 'Correspondencia externa recibida', 2, 8, 'ELIMINACION'],
        ['200.01', 'Contratos y convenios', 5, 15, 'CONSERVACION_PERMANENTE'],
        [
          '300.01',
          'Procesos de contratación de bienes y servicios',
          3,
          10,
          'MUESTREO',
        ],
        [
          '400.01',
          'Proyectos de obra pública',
          5,
          20,
          'CONSERVACION_PERMANENTE',
        ],
        ['500.01', 'Informes legales', 2, 8, 'MUESTREO'],
        ['600.01', 'Trámites de personal', 3, 12, 'CONSERVACION_PERMANENTE'],
      ];
      for (const [c, nombre, g, ce, d] of series) {
        await m.query(
          `INSERT INTO cuadro_clasificacion (codigo,nombre,retencion_gestion_anios,retencion_central_anios,disposicion_final)
           VALUES ($1,$2,$3,$4,$5)`,
          [c, nombre, g, ce, d],
        );
      }
      let n = 1;
      for (const cuerpo of ['A', 'B']) {
        for (let balda = 1; balda <= 3; balda++) {
          await m.query(
            `INSERT INTO cajas_archivo (codigo,estante,cuerpo,balda,capacidad) VALUES ($1,'E01',$2,$3,8)`,
            [`CJ-${String(n++).padStart(4, '0')}`, cuerpo, balda],
          );
        }
      }
    });
    this.log.warn(
      `Datos demo cargados. Usuarios: ventanilla, smg, jefe.daf, tecnico.daf, jefe.dju, tecnico.dju, jefe.dop, tecnico.dop, archivista — contraseña "${DEMO_PASSWORD}"`,
    );
  }
}

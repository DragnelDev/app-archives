import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../common/decorators.js';
import { Rol, UsuarioSesion } from '../common/enums.js';
import { toCamel } from '../common/util.js';

/** Listas de apoyo para formularios (solo datos necesarios, para cualquier usuario autenticado). */
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly ds: DataSource) {}

  @Get('unidades')
  async unidades() {
    return toCamel(
      await this.ds.query(
        `SELECT id, codigo, nombre, sigla, tipo FROM unidades_organizacionales WHERE activo ORDER BY nombre`,
      ),
    );
  }

  @Get('series')
  async series() {
    return toCamel(
      await this.ds.query(
        `SELECT id, codigo, nombre, retencion_gestion_anios, retencion_central_anios, disposicion_final FROM cuadro_clasificacion WHERE activo ORDER BY codigo`,
      ),
    );
  }

  /** Funcionarios a quienes el usuario actual puede derivar según el flujo de su rol. */
  @Get('destinatarios')
  async destinatarios(@CurrentUser() u: UsuarioSesion) {
    const roles =
      u.rol === Rol.JEFE
        ? [Rol.JEFE, Rol.TECNICO]
        : u.rol === Rol.VENTANILLA || u.rol === Rol.TECNICO
          ? [Rol.JEFE]
          : [];
    return toCamel(
      await this.ds.query(
        `SELECT u.id, (u.nombres || ' ' || u.apellidos) AS nombre, u.cargo, u.rol, u.unidad_id, un.sigla AS unidad_sigla, un.nombre AS unidad_nombre
         FROM usuarios u JOIN unidades_organizacionales un ON un.id = u.unidad_id
        WHERE u.activo AND u.rol = ANY($1) AND u.id <> $2 ORDER BY un.nombre, u.apellidos`,
        [roles, u.id],
      ),
    );
  }

  @Get('parametros')
  async parametros() {
    return Object.fromEntries(
      (await this.ds.query(`SELECT clave, valor FROM parametros_sistema`)).map(
        (r: any) => [r.clave, r.valor],
      ),
    );
  }

  @Get('gestiones')
  async gestiones() {
    const r = await this.ds.query(
      `SELECT DISTINCT gestion FROM hojas_ruta ORDER BY gestion DESC`,
    );
    return r.map((x: any) => x.gestion);
  }
}

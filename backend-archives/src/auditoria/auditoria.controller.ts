import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../common/decorators.js';
import { Rol } from '../common/enums.js';
import { paginar, toCamel } from '../common/util.js';

@Roles(Rol.ADMIN)
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  async listar(
    @Query('tabla') tabla?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('accion') accion?: string,
    @Query('registroId') registroId?: string,
    @Query('pagina') pg?: string,
  ) {
    const { pagina, porPagina, offset } = paginar(Number(pg), 50);
    const rows = toCamel<any[]>(
      await this.ds.query(
        `SELECT a.id, a.tabla, a.registro_id, a.accion, a.usuario_id, (u.nombres || ' ' || u.apellidos) AS usuario_nombre,
              a.fecha, a.datos_antes, a.datos_despues, count(*) OVER ()::int AS total
         FROM audit_log a LEFT JOIN usuarios u ON u.id = a.usuario_id
        WHERE ($1::text IS NULL OR a.tabla = $1) AND ($2::int IS NULL OR a.usuario_id = $2)
          AND ($3::text IS NULL OR a.accion = $3) AND ($4::text IS NULL OR a.registro_id = $4)
        ORDER BY a.id DESC LIMIT $5 OFFSET $6`,
        [
          tabla || null,
          usuarioId ? Number(usuarioId) : null,
          accion || null,
          registroId || null,
          porPagina,
          offset,
        ],
      ),
    );
    return {
      items: rows.map(({ total, ...r }) => r),
      total: rows[0]?.total ?? 0,
      pagina,
      porPagina,
    };
  }

  /** Verifica la cadena de hash del historial de derivaciones de una Hoja de Ruta. */
  @Get('hoja-ruta/:id/verificar')
  async verificar(@Param('id', ParseIntPipe) id: number) {
    const [r] = await this.ds.query(
      `SELECT fn_verificar_cadena($1) AS integra, (SELECT count(*)::int FROM hoja_ruta_movimientos WHERE hoja_ruta_id = $1) AS movimientos`,
      [id],
    );
    return toCamel(r);
  }
}

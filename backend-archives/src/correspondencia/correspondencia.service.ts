import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  CrearHojaRutaDto,
  DerivarDto,
  ConcluirDto,
  FiltroHojasDto,
} from './correspondencia.dto.js';
import { EstadoHR, Rol, UsuarioSesion } from '../common/enums.js';
import { visibilidadHR } from '../common/acceso.js';
import {
  gestionActual,
  hoyBolivia,
  pad,
  paginar,
  sumarDiasHabiles,
  toCamel,
} from '../common/util.js';

/** Quién puede derivar a quién (flujo: Ventanilla → Jefe → Técnico → Jefe …). */
const DESTINOS_PERMITIDOS: Partial<Record<Rol, Rol[]>> = {
  [Rol.VENTANILLA]: [Rol.JEFE],
  [Rol.JEFE]: [Rol.JEFE, Rol.TECNICO],
  [Rol.TECNICO]: [Rol.JEFE],
};

@Injectable()
export class CorrespondenciaService {
  constructor(private readonly ds: DataSource) {}

  // ------------------------------------------------------------------ helpers
  async plazoPorDefecto(
    m: EntityManager | DataSource = this.ds,
  ): Promise<number> {
    const [p] = await m.query(
      `SELECT valor FROM parametros_sistema WHERE clave = 'plazo_dias_defecto'`,
    );
    return Number(p?.valor ?? 5);
  }

  private async hrBloqueada(m: EntityManager, id: number) {
    const [hr] = await m.query(
      `SELECT * FROM hojas_ruta WHERE id = $1 AND activo FOR UPDATE`,
      [id],
    );
    if (!hr) throw new NotFoundException('Hoja de Ruta no encontrada');
    return hr;
  }

  private async ultimoMovimiento(m: EntityManager, hrId: number) {
    const [mov] = await m.query(
      `SELECT * FROM hoja_ruta_movimientos WHERE hoja_ruta_id = $1 ORDER BY orden DESC LIMIT 1`,
      [hrId],
    );
    return mov;
  }

  /** El titular es quien tiene actualmente la HR, y debe haberla recepcionado. */
  private async exigirTitularConRecepcion(
    m: EntityManager,
    hr: any,
    u: UsuarioSesion,
  ) {
    if (hr.usuario_actual_id !== u.id)
      throw new ForbiddenException('La Hoja de Ruta no está en su bandeja');
    const mov = await this.ultimoMovimiento(m, hr.id);
    if (!mov?.fecha_recepcion)
      throw new UnprocessableEntityException(
        'Debe recepcionar la Hoja de Ruta antes de continuar',
      );
  }

  private async resolverJefe(
    m: EntityManager,
    dto: { destinatarioUsuarioId?: number; destinatarioUnidadId?: number },
  ) {
    const [d] = dto.destinatarioUsuarioId
      ? await m.query(
          `SELECT id, rol, unidad_id FROM usuarios WHERE id = $1 AND activo`,
          [dto.destinatarioUsuarioId],
        )
      : await m.query(
          `SELECT id, rol, unidad_id FROM usuarios WHERE unidad_id = $1 AND rol = 'ROLE_JEFE' AND activo ORDER BY id LIMIT 1`,
          [dto.destinatarioUnidadId],
        );
    if (!d)
      throw new UnprocessableEntityException(
        'La unidad destino no tiene un Jefe activo',
      );
    if (d.rol !== Rol.JEFE)
      throw new UnprocessableEntityException(
        'La correspondencia ingresa a través de un Jefe de unidad',
      );
    return d;
  }

  // ------------------------------------------------------------------ registro
  /** Ventanilla: registra la HR con correlativo por gestión y, opcionalmente, la deriva al Jefe destino. */
  async crear(dto: CrearHojaRutaDto, u: UsuarioSesion) {
    return this.ds.transaction(async (m) => {
      const gestion = gestionActual();
      const [{ n }] = await m.query(
        `SELECT fn_siguiente_correlativo($1, 'HR') AS n`,
        [gestion],
      );
      const codigo = `HR-${pad(n)}/${gestion}`;
      const [hr] = await m.query(
        `INSERT INTO hojas_ruta (gestion, numero, codigo, cite_origen, remitente, remitente_cargo, institucion_origen,
            asunto, tipo_documento, prioridad, fojas_iniciales, anexos, serie_id, unidad_actual_id, usuario_actual_id, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id, codigo`,
        [
          gestion,
          n,
          codigo,
          dto.citeOrigen ?? null,
          dto.remitente,
          dto.remitenteCargo ?? null,
          dto.institucionOrigen ?? null,
          dto.asunto,
          dto.tipoDocumento ?? 'EXTERNO',
          dto.prioridad ?? 'NORMAL',
          dto.fojasIniciales,
          dto.anexos ?? null,
          dto.serieId ?? null,
          u.unidadId,
          u.id,
        ],
      );
      // 1er movimiento: constancia de registro (auto-recepcionado por Ventanilla)
      await m.query(
        `INSERT INTO hoja_ruta_movimientos (hoja_ruta_id, orden, accion, remitente_usuario_id, remitente_unidad_id,
            destinatario_usuario_id, destinatario_unidad_id, proveido, fojas, fecha_recepcion, creado_por)
         VALUES ($1,0,'REGISTRO',$2,$3,$2,$3,'Registro de correspondencia en Ventanilla',$4, now(), $2)`,
        [hr.id, u.id, u.unidadId, dto.fojasIniciales],
      );

      if (dto.destinatarioUnidadId || dto.destinatarioUsuarioId) {
        const dest = await this.resolverJefe(m, dto);
        await this.insertarPase(
          m,
          hr.id,
          u,
          dest,
          'DERIVACION',
          dto.proveido?.trim() || 'Para su atención y trámite',
          dto.plazoDias ?? null,
          dto.fojasIniciales,
        );
      }
      return { id: hr.id, codigo: hr.codigo };
    });
  }

  private async insertarPase(
    m: EntityManager,
    hrId: number,
    u: UsuarioSesion,
    dest: { id: number; unidad_id: number; rol: string },
    accion: 'DERIVACION' | 'DEVOLUCION',
    proveido: string,
    plazoDias: number | null,
    fojas: number | null,
  ) {
    const plazo =
      plazoDias ??
      (dest.rol === Rol.TECNICO ? await this.plazoPorDefecto(m) : null);
    const limite = plazo ? sumarDiasHabiles(hoyBolivia(), plazo) : null;
    await m.query(
      `INSERT INTO hoja_ruta_movimientos (hoja_ruta_id, orden, accion, remitente_usuario_id, remitente_unidad_id,
          destinatario_usuario_id, destinatario_unidad_id, proveido, plazo_dias, fecha_limite, fojas, creado_por)
       VALUES ($1,0,$2,$3,$4,$5,$6,$7,$8,$9,$10,$3)`,
      [
        hrId,
        accion,
        u.id,
        u.unidadId,
        dest.id,
        dest.unidad_id,
        proveido,
        plazo,
        limite,
        fojas,
      ],
    );
    await m.query(
      `UPDATE hojas_ruta SET estado = 'DERIVADO', unidad_actual_id = $2, usuario_actual_id = $3, fecha_limite = $4,
              actualizado_por = $5 WHERE id = $1`,
      [hrId, dest.unidad_id, dest.id, limite, u.id],
    );
  }

  // ------------------------------------------------------------------ bandeja
  async listar(f: FiltroHojasDto, u: UsuarioSesion) {
    const { pagina, porPagina, offset } = paginar(f.pagina, f.porPagina);
    const vis = visibilidadHR(u, 1);
    const params: any[] = [...vis.params];
    const p = (v: any) => (params.push(v), `$${params.length}`);
    const where = ['h.activo', `(${vis.sql})`];
    if (f.gestion) where.push(`h.gestion = ${p(f.gestion)}`);
    if (f.estado) where.push(`h.estado = ${p(f.estado)}`);
    if (f.prioridad) where.push(`h.prioridad = ${p(f.prioridad)}`);
    if (f.q?.trim())
      where.push(
        `(coalesce(h.codigo,'') || ' ' || coalesce(h.cite_origen,'') || ' ' || h.remitente || ' ' || h.asunto) ILIKE ${p('%' + f.q.trim() + '%')}`,
      );
    if (f.bandeja === 'mia')
      where.push(
        `h.usuario_actual_id = ${p(u.id)} AND h.estado IN ('REGISTRADO','DERIVADO')`,
      );
    else if (f.bandeja === 'enviados')
      where.push(`h.usuario_actual_id IS DISTINCT FROM ${p(u.id)} AND EXISTS (SELECT 1 FROM hoja_ruta_movimientos em
                    WHERE em.hoja_ruta_id = h.id AND em.remitente_usuario_id = $${params.length} AND em.accion <> 'REGISTRO')`);
    else if (f.bandeja === 'vencidas')
      where.push(`h.estado = 'DERIVADO' AND h.fecha_limite < current_date`);

    const sql = `
      SELECT h.id, h.codigo, h.gestion, h.numero, h.cite_origen, h.remitente, h.institucion_origen, h.asunto, h.prioridad,
             h.estado, h.fecha_recepcion, h.fecha_limite, h.fojas_iniciales, h.usuario_actual_id,
             ua.sigla AS unidad_actual_sigla, (ur.nombres || ' ' || ur.apellidos) AS usuario_actual_nombre,
             CASE WHEN h.estado = 'DERIVADO' THEN (h.fecha_limite - current_date) END AS dias_restantes,
             COALESCE((SELECT m.fecha_recepcion IS NOT NULL FROM hoja_ruta_movimientos m
                        WHERE m.hoja_ruta_id = h.id ORDER BY m.orden DESC LIMIT 1), false) AS recibida,
             count(*) OVER ()::int AS total
        FROM hojas_ruta h
        LEFT JOIN unidades_organizacionales ua ON ua.id = h.unidad_actual_id
        LEFT JOIN usuarios ur ON ur.id = h.usuario_actual_id
       WHERE ${where.join(' AND ')}
       ORDER BY (h.prioridad = 'MUY_URGENTE') DESC, h.fecha_recepcion DESC, h.id DESC
       LIMIT ${p(porPagina)} OFFSET ${p(offset)}`;
    const rows = toCamel<any[]>(await this.ds.query(sql, params));
    return {
      items: rows.map(({ total, ...r }) => r),
      total: rows[0]?.total ?? 0,
      pagina,
      porPagina,
    };
  }

  // ------------------------------------------------------------------ detalle
  async puedeVer(hrId: number, u: UsuarioSesion): Promise<boolean> {
    const vis = visibilidadHR(u, 2);
    const r = await this.ds.query(
      `SELECT 1 FROM hojas_ruta h WHERE h.id = $1 AND h.activo AND (${vis.sql})`,
      [hrId, ...vis.params],
    );
    return r.length > 0;
  }

  async detalle(id: number, u: UsuarioSesion) {
    if (!(await this.puedeVer(id, u)))
      throw new NotFoundException('Hoja de Ruta no encontrada');
    const [hr] = await this.ds.query(
      `SELECT h.*, ua.nombre AS unidad_actual_nombre, ua.sigla AS unidad_actual_sigla,
              (ur.nombres || ' ' || ur.apellidos) AS usuario_actual_nombre,
              s.codigo AS serie_codigo, s.nombre AS serie_nombre,
              (h.fecha_limite - current_date) AS dias_restantes,
              (SELECT e.id FROM expedientes e WHERE e.hoja_ruta_id = h.id AND e.activo) AS expediente_id,
              fn_verificar_cadena(h.id) AS cadena_integra
         FROM hojas_ruta h
         LEFT JOIN unidades_organizacionales ua ON ua.id = h.unidad_actual_id
         LEFT JOIN usuarios ur ON ur.id = h.usuario_actual_id
         LEFT JOIN cuadro_clasificacion s ON s.id = h.serie_id
        WHERE h.id = $1`,
      [id],
    );
    const movimientos = await this.ds.query(
      `SELECT m.id, m.orden, m.accion, m.proveido, m.plazo_dias, m.fecha_limite, m.fojas, m.fecha_envio, m.fecha_recepcion,
              left(m.hash, 12) AS hash_corto,
              (r.nombres || ' ' || r.apellidos) AS remitente_nombre, r.cargo AS remitente_cargo,
              ur.sigla AS remitente_unidad,
              (d.nombres || ' ' || d.apellidos) AS destinatario_nombre, d.cargo AS destinatario_cargo,
              ud.sigla AS destinatario_unidad, m.destinatario_usuario_id
         FROM hoja_ruta_movimientos m
         JOIN usuarios r ON r.id = m.remitente_usuario_id
         JOIN unidades_organizacionales ur ON ur.id = m.remitente_unidad_id
         LEFT JOIN usuarios d ON d.id = m.destinatario_usuario_id
         LEFT JOIN unidades_organizacionales ud ON ud.id = m.destinatario_unidad_id
        WHERE m.hoja_ruta_id = $1 ORDER BY m.orden`,
      [id],
    );
    const documentos = await this.ds.query(
      `SELECT id, nombre_original, tamano_bytes, paginas, descripcion, fecha_creacion, sha256
         FROM documentos_digitales WHERE hoja_ruta_id = $1 AND activo ORDER BY id`,
      [id],
    );

    const ultimo = movimientos[movimientos.length - 1];
    const esTitular = hr.usuario_actual_id === u.id;
    const recibida = !!ultimo?.fecha_recepcion;
    const activa =
      hr.estado === EstadoHR.REGISTRADO || hr.estado === EstadoHR.DERIVADO;
    const permisos = {
      esTitular,
      puedeRecibir:
        hr.estado === EstadoHR.DERIVADO &&
        ultimo?.destinatario_usuario_id === u.id &&
        !recibida,
      puedeDerivar:
        esTitular && recibida && activa && u.rol in DESTINOS_PERMITIDOS,
      puedeConcluir:
        esTitular &&
        recibida &&
        hr.estado === EstadoHR.DERIVADO &&
        (u.rol === Rol.JEFE || u.rol === Rol.TECNICO),
      puedeFoliar:
        esTitular &&
        recibida &&
        hr.estado !== EstadoHR.ARCHIVADO &&
        u.rol !== Rol.ARCHIVISTA &&
        u.rol !== Rol.ADMIN,
      // Ventanilla puede completar su escaneo hasta que el destinatario recepcione la HR
      puedeAdjuntar:
        hr.estado !== EstadoHR.ARCHIVADO &&
        ((esTitular && recibida) ||
          (u.rol === Rol.VENTANILLA &&
            hr.creado_por === u.id &&
            (hr.estado === EstadoHR.REGISTRADO ||
              (hr.estado === EstadoHR.DERIVADO &&
                movimientos.length === 2 &&
                !recibida)))),
    };
    return toCamel({ ...hr, movimientos, documentos, permisos });
  }

  // ------------------------------------------------------------------ acciones
  async recibir(id: number, u: UsuarioSesion) {
    return this.ds.transaction(async (m) => {
      const hr = await this.hrBloqueada(m, id);
      const mov = await this.ultimoMovimiento(m, id);
      if (
        hr.estado !== EstadoHR.DERIVADO ||
        mov?.destinatario_usuario_id !== u.id
      )
        throw new ForbiddenException(
          'No tiene una Hoja de Ruta pendiente de recepción',
        );
      if (mov.fecha_recepcion)
        throw new UnprocessableEntityException(
          'La Hoja de Ruta ya fue recepcionada',
        );
      await m.query(
        `UPDATE hoja_ruta_movimientos SET fecha_recepcion = now(), actualizado_por = $2 WHERE id = $1`,
        [mov.id, u.id],
      );
      return { ok: true };
    });
  }

  async derivar(id: number, dto: DerivarDto, u: UsuarioSesion) {
    const permitidos = DESTINOS_PERMITIDOS[u.rol];
    if (!permitidos)
      throw new ForbiddenException('Su rol no puede derivar Hojas de Ruta');
    return this.ds.transaction(async (m) => {
      const hr = await this.hrBloqueada(m, id);
      if (hr.estado !== EstadoHR.REGISTRADO && hr.estado !== EstadoHR.DERIVADO)
        throw new UnprocessableEntityException(
          `No puede derivarse una Hoja de Ruta ${hr.estado}`,
        );
      await this.exigirTitularConRecepcion(m, hr, u);
      const [dest] = await m.query(
        `SELECT id, rol, unidad_id FROM usuarios WHERE id = $1 AND activo`,
        [dto.destinatarioUsuarioId],
      );
      if (!dest)
        throw new UnprocessableEntityException(
          'Destinatario inexistente o inactivo',
        );
      if (dest.id === u.id)
        throw new UnprocessableEntityException('No puede derivarse a sí mismo');
      if (!permitidos.includes(dest.rol))
        throw new UnprocessableEntityException(
          'El destinatario no corresponde al flujo permitido para su rol',
        );
      await this.insertarPase(
        m,
        id,
        u,
        dest,
        u.rol === Rol.TECNICO ? 'DEVOLUCION' : 'DERIVACION',
        dto.proveido.trim(),
        dto.plazoDias ?? null,
        null,
      );
      return { ok: true };
    });
  }

  async concluir(id: number, dto: ConcluirDto, u: UsuarioSesion) {
    return this.ds.transaction(async (m) => {
      const hr = await this.hrBloqueada(m, id);
      if (hr.estado !== EstadoHR.DERIVADO)
        throw new UnprocessableEntityException(
          'Solo puede concluirse una Hoja de Ruta en trámite',
        );
      await this.exigirTitularConRecepcion(m, hr, u);
      await m.query(
        `INSERT INTO hoja_ruta_movimientos (hoja_ruta_id, orden, accion, remitente_usuario_id, remitente_unidad_id, proveido, fecha_recepcion, creado_por)
         VALUES ($1,0,'CONCLUSION',$2,$3,$4, now(), $2)`,
        [id, u.id, u.unidadId, dto.proveido.trim()],
      );
      await m.query(
        `UPDATE hojas_ruta SET estado = 'CONCLUIDO', fecha_conclusion = now(), fecha_limite = NULL, actualizado_por = $2 WHERE id = $1`,
        [id, u.id],
      );
      return { ok: true };
    });
  }
}

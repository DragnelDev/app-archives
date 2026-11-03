import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AprobarTransferenciaDto,
  CajaDto,
  RechazarTransferenciaDto,
  SolicitarTransferenciaDto,
} from './archivo.dto.js';
import { Caja } from '../database/entities.js';
import { Rol, UsuarioSesion } from '../common/enums.js';
import { gestionActual, pad, toCamel } from '../common/util.js';

@Injectable()
export class ArchivoService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Caja) private readonly cajas: Repository<Caja>,
  ) {}

  async solicitar(dto: SolicitarTransferenciaDto, u: UsuarioSesion) {
    const ids = [...new Set(dto.expedienteIds)];
    return this.ds.transaction(async (m) => {
      const exps = await m.query(
        `SELECT e.id, e.codigo, e.estado, e.unidad_productora_id,
                (SELECT coalesce(max(foja_fin),0) FROM documentos_internos d WHERE d.expediente_id = e.id AND d.activo)::int AS fojas
           FROM expedientes e WHERE e.id = ANY($1) AND e.activo FOR UPDATE`,
        [ids],
      );
      if (exps.length !== ids.length)
        throw new NotFoundException('Algún expediente no existe');
      for (const e of exps) {
        if (e.unidad_productora_id !== u.unidadId)
          throw new ForbiddenException(
            `El expediente ${e.codigo} pertenece a otra unidad`,
          );
        if (e.estado !== 'CERRADO')
          throw new UnprocessableEntityException(
            `El expediente ${e.codigo} debe estar CERRADO (está ${e.estado})`,
          );
      }
      const gestion = gestionActual();
      const [{ n }] = await m.query(
        `SELECT fn_siguiente_correlativo($1, 'TR') AS n`,
        [gestion],
      );
      const codigo = `TR-${pad(n, 4)}/${gestion}`;
      const [t] = await m.query(
        `INSERT INTO transferencias (gestion, numero, codigo, unidad_origen_id, solicitante_id, observaciones, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$5) RETURNING id`,
        [gestion, n, codigo, u.unidadId, u.id, dto.observaciones ?? null],
      );
      for (const e of exps) {
        await m.query(
          `INSERT INTO detalle_transferencia_cajas (transferencia_id, expediente_id, fojas_total, creado_por) VALUES ($1,$2,$3,$4)`,
          [t.id, e.id, e.fojas, u.id],
        );
      }
      return { id: t.id, codigo };
    });
  }

  async listar(estado: string | undefined, u: UsuarioSesion) {
    const propias = u.rol === Rol.JEFE || u.rol === Rol.TECNICO;
    return toCamel(
      await this.ds.query(
        `SELECT t.id, t.codigo, t.estado, t.fecha_solicitud, t.fecha_aprobacion, un.sigla AS unidad_origen,
              (s.nombres || ' ' || s.apellidos) AS solicitante,
              (SELECT count(*)::int FROM detalle_transferencia_cajas d WHERE d.transferencia_id = t.id AND d.activo) AS expedientes
         FROM transferencias t JOIN unidades_organizacionales un ON un.id = t.unidad_origen_id
         JOIN usuarios s ON s.id = t.solicitante_id
        WHERE t.activo AND ($1::text IS NULL OR t.estado = $1) AND (NOT $2 OR t.unidad_origen_id = $3)
        ORDER BY t.id DESC LIMIT 200`,
        [estado ?? null, propias, u.unidadId],
      ),
    );
  }

  async obtener(id: number, u: UsuarioSesion) {
    const [t] = await this.ds.query(
      `SELECT t.*, un.sigla AS unidad_origen, un.nombre AS unidad_origen_nombre,
              (s.nombres || ' ' || s.apellidos) AS solicitante, (a.nombres || ' ' || a.apellidos) AS aprobador
         FROM transferencias t JOIN unidades_organizacionales un ON un.id = t.unidad_origen_id
         JOIN usuarios s ON s.id = t.solicitante_id LEFT JOIN usuarios a ON a.id = t.aprobado_por
        WHERE t.id = $1 AND t.activo`,
      [id],
    );
    if (
      !t ||
      ((u.rol === Rol.JEFE || u.rol === Rol.TECNICO) &&
        t.unidad_origen_id !== u.unidadId)
    )
      throw new NotFoundException('Transferencia no encontrada');
    const detalle = await this.ds.query(
      `SELECT d.id, d.expediente_id, d.fojas_total, d.caja_id, e.codigo AS expediente_codigo, e.titulo, e.fecha_cierre,
              h.codigo AS hoja_ruta_codigo, s.codigo AS serie_codigo, c.codigo AS caja_codigo,
              CASE WHEN c.id IS NOT NULL THEN c.estante || '-' || c.cuerpo || '-' || c.balda END AS ubicacion
         FROM detalle_transferencia_cajas d JOIN expedientes e ON e.id = d.expediente_id
         JOIN hojas_ruta h ON h.id = e.hoja_ruta_id LEFT JOIN cuadro_clasificacion s ON s.id = e.serie_id
         LEFT JOIN cajas_archivo c ON c.id = d.caja_id
        WHERE d.transferencia_id = $1 AND d.activo ORDER BY d.id`,
      [id],
    );
    return toCamel({ ...t, detalle });
  }

  async aprobar(id: number, dto: AprobarTransferenciaDto, u: UsuarioSesion) {
    return this.ds.transaction(async (m) => {
      const [t] = await m.query(
        `SELECT * FROM transferencias WHERE id = $1 AND activo FOR UPDATE`,
        [id],
      );
      if (!t) throw new NotFoundException('Transferencia no encontrada');
      if (t.estado !== 'SOLICITADA')
        throw new UnprocessableEntityException(
          `La transferencia ya está ${t.estado}`,
        );
      const detalle = await m.query(
        `SELECT id, expediente_id FROM detalle_transferencia_cajas WHERE transferencia_id = $1 AND activo`,
        [id],
      );
      const mapa = new Map(
        dto.asignaciones.map((a) => [a.expedienteId, a.cajaId]),
      );
      if (mapa.size !== dto.asignaciones.length)
        throw new UnprocessableEntityException(
          'Hay expedientes asignados más de una vez',
        );
      for (const d of detalle)
        if (!mapa.has(d.expediente_id))
          throw new UnprocessableEntityException(
            'Todos los expedientes deben tener una caja asignada',
          );
      if (mapa.size !== detalle.length)
        throw new UnprocessableEntityException(
          'Hay asignaciones de expedientes ajenos a la transferencia',
        );

      for (const d of detalle) {
        const [caja] = await m.query(
          `SELECT id, codigo, estante, cuerpo, balda FROM cajas_archivo WHERE id = $1 AND activo`,
          [mapa.get(d.expediente_id)],
        );
        if (!caja)
          throw new UnprocessableEntityException('Caja inexistente o inactiva');
        await m.query(
          `UPDATE detalle_transferencia_cajas SET caja_id = $2, actualizado_por = $3 WHERE id = $1`,
          [d.id, caja.id, u.id],
        );
        const [e] = await m.query(
          `UPDATE expedientes SET estado = 'TRANSFERIDO', actualizado_por = $2 WHERE id = $1 AND estado = 'CERRADO' RETURNING hoja_ruta_id`,
          [d.expediente_id, u.id],
        );
        const hrId = Array.isArray(e) ? e[0]?.hoja_ruta_id : e?.hoja_ruta_id;
        if (!hrId)
          throw new UnprocessableEntityException(
            'Un expediente de la transferencia ya no está CERRADO',
          );
        await m.query(
          `INSERT INTO hoja_ruta_movimientos (hoja_ruta_id, orden, accion, remitente_usuario_id, remitente_unidad_id, proveido, fecha_recepcion, creado_por)
           VALUES ($1,0,'ARCHIVO',$2,$3,$4, now(), $2)`,
          [
            hrId,
            u.id,
            u.unidadId,
            `Transferencia ${t.codigo} al Archivo Central. Caja ${caja.codigo} (estante ${caja.estante}, cuerpo ${caja.cuerpo}, balda ${caja.balda})`,
          ],
        );
        await m.query(
          `UPDATE hojas_ruta SET estado = 'ARCHIVADO', unidad_actual_id = $2, usuario_actual_id = $3, actualizado_por = $3 WHERE id = $1`,
          [hrId, u.unidadId, u.id],
        );
      }
      await m.query(
        `UPDATE transferencias SET estado = 'APROBADA', aprobado_por = $2, fecha_aprobacion = now(), actualizado_por = $2 WHERE id = $1`,
        [id, u.id],
      );
      return { ok: true };
    });
  }

  async rechazar(id: number, dto: RechazarTransferenciaDto, u: UsuarioSesion) {
    return this.ds.transaction(async (m) => {
      const r = await m.query(
        `UPDATE transferencias SET estado = 'RECHAZADA', motivo_rechazo = $2, aprobado_por = $3, fecha_aprobacion = now(), actualizado_por = $3
          WHERE id = $1 AND estado = 'SOLICITADA' AND activo RETURNING id`,
        [id, dto.motivo, u.id],
      );
      if (!(Array.isArray(r[0]) ? r[0].length : r.length))
        throw new UnprocessableEntityException(
          'Solo pueden rechazarse transferencias SOLICITADAS',
        );
      // Libera los expedientes para una nueva solicitud
      await m.query(
        `UPDATE detalle_transferencia_cajas SET activo = false, actualizado_por = $2 WHERE transferencia_id = $1`,
        [id, u.id],
      );
      return { ok: true };
    });
  }

  // ---------- Cajas y topografía ----------
  async listarCajas() {
    return toCamel(
      await this.ds.query(
        `SELECT c.id, c.codigo, c.estante, c.cuerpo, c.balda, c.capacidad, c.activo,
              (SELECT count(*)::int FROM detalle_transferencia_cajas d WHERE d.caja_id = c.id AND d.activo) AS ocupacion
         FROM cajas_archivo c WHERE c.activo ORDER BY c.estante, c.cuerpo, c.balda, c.codigo`,
      ),
    );
  }
  crearCaja(dto: CajaDto, u: UsuarioSesion) {
    return this.cajas.save(
      this.cajas.create({ ...dto, activo: true, creadoPor: u.id }),
    );
  }

  /** Mapa topográfico: ubicación exacta (estante, cuerpo, balda, caja) de cada expediente archivado. */
  async topografia(q: string | undefined, u: UsuarioSesion) {
    const propias = u.rol === Rol.JEFE || u.rol === Rol.TECNICO;
    return toCamel(
      await this.ds.query(
        `SELECT e.id AS expediente_id, e.codigo, e.titulo, e.fecha_cierre, h.codigo AS hoja_ruta_codigo, t.codigo AS transferencia_codigo,
              c.codigo AS caja_codigo, c.estante, c.cuerpo, c.balda, un.sigla AS unidad_sigla, d.fojas_total,
              s.codigo AS serie_codigo, s.nombre AS serie_nombre, s.disposicion_final,
              (e.fecha_cierre + make_interval(years => s.retencion_gestion_anios + s.retencion_central_anios))::date AS fin_retencion,
              COALESCE((e.fecha_cierre + make_interval(years => s.retencion_gestion_anios + s.retencion_central_anios))::date < current_date, false) AS retencion_vencida
         FROM detalle_transferencia_cajas d
         JOIN transferencias t ON t.id = d.transferencia_id AND t.estado = 'APROBADA'
         JOIN expedientes e ON e.id = d.expediente_id JOIN hojas_ruta h ON h.id = e.hoja_ruta_id
         JOIN cajas_archivo c ON c.id = d.caja_id JOIN unidades_organizacionales un ON un.id = e.unidad_productora_id
         LEFT JOIN cuadro_clasificacion s ON s.id = e.serie_id
        WHERE d.activo AND ($1::text IS NULL OR (e.codigo || ' ' || e.titulo || ' ' || c.codigo || ' ' || h.codigo) ILIKE $1)
          AND (NOT $2 OR e.unidad_productora_id = $3)
        ORDER BY c.estante, c.cuerpo, c.balda, c.codigo, e.codigo LIMIT 500`,
        [q?.trim() ? `%${q.trim()}%` : null, propias, u.unidadId],
      ),
    );
  }
}

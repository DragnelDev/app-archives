import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AbrirExpedienteDto,
  AgregarDocumentoDto,
  CerrarExpedienteDto,
} from './expedientes.dto.js';
import { CorrespondenciaService } from '../correspondencia/correspondencia.service.js';
import {
  EstadoHR,
  Rol,
  TipoDocumento,
  UsuarioSesion,
} from '../common/enums.js';
import { hoyBolivia, paginar, toCamel } from '../common/util.js';

@Injectable()
export class ExpedientesService {
  constructor(
    private readonly ds: DataSource,
    private readonly corr: CorrespondenciaService,
  ) {}

  /** Debe ser el titular de la HR (que ya la recepcionó) y no estar archivada. */
  private async exigirFoliador(hrId: number, u: UsuarioSesion) {
    const det = await this.corr.detalle(hrId, u);
    if (!det.permisos.puedeFoliar)
      throw new ForbiddenException(
        'Solo el titular que recepcionó la Hoja de Ruta puede foliar su expediente',
      );
    return det;
  }

  async abrir(dto: AbrirExpedienteDto, u: UsuarioSesion) {
    const det = await this.exigirFoliador(dto.hojaRutaId, u);
    if (det.expedienteId)
      throw new UnprocessableEntityException(
        'La Hoja de Ruta ya tiene expediente',
      );
    return this.ds.transaction(async (m) => {
      const [hr] = await m.query(
        `SELECT * FROM hojas_ruta WHERE id = $1 FOR UPDATE`,
        [dto.hojaRutaId],
      );
      const codigo = 'EXP-' + hr.codigo.replace(/^HR-/, '');
      const [e] = await m.query(
        `INSERT INTO expedientes (hoja_ruta_id, codigo, serie_id, unidad_productora_id, titulo, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          hr.id,
          codigo,
          dto.serieId ?? hr.serie_id,
          u.unidadId,
          (dto.titulo ?? hr.asunto).slice(0, 300),
          u.id,
        ],
      );
      // Foja(s) iniciales de la correspondencia: documento de origen, foliado desde la foja 1
      await m.query(
        `INSERT INTO documentos_internos (expediente_id, cuerpo_id, tipo, cite, titulo, foja_inicio, foja_fin, autor_id, creado_por)
         VALUES ($1, NULL, 'ORIGEN', $2, $3, 1, $4, $5, $5)`,
        [
          e.id,
          hr.cite_origen,
          `Documento de origen: ${hr.asunto}`.slice(0, 300),
          hr.fojas_iniciales,
          u.id,
        ],
      );
      return { id: e.id, codigo };
    });
  }

  async listar(
    f: { estado?: string; q?: string; pagina?: number; porPagina?: number },
    u: UsuarioSesion,
  ) {
    const { pagina, porPagina, offset } = paginar(f.pagina, f.porPagina);
    const params: any[] = [];
    const p = (v: any) => (params.push(v), `$${params.length}`);
    const where = ['e.activo'];
    if (u.rol === Rol.JEFE || u.rol === Rol.TECNICO)
      where.push(`e.unidad_productora_id = ${p(u.unidadId)}`);
    if (f.estado) where.push(`e.estado = ${p(f.estado)}`);
    if (f.q?.trim())
      where.push(
        `(e.codigo || ' ' || e.titulo) ILIKE ${p('%' + f.q.trim() + '%')}`,
      );
    const rows = toCamel<any[]>(
      await this.ds.query(
        `SELECT e.id, e.codigo, e.titulo, e.estado, e.fecha_apertura, e.fecha_cierre, un.sigla AS unidad_sigla,
              h.codigo AS hoja_ruta_codigo, s.codigo AS serie_codigo,
              (SELECT coalesce(max(d.foja_fin),0) FROM documentos_internos d WHERE d.expediente_id = e.id AND d.activo)::int AS total_fojas,
              count(*) OVER ()::int AS total
         FROM expedientes e JOIN hojas_ruta h ON h.id = e.hoja_ruta_id
         JOIN unidades_organizacionales un ON un.id = e.unidad_productora_id
         LEFT JOIN cuadro_clasificacion s ON s.id = e.serie_id
        WHERE ${where.join(' AND ')} ORDER BY e.id DESC LIMIT ${p(porPagina)} OFFSET ${p(offset)}`,
        params,
      ),
    );
    return {
      items: rows.map(({ total, ...r }) => r),
      total: rows[0]?.total ?? 0,
      pagina,
      porPagina,
    };
  }

  async obtener(id: number, u: UsuarioSesion) {
    const [e] = await this.ds.query(
      `SELECT e.*, h.codigo AS hoja_ruta_codigo, h.estado AS hoja_ruta_estado, h.usuario_actual_id,
              s.codigo AS serie_codigo, s.nombre AS serie_nombre, s.retencion_gestion_anios,
              s.retencion_central_anios, s.disposicion_final, un.sigla AS unidad_sigla
         FROM expedientes e JOIN hojas_ruta h ON h.id = e.hoja_ruta_id
         JOIN unidades_organizacionales un ON un.id = e.unidad_productora_id
         LEFT JOIN cuadro_clasificacion s ON s.id = e.serie_id
        WHERE e.id = $1 AND e.activo`,
      [id],
    );
    if (!e || !(await this.corr.puedeVer(e.hoja_ruta_id, u)))
      throw new NotFoundException('Expediente no encontrado');
    const cuerpos = await this.ds.query(
      `SELECT id, numero_cuerpo, foja_inicio, foja_fin, (foja_fin - foja_inicio + 1) AS fojas
         FROM expediente_cuerpos WHERE expediente_id = $1 AND activo ORDER BY numero_cuerpo`,
      [id],
    );
    const documentos = await this.ds.query(
      `SELECT d.id, d.cuerpo_id, c.numero_cuerpo, d.tipo, d.cite, d.titulo, d.fecha_documento, d.foja_inicio, d.foja_fin, d.fojas,
              d.archivo_id, (a.nombres || ' ' || a.apellidos) AS autor_nombre
         FROM documentos_internos d JOIN expediente_cuerpos c ON c.id = d.cuerpo_id
         LEFT JOIN usuarios a ON a.id = d.autor_id
        WHERE d.expediente_id = $1 AND d.activo ORDER BY d.foja_inicio`,
      [id],
    );
    const [{ ok }] = await this.ds.query(
      `SELECT coalesce(bool_and(foja_inicio = coalesce(prev, 0) + 1), true) AS ok FROM (
         SELECT foja_inicio, lag(foja_fin) OVER (ORDER BY foja_inicio) AS prev
           FROM documentos_internos WHERE expediente_id = $1 AND activo) x`,
      [id],
    );
    const [{ valor }] = await this.ds.query(
      `SELECT valor FROM parametros_sistema WHERE clave = 'fojas_por_cuerpo'`,
    );
    const totalFojas = documentos.length
      ? documentos[documentos.length - 1].foja_fin
      : 0;
    const titular = e.usuario_actual_id === u.id;
    const permisos = {
      puedeFoliar:
        titular &&
        e.estado === 'ABIERTO' &&
        [Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO].includes(u.rol),
      puedeCerrar:
        titular &&
        e.estado === 'ABIERTO' &&
        e.hoja_ruta_estado === EstadoHR.CONCLUIDO &&
        [Rol.JEFE, Rol.TECNICO].includes(u.rol),
    };
    const hasta = (anios: number | null) => {
      if (!e.fecha_cierre || anios == null) return null;
      const [y, mo, d] = e.fecha_cierre.split('-');
      return `${Number(y) + anios}-${mo}-${d}`;
    };
    return toCamel({
      ...e,
      cuerpos,
      documentos,
      total_fojas: totalFojas,
      siguiente_foja: totalFojas + 1,
      foliado_integro: ok,
      fojas_por_cuerpo: Number(valor),
      permisos,
      fin_retencion_gestion: hasta(e.retencion_gestion_anios),
      fin_retencion_central:
        e.retencion_gestion_anios == null
          ? null
          : hasta(e.retencion_gestion_anios + e.retencion_central_anios),
    });
  }

  private async hojaDeExpediente(m: EntityManager | DataSource, expId: number) {
    const [e] = await m.query(
      `SELECT id, hoja_ruta_id, estado, serie_id FROM expedientes WHERE id = $1 AND activo`,
      [expId],
    );
    if (!e) throw new NotFoundException('Expediente no encontrado');
    return e;
  }

  async agregarDocumento(
    expId: number,
    dto: AgregarDocumentoDto,
    u: UsuarioSesion,
  ) {
    const e = await this.hojaDeExpediente(this.ds, expId);
    await this.exigirFoliador(e.hoja_ruta_id, u);
    if (dto.archivoId) {
      const [a] = await this.ds.query(
        `SELECT 1 FROM documentos_digitales WHERE id = $1 AND hoja_ruta_id = $2 AND activo`,
        [dto.archivoId, e.hoja_ruta_id],
      );
      if (!a)
        throw new UnprocessableEntityException(
          'El PDF indicado no pertenece a esta Hoja de Ruta',
        );
    }
    // El trigger fn_doc_before_insert valida foliado correlativo, asigna/crea el cuerpo y bloquea concurrencia
    const [d] = await this.ds.query(
      `INSERT INTO documentos_internos (expediente_id, cuerpo_id, tipo, cite, titulo, fecha_documento, foja_inicio, foja_fin, autor_id, archivo_id, creado_por)
       VALUES ($1, NULL, $2, $3, $4, COALESCE($5::date, current_date), $6, $7, $8, $9, $8) RETURNING id, cuerpo_id, fojas`,
      [
        expId,
        dto.tipo,
        dto.cite ?? null,
        dto.titulo,
        dto.fechaDocumento ?? hoyBolivia(),
        dto.fojaInicio,
        dto.fojaFin,
        u.id,
        dto.archivoId ?? null,
      ],
    );
    return toCamel(d);
  }

  /** Solo el último documento foliado puede anularse (evita baches en la numeración). */
  async anularDocumento(docId: number, u: UsuarioSesion) {
    const [d] = await this.ds.query(
      `SELECT d.expediente_id, e.hoja_ruta_id FROM documentos_internos d
                                       JOIN expedientes e ON e.id = d.expediente_id WHERE d.id = $1 AND d.activo`,
      [docId],
    );
    if (!d) throw new NotFoundException('Documento no encontrado');
    await this.exigirFoliador(d.hoja_ruta_id, u);
    await this.ds.query(
      `UPDATE documentos_internos SET activo = false, actualizado_por = $2 WHERE id = $1`,
      [docId, u.id],
    );
  }

  async cerrar(expId: number, dto: CerrarExpedienteDto, u: UsuarioSesion) {
    const det0 = await this.hojaDeExpediente(this.ds, expId);
    const det = await this.exigirFoliador(det0.hoja_ruta_id, u);
    if (det.estado !== EstadoHR.CONCLUIDO)
      throw new UnprocessableEntityException(
        'La Hoja de Ruta debe estar CONCLUIDA para cerrar el expediente',
      );
    if (u.rol !== Rol.JEFE && u.rol !== Rol.TECNICO)
      throw new ForbiddenException('Rol sin permiso para cerrar expedientes');
    const serie = dto.serieId ?? det0.serie_id;
    if (!serie)
      throw new UnprocessableEntityException(
        'Debe asignarse la serie documental del Cuadro de Clasificación antes del cierre',
      );
    const r = await this.ds.query(
      `UPDATE expedientes SET estado = 'CERRADO', fecha_cierre = current_date, serie_id = $2, actualizado_por = $3
        WHERE id = $1 AND estado = 'ABIERTO' RETURNING id`,
      [expId, serie, u.id],
    );
    if (!r.length)
      throw new UnprocessableEntityException('El expediente no está abierto');
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Serie, Unidad, Usuario } from '../database/entities.js';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  SerieDto,
  UnidadDto,
} from './administracion.dto.js';
import { toCamel } from '../common/util.js';
import type { UsuarioSesion } from '../common/enums.js';

@Injectable()
export class AdministracionService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Unidad) private readonly unidades: Repository<Unidad>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Serie) private readonly series: Repository<Serie>,
  ) {}

  // ---------- Unidades ----------
  async listarUnidades() {
    return toCamel(
      await this.ds.query(
        `SELECT u.*, p.sigla AS padre_sigla,
              (SELECT count(*)::int FROM usuarios x WHERE x.unidad_id = u.id AND x.activo) AS usuarios
         FROM unidades_organizacionales u LEFT JOIN unidades_organizacionales p ON p.id = u.padre_id
        ORDER BY u.codigo`,
      ),
    );
  }
  crearUnidad(dto: UnidadDto, actor: UsuarioSesion) {
    return this.unidades.save(
      this.unidades.create({
        ...dto,
        activo: dto.activo ?? true,
        creadoPor: actor.id,
      }),
    );
  }
  async actualizarUnidad(id: number, dto: UnidadDto, actor: UsuarioSesion) {
    if (dto.padreId === id)
      throw new BadRequestException('Una unidad no puede ser su propio padre');
    const u = await this.unidades.findOneBy({ id });
    if (!u) throw new NotFoundException('Unidad no encontrada');
    return this.unidades.save(
      Object.assign(u, dto, { actualizadoPor: actor.id }),
    );
  }

  // ---------- Usuarios ----------
  async listarUsuarios(q?: string) {
    const like = q ? `%${q}%` : null;
    return toCamel(
      await this.ds.query(
        `SELECT u.id, u.username, u.nombres, u.apellidos, u.ci, u.cargo, u.email, u.rol, u.unidad_id,
              un.sigla AS unidad_sigla, u.activo, u.ultimo_acceso, u.debe_cambiar_password,
              (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > now()) AS bloqueado
         FROM usuarios u JOIN unidades_organizacionales un ON un.id = u.unidad_id
        WHERE ($1::text IS NULL OR u.username ILIKE $1 OR u.nombres ILIKE $1 OR u.apellidos ILIKE $1 OR u.ci ILIKE $1)
        ORDER BY u.apellidos, u.nombres`,
        [like],
      ),
    );
  }
  async crearUsuario(dto: CrearUsuarioDto, actor: UsuarioSesion) {
    const { password, ...resto } = dto;
    const u = await this.usuarios.save(
      this.usuarios.create({
        ...resto,
        passwordHash: await bcrypt.hash(password, 12),
        debeCambiarPassword: true,
        creadoPor: actor.id,
      }),
    );
    return { id: u.id };
  }
  async actualizarUsuario(
    id: number,
    dto: ActualizarUsuarioDto,
    actor: UsuarioSesion,
  ) {
    if (
      id === actor.id &&
      (dto.activo === false || (dto.rol && dto.rol !== actor.rol))
    )
      throw new BadRequestException(
        'No puede desactivarse ni cambiar su propio rol',
      );
    const u = await this.usuarios.findOneBy({ id });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    await this.usuarios.save(
      Object.assign(u, dto, { actualizadoPor: actor.id }),
    );
    return { id };
  }
  /** Restablece la contraseña: devuelve una clave temporal (se muestra una sola vez). */
  async restablecerPassword(id: number, actor: UsuarioSesion) {
    const temporal = 'Tmp' + randomBytes(5).toString('hex') + '7';
    const r = await this.ds.query(
      `UPDATE usuarios SET password_hash = $2, debe_cambiar_password = true, intentos_fallidos = 0,
              bloqueado_hasta = NULL, actualizado_por = $3 WHERE id = $1 RETURNING id`,
      [id, await bcrypt.hash(temporal, 12), actor.id],
    );
    if (!r.length) throw new NotFoundException('Usuario no encontrado');
    return { passwordTemporal: temporal };
  }

  // ---------- Cuadro de Clasificación (ICA) ----------
  async listarSeries() {
    return toCamel(
      await this.ds.query(
        `SELECT c.*, u.sigla AS unidad_sigla FROM cuadro_clasificacion c
         LEFT JOIN unidades_organizacionales u ON u.id = c.unidad_id ORDER BY c.codigo`,
      ),
    );
  }
  crearSerie(dto: SerieDto, actor: UsuarioSesion) {
    return this.series.save(
      this.series.create({
        ...dto,
        activo: dto.activo ?? true,
        creadoPor: actor.id,
      }),
    );
  }
  async actualizarSerie(id: number, dto: SerieDto, actor: UsuarioSesion) {
    const s = await this.series.findOneBy({ id });
    if (!s) throw new NotFoundException('Serie no encontrada');
    return this.series.save(
      Object.assign(s, dto, { actualizadoPor: actor.id }),
    );
  }
}

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import { toCamel } from '../common/util.js';
import { Rol, UsuarioSesion } from '../common/enums.js';

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
// Hash ficticio para igualar tiempos cuando el usuario no existe (evita enumeración de usuarios)
const HASH_FALSO =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5X1o5bmcvWw8gOQoQeZ0kYBd5dQ1m9W';

@Injectable()
export class AuthService {
  constructor(
    private readonly ds: DataSource,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const [u] = await this.ds.query(
      `SELECT * FROM usuarios WHERE lower(username) = lower($1)`,
      [username],
    );
    const bloqueado =
      u?.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date();
    const ok = await bcrypt.compare(password, u?.password_hash ?? HASH_FALSO);
    if (!u || !u.activo || bloqueado || !ok) {
      if (u && u.activo && !ok) {
        await this.ds.query(
          `UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1,
             bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END
           WHERE id = $1`,
          [u.id, MAX_INTENTOS, BLOQUEO_MIN],
        );
      }
      if (bloqueado)
        throw new UnauthorizedException(
          `Cuenta bloqueada temporalmente. Intente en ${BLOQUEO_MIN} minutos.`,
        );
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    await this.ds.query(
      `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = now() WHERE id = $1`,
      [u.id],
    );
    const accessToken = await this.jwt.signAsync({ sub: u.id, rol: u.rol });
    return { accessToken, usuario: await this.perfil(u.id) };
  }

  /** Valida el JWT y recarga al usuario (una baja o cambio de rol surte efecto de inmediato). */
  async verificarToken(token: string): Promise<UsuarioSesion> {
    let payload: { sub: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    const [u] = await this.ds.query(
      `SELECT id, username, nombres, apellidos, rol, unidad_id, debe_cambiar_password
         FROM usuarios WHERE id = $1 AND activo`,
      [payload.sub],
    );
    if (!u) throw new UnauthorizedException('Usuario inactivo');
    return {
      id: u.id,
      username: u.username,
      nombre: `${u.nombres} ${u.apellidos}`,
      rol: u.rol as Rol,
      unidadId: u.unidad_id,
      debeCambiarPassword: u.debe_cambiar_password,
    };
  }

  async perfil(id: number) {
    const [u] = await this.ds.query(
      `SELECT u.id, u.username, u.nombres, u.apellidos, u.cargo, u.email, u.rol, u.unidad_id,
              un.nombre AS unidad_nombre, un.sigla AS unidad_sigla, u.debe_cambiar_password
         FROM usuarios u JOIN unidades_organizacionales un ON un.id = u.unidad_id WHERE u.id = $1`,
      [id],
    );
    return toCamel(u);
  }

  async cambiarPassword(id: number, actual: string, nueva: string) {
    const [u] = await this.ds.query(
      `SELECT password_hash FROM usuarios WHERE id = $1`,
      [id],
    );
    if (!u || !(await bcrypt.compare(actual, u.password_hash)))
      throw new BadRequestException('La contraseña actual es incorrecta');
    if (actual === nueva)
      throw new BadRequestException('La nueva contraseña debe ser distinta');
    const hash = await bcrypt.hash(nueva, 12);
    await this.ds.query(
      `UPDATE usuarios SET password_hash = $2, debe_cambiar_password = false, actualizado_por = $1 WHERE id = $1`,
      [id, hash],
    );
  }
}

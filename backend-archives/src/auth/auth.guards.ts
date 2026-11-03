import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import {
  IS_PUBLIC,
  PERMITIR_CAMBIO_PASSWORD,
  ROLES_KEY,
} from '../common/decorators.js';
import { Rol } from '../common/enums.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, objetivos))
      return true;
    const req = ctx.switchToHttp().getRequest();
    const h: string | undefined = req.headers.authorization;
    if (!h?.startsWith('Bearer '))
      throw new UnauthorizedException('Se requiere autenticación');
    req.user = await this.auth.verificarToken(h.slice(7));
    if (
      req.user.debeCambiarPassword &&
      !this.reflector.getAllAndOverride<boolean>(
        PERMITIR_CAMBIO_PASSWORD,
        objetivos,
      )
    ) {
      throw new ForbiddenException({
        message: 'Debe cambiar su contraseña antes de continuar',
        error: 'PASSWORD_CHANGE_REQUIRED',
      });
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.rol))
      throw new ForbiddenException('No tiene permisos para esta operación');
    return true;
  }
}

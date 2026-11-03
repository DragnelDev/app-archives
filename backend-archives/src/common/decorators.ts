import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Rol, UsuarioSesion } from './enums.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';
export const PERMITIR_CAMBIO_PASSWORD = 'permitirCambioPassword';

/** Endpoint sin autenticación (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Restringe el endpoint a los roles indicados (RolesGuard). Sin decorador = cualquier usuario autenticado. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
/** Permite el acceso aun cuando el usuario debe cambiar su contraseña. */
export const PermitirCambioPassword = () =>
  SetMetadata(PERMITIR_CAMBIO_PASSWORD, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion =>
    ctx.switchToHttp().getRequest().user,
);

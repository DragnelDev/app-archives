import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service.js';
import {
  CurrentUser,
  PermitirCambioPassword,
  Public,
} from '../common/decorators.js';
import type { UsuarioSesion } from '../common/enums.js';

export class LoginDto {
  @IsString() @MaxLength(50) username!: string;
  @IsString() @MaxLength(100) password!: string;
}

export const REGEX_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export class CambiarPasswordDto {
  @IsString() actual!: string;
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(REGEX_PASSWORD, {
    message: 'La contraseña debe tener al menos 8 caracteres, letras y números',
  })
  nueva!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @PermitirCambioPassword()
  @Get('me')
  me(@CurrentUser() u: UsuarioSesion) {
    return this.auth.perfil(u.id);
  }

  @PermitirCambioPassword()
  @HttpCode(204)
  @Post('cambiar-password')
  async cambiar(
    @CurrentUser() u: UsuarioSesion,
    @Body() dto: CambiarPasswordDto,
  ) {
    await this.auth.cambiarPassword(u.id, dto.actual, dto.nueva);
  }
}

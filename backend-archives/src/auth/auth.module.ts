import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, RolesGuard } from './auth.guards.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const secret = cfg.get<string>('JWT_SECRET');
        if (!secret && cfg.get('NODE_ENV') === 'production')
          throw new Error('JWT_SECRET es obligatorio en producción');
        return {
          secret: secret || 'dev-only-secret-change-me',
          signOptions: { expiresIn: (cfg.get('JWT_EXPIRES') ?? '8h') as any },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1º autentica
    { provide: APP_GUARD, useClass: RolesGuard }, // 2º autoriza por rol
  ],
  exports: [AuthService],
})
export class AuthModule {}

import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createObserveModule } from '@nestjs/observe';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AdministracionModule } from './administracion/administracion.module.js';
import { CorrespondenciaModule } from './correspondencia/correspondencia.module.js';
import { DocumentosModule } from './documentos/documentos.module.js';
import { ExpedientesModule } from './expedientes/expedientes.module.js';
import { ArchivoModule } from './archivo/archivo.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AuditoriaController } from './auditoria/auditoria.controller.js';
import { CatalogosController } from './catalogos/catalogos.controller.js';
import { HealthController } from './health.controller.js';
import { PgExceptionFilter } from './common/pg-exception.filter.js';

// Telemetría opcional (NestJS Observe): solo se activa si hay credenciales en el entorno.
// En un GAM se recomienda NO activarla salvo decisión expresa (los datos salen del servidor institucional).
const observeActivo = Boolean(
  process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET,
);
export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ...(observeActivo
      ? [
          ObserveModule.forRoot({
            appKey: process.env.OBSERVE_APP_KEY!,
            appSecret: process.env.OBSERVE_APP_SECRET!,
            runtimeMetrics: !Boolean(process.versions?.['webcontainer']),
            serviceId: 'archivo-gam',
          }),
        ]
      : []),
    DatabaseModule,
    AuthModule,
    AdministracionModule,
    CorrespondenciaModule,
    DocumentosModule,
    ExpedientesModule,
    ArchivoModule,
    DashboardModule,
  ],
  controllers: [AuditoriaController, CatalogosController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: PgExceptionFilter },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ExpedientesController } from './expedientes.controller.js';
import { ExpedientesService } from './expedientes.service.js';

@Module({
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
})
export class ExpedientesModule {}

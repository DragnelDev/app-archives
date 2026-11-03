import { Module } from '@nestjs/common';
import { AdministracionController } from './administracion.controller.js';
import { AdministracionService } from './administracion.service.js';

@Module({
  controllers: [AdministracionController],
  providers: [AdministracionService],
})
export class AdministracionModule {}

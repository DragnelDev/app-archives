import { Global, Module } from '@nestjs/common';
import { CorrespondenciaController } from './correspondencia.controller.js';
import { CorrespondenciaService } from './correspondencia.service.js';

@Global()
@Module({
  controllers: [CorrespondenciaController],
  providers: [CorrespondenciaService],
  exports: [CorrespondenciaService],
})
export class CorrespondenciaModule {}

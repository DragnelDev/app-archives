import { Module } from '@nestjs/common';
import { ArchivoController } from './archivo.controller.js';
import { ArchivoService } from './archivo.service.js';

@Module({ controllers: [ArchivoController], providers: [ArchivoService] })
export class ArchivoModule {}

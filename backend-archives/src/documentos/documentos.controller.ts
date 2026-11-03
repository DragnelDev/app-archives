import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { DocumentosService, MAX_PDF_BYTES } from './documentos.service.js';
import type { ArchivoSubido } from './documentos.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Rol, UsuarioSesion } from '../common/enums.js';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly s: DocumentosService) {}

  @Roles(Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO)
  @Post('hoja-ruta/:id')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PDF_BYTES, files: 1 },
    }),
  )
  subir(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: ArchivoSubido,
    @Body('descripcion') descripcion: string | undefined,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.subir(id, file, descripcion, u);
  }

  /** Visualización en línea (inline): el visor de la interfaz lo consume sin descarga local. */
  @Get(':id/archivo')
  async ver(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = await this.s.abrir(id, u);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(a.bytes),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(a.stream);
  }

  @Roles(Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO)
  @HttpCode(204)
  @Delete(':id')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.eliminar(id, u);
  }
}

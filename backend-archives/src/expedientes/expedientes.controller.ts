import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ExpedientesService } from './expedientes.service.js';
import {
  AbrirExpedienteDto,
  AgregarDocumentoDto,
  CerrarExpedienteDto,
} from './expedientes.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Rol, UsuarioSesion } from '../common/enums.js';

@Controller('expedientes')
export class ExpedientesController {
  constructor(private readonly s: ExpedientesService) {}

  @Get() listar(@Query() f: any, @CurrentUser() u: UsuarioSesion) {
    return this.s.listar(
      {
        estado: f.estado,
        q: f.q,
        pagina: Number(f.pagina) || 1,
        porPagina: Number(f.porPagina) || 20,
      },
      u,
    );
  }
  @Roles(Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO)
  @Post()
  abrir(@Body() d: AbrirExpedienteDto, @CurrentUser() u: UsuarioSesion) {
    return this.s.abrir(d, u);
  }

  @Get(':id') obtener(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.obtener(id, u);
  }

  @Roles(Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO)
  @Post(':id/documentos')
  agregar(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: AgregarDocumentoDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.agregarDocumento(id, d, u);
  }

  @Roles(Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO)
  @HttpCode(204)
  @Post('documentos/:docId/anular')
  anular(
    @Param('docId', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.anularDocumento(id, u);
  }

  @Roles(Rol.JEFE, Rol.TECNICO)
  @HttpCode(204)
  @Post(':id/cerrar')
  cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: CerrarExpedienteDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.cerrar(id, d, u);
  }
}

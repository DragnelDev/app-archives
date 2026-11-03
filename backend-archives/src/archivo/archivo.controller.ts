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
import { ArchivoService } from './archivo.service.js';
import {
  AprobarTransferenciaDto,
  CajaDto,
  RechazarTransferenciaDto,
  SolicitarTransferenciaDto,
} from './archivo.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Rol, UsuarioSesion } from '../common/enums.js';

@Controller('archivo')
export class ArchivoController {
  constructor(private readonly s: ArchivoService) {}

  @Roles(Rol.JEFE, Rol.TECNICO)
  @Post('transferencias')
  solicitar(
    @Body() d: SolicitarTransferenciaDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.solicitar(d, u);
  }

  @Roles(Rol.JEFE, Rol.TECNICO, Rol.ARCHIVISTA, Rol.ADMIN)
  @Get('transferencias')
  listar(
    @Query('estado') estado: string | undefined,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.listar(estado, u);
  }

  @Roles(Rol.JEFE, Rol.TECNICO, Rol.ARCHIVISTA, Rol.ADMIN)
  @Get('transferencias/:id')
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.obtener(id, u);
  }

  @Roles(Rol.ARCHIVISTA)
  @HttpCode(200)
  @Post('transferencias/:id/aprobar')
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: AprobarTransferenciaDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.aprobar(id, d, u);
  }

  @Roles(Rol.ARCHIVISTA)
  @HttpCode(200)
  @Post('transferencias/:id/rechazar')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: RechazarTransferenciaDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.rechazar(id, d, u);
  }

  @Roles(Rol.ARCHIVISTA, Rol.ADMIN) @Get('cajas') cajas() {
    return this.s.listarCajas();
  }
  @Roles(Rol.ARCHIVISTA) @Post('cajas') crearCaja(
    @Body() d: CajaDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.crearCaja(d, u);
  }

  @Get('topografia') topografia(
    @Query('q') q: string | undefined,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.topografia(q, u);
  }
}

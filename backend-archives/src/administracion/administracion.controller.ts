import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AdministracionService } from './administracion.service.js';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  SerieDto,
  UnidadDto,
} from './administracion.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Rol, UsuarioSesion } from '../common/enums.js';

/** Todo el módulo es exclusivo de ROLE_ADMIN. */
@Roles(Rol.ADMIN)
@Controller('admin')
export class AdministracionController {
  constructor(private readonly s: AdministracionService) {}

  @Get('unidades') unidades() {
    return this.s.listarUnidades();
  }
  @Post('unidades') crearUnidad(
    @Body() d: UnidadDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.crearUnidad(d, u);
  }
  @Put('unidades/:id') actUnidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UnidadDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.actualizarUnidad(id, d, u);
  }

  @Get('usuarios') usuarios(@Query('q') q?: string) {
    return this.s.listarUsuarios(q);
  }
  @Post('usuarios') crearUsuario(
    @Body() d: CrearUsuarioDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.crearUsuario(d, u);
  }
  @Put('usuarios/:id') actUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ActualizarUsuarioDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.actualizarUsuario(id, d, u);
  }
  @HttpCode(200)
  @Post('usuarios/:id/restablecer-password')
  reset(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.restablecerPassword(id, u);
  }

  @Get('series') series() {
    return this.s.listarSeries();
  }
  @Post('series') crearSerie(
    @Body() d: SerieDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.crearSerie(d, u);
  }
  @Put('series/:id') actSerie(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: SerieDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.actualizarSerie(id, d, u);
  }
}

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
import { CorrespondenciaService } from './correspondencia.service.js';
import {
  ConcluirDto,
  CrearHojaRutaDto,
  DerivarDto,
  FiltroHojasDto,
} from './correspondencia.dto.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { Rol, UsuarioSesion } from '../common/enums.js';

@Controller('correspondencia')
export class CorrespondenciaController {
  constructor(private readonly s: CorrespondenciaService) {}

  @Get() listar(@Query() f: FiltroHojasDto, @CurrentUser() u: UsuarioSesion) {
    return this.s.listar(f, u);
  }

  @Roles(Rol.VENTANILLA)
  @Post()
  crear(@Body() d: CrearHojaRutaDto, @CurrentUser() u: UsuarioSesion) {
    return this.s.crear(d, u);
  }

  @Get(':id') detalle(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.detalle(id, u);
  }

  @Roles(Rol.JEFE, Rol.TECNICO)
  @HttpCode(200)
  @Post(':id/recibir')
  recibir(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.recibir(id, u);
  }

  @Roles(Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO)
  @HttpCode(200)
  @Post(':id/derivar')
  derivar(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: DerivarDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.derivar(id, d, u);
  }

  @Roles(Rol.JEFE, Rol.TECNICO)
  @HttpCode(200)
  @Post(':id/concluir')
  concluir(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ConcluirDto,
    @CurrentUser() u: UsuarioSesion,
  ) {
    return this.s.concluir(id, d, u);
  }
}

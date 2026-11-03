import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EstadoHR } from '../common/enums.js';

export class CrearHojaRutaDto {
  @IsOptional() @IsString() @MaxLength(100) citeOrigen?: string;
  @IsString() @MinLength(3) @MaxLength(200) remitente!: string;
  @IsOptional() @IsString() @MaxLength(150) remitenteCargo?: string;
  @IsOptional() @IsString() @MaxLength(200) institucionOrigen?: string;
  @IsString() @MinLength(5) @MaxLength(2000) asunto!: string;
  @IsOptional() @IsIn(['EXTERNO', 'INTERNO']) tipoDocumento?: string;
  @IsOptional() @IsIn(['NORMAL', 'URGENTE', 'MUY_URGENTE']) prioridad?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5000) fojasIniciales!: number;
  @IsOptional() @IsString() @MaxLength(200) anexos?: string;
  @IsOptional() @Type(() => Number) @IsInt() serieId?: number;
  /** Si se indica unidad o usuario destino, la HR se deriva inmediatamente al Jefe. */
  @IsOptional() @Type(() => Number) @IsInt() destinatarioUnidadId?: number;
  @IsOptional() @Type(() => Number) @IsInt() destinatarioUsuarioId?: number;
  @IsOptional() @IsString() @MaxLength(1000) proveido?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  plazoDias?: number;
}

export class DerivarDto {
  @Type(() => Number) @IsInt() destinatarioUsuarioId!: number;
  @IsString() @MinLength(3) @MaxLength(1000) proveido!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  plazoDias?: number;
}

export class ConcluirDto {
  @IsString() @MinLength(3) @MaxLength(1000) proveido!: string;
}

export class FiltroHojasDto {
  @IsOptional() @Type(() => Number) @IsInt() gestion?: number;
  @IsOptional() @IsIn(Object.values(EstadoHR)) estado?: EstadoHR;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional()
  @IsIn(['mia', 'enviados', 'vencidas', 'todas'])
  bandeja?: string;
  @IsOptional() @IsIn(['NORMAL', 'URGENTE', 'MUY_URGENTE']) prioridad?: string;
  @IsOptional() @Type(() => Number) @IsInt() pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() porPagina?: number;
}

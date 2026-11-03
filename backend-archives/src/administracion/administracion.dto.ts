import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Rol } from '../common/enums.js';
import { REGEX_PASSWORD } from '../auth/auth.controller.js';

const TIPOS_UNIDAD = [
  'DESPACHO',
  'SECRETARIA',
  'DIRECCION',
  'UNIDAD',
  'ARCHIVO',
  'VENTANILLA',
];
const DISPOSICIONES = ['CONSERVACION_PERMANENTE', 'ELIMINACION', 'MUESTREO'];

export class UnidadDto {
  @IsString() @MaxLength(20) codigo!: string;
  @IsString() @MaxLength(200) nombre!: string;
  @IsString() @MaxLength(20) sigla!: string;
  @IsIn(TIPOS_UNIDAD) tipo!: string;
  @IsOptional() @Type(() => Number) @IsInt() padreId?: number | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CrearUsuarioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;
  @IsString()
  @Matches(REGEX_PASSWORD, {
    message: 'La contraseña debe tener al menos 8 caracteres, letras y números',
  })
  password!: string;
  @IsString() @MaxLength(100) nombres!: string;
  @IsString() @MaxLength(100) apellidos!: string;
  @IsOptional() @IsString() @MaxLength(20) ci?: string;
  @IsOptional() @IsString() @MaxLength(120) cargo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsIn(Object.values(Rol)) rol!: Rol;
  @Type(() => Number) @IsInt() unidadId!: number;
}

export class ActualizarUsuarioDto {
  @IsOptional() @IsString() @MaxLength(100) nombres?: string;
  @IsOptional() @IsString() @MaxLength(100) apellidos?: string;
  @IsOptional() @IsString() @MaxLength(20) ci?: string;
  @IsOptional() @IsString() @MaxLength(120) cargo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(Object.values(Rol)) rol?: Rol;
  @IsOptional() @Type(() => Number) @IsInt() unidadId?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class SerieDto {
  @IsString() @MaxLength(30) codigo!: string;
  @IsString() @MaxLength(200) nombre!: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @Type(() => Number) @IsInt() unidadId?: number | null;
  @Type(() => Number) @IsInt() @Min(0) retencionGestionAnios!: number;
  @Type(() => Number) @IsInt() @Min(0) retencionCentralAnios!: number;
  @IsIn(DISPOSICIONES) disposicionFinal!: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

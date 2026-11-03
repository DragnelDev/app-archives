import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SolicitarTransferenciaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  expedienteIds!: number[];
  @IsOptional() @IsString() @MaxLength(500) observaciones?: string;
}

export class AsignacionDto {
  @Type(() => Number) @IsInt() expedienteId!: number;
  @Type(() => Number) @IsInt() cajaId!: number;
}

export class AprobarTransferenciaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsignacionDto)
  asignaciones!: AsignacionDto[];
}

export class RechazarTransferenciaDto {
  @IsString() @MinLength(5) @MaxLength(500) motivo!: string;
}

export class CajaDto {
  @IsString() @MaxLength(30) codigo!: string;
  @IsString() @MaxLength(10) estante!: string;
  @IsString() @MaxLength(10) cuerpo!: string;
  @Type(() => Number) @IsInt() @Min(1) balda!: number;
  @Type(() => Number) @IsInt() @Min(1) capacidad!: number;
}

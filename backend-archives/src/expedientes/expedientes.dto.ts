import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TipoDocumento } from '../common/enums.js';

export class AbrirExpedienteDto {
  @Type(() => Number) @IsInt() hojaRutaId!: number;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(300) titulo?: string;
  @IsOptional() @Type(() => Number) @IsInt() serieId?: number;
}

export class AgregarDocumentoDto {
  @IsIn(Object.values(TipoDocumento).filter((t) => t !== TipoDocumento.ORIGEN))
  tipo!: TipoDocumento;
  @IsOptional() @IsString() @MaxLength(100) cite?: string;
  @IsString() @MinLength(3) @MaxLength(300) titulo!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fechaDocumento?: string;
  /** Rango de fojas exacto. La BD exige que inicie en la siguiente foja libre (sin baches ni solapes). */
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) fojaInicio!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) fojaFin!: number;
  @IsOptional() @Type(() => Number) @IsInt() archivoId?: number;
}

export class CerrarExpedienteDto {
  @IsOptional() @Type(() => Number) @IsInt() serieId?: number;
}

import {
  Column,
  DefaultNamingStrategy,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** camelCase -> snake_case para columnas (el esquema SQL usa snake_case). */
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  override columnName(
    propertyName: string,
    customName: string | undefined,
    prefixes: string[],
  ): string {
    return (
      customName ??
      [...prefixes, propertyName]
        .join('_')
        .replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
    );
  }
}

/** Columnas de auditoría obligatorias en todas las tablas principales. */
export abstract class Auditable {
  @Column({ type: 'int', nullable: true }) creadoPor?: number | null;
  @Column({ type: 'timestamptz', default: () => 'now()', update: false })
  fechaCreacion!: Date;
  @Column({ type: 'int', nullable: true }) actualizadoPor?: number | null;
  @Column({ type: 'timestamptz', nullable: true, insert: false })
  fechaActualizacion?: Date | null;
  @Column({ type: 'boolean', default: true }) activo!: boolean;
}

@Entity('unidades_organizacionales')
export class Unidad extends Auditable {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 20 }) codigo!: string;
  @Column({ type: 'varchar', length: 200 }) nombre!: string;
  @Column({ type: 'varchar', length: 20 }) sigla!: string;
  @Column({ type: 'varchar', length: 20, default: 'UNIDAD' }) tipo!: string;
  @Column({ type: 'int', nullable: true }) padreId?: number | null;
}

@Entity('usuarios')
export class Usuario extends Auditable {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 50 }) username!: string;
  @Column({ type: 'varchar', length: 100, select: false })
  passwordHash!: string;
  @Column({ type: 'varchar', length: 100 }) nombres!: string;
  @Column({ type: 'varchar', length: 100 }) apellidos!: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) ci?: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) cargo?:
    string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) email?:
    string | null;
  @Column({ type: 'varchar', length: 20 }) rol!: string;
  @Column({ type: 'int' }) unidadId!: number;
  @Column({ type: 'boolean', default: false }) debeCambiarPassword!: boolean;
  @Column({ type: 'int', default: 0 }) intentosFallidos!: number;
  @Column({ type: 'timestamptz', nullable: true }) bloqueadoHasta?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) ultimoAcceso?: Date | null;
}

@Entity('cuadro_clasificacion')
export class Serie extends Auditable {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 30 }) codigo!: string;
  @Column({ type: 'varchar', length: 200 }) nombre!: string;
  @Column({ type: 'text', nullable: true }) descripcion?: string | null;
  @Column({ type: 'int', nullable: true }) unidadId?: number | null;
  @Column({ type: 'int' }) retencionGestionAnios!: number;
  @Column({ type: 'int' }) retencionCentralAnios!: number;
  @Column({ type: 'varchar', length: 30, default: 'CONSERVACION_PERMANENTE' })
  disposicionFinal!: string;
}

@Entity('cajas_archivo')
export class Caja extends Auditable {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 30 }) codigo!: string;
  @Column({ type: 'varchar', length: 10 }) estante!: string;
  @Column({ type: 'varchar', length: 10 }) cuerpo!: string;
  @Column({ type: 'int' }) balda!: number;
  @Column({ type: 'int', default: 10 }) capacidad!: number;
}

export const ENTITIES = [Unidad, Usuario, Serie, Caja];

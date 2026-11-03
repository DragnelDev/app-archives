import {
  Global,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { ENTITIES, SnakeNamingStrategy } from './entities.js';
import { DemoSeed } from './demo-seed.js';

// DATE -> 'YYYY-MM-DD' (evita desfases de zona horaria); INT8 -> number (conteos)
pg.types.setTypeParser(1082, (v: string) => v);
pg.types.setTypeParser(20, (v: string) => Number(v));

@Injectable()
export class MigracionesService implements OnApplicationBootstrap {
  private readonly log = new Logger('Migraciones');
  constructor(
    private readonly ds: DataSource,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.migrar();
    await this.crearAdminInicial();
    if (this.cfg.get('SEED_DEMO') === 'true')
      await new DemoSeed(this.ds, this.log).ejecutar();
  }

  /** Aplica en orden los .sql de database/migrations no ejecutados (cada uno en una transacción). */
  private async migrar() {
    const dir =
      this.cfg.get<string>('MIGRATIONS_DIR') ??
      join(process.cwd(), 'database', 'migrations');
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.query('SELECT pg_advisory_lock(727274)');
      await qr.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre varchar(120) PRIMARY KEY, checksum char(64) NOT NULL, aplicada timestamptz NOT NULL DEFAULT now())`);
      const hechas = new Map<string, string>(
        (await qr.query('SELECT nombre, checksum FROM schema_migrations')).map(
          (r: any) => [r.nombre, r.checksum],
        ),
      );
      const archivos = (await readdir(dir))
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const f of archivos) {
        const sql = await readFile(join(dir, f), 'utf8');
        const sum = createHash('sha256').update(sql).digest('hex');
        if (hechas.has(f)) {
          if (hechas.get(f) !== sum)
            this.log.warn(
              `La migración ${f} fue modificada después de aplicarse`,
            );
          continue;
        }
        await qr.startTransaction();
        try {
          await qr.query(sql);
          await qr.query(
            'INSERT INTO schema_migrations (nombre, checksum) VALUES ($1,$2)',
            [f, sum],
          );
          await qr.commitTransaction();
          this.log.log(`Migración aplicada: ${f}`);
        } catch (e) {
          await qr.rollbackTransaction();
          throw e;
        }
      }
    } finally {
      await qr
        .query('SELECT pg_advisory_unlock(727274)')
        .catch(() => undefined);
      await qr.release();
    }
  }

  /** Si no hay usuarios, crea la unidad de sistemas y el administrador inicial. */
  private async crearAdminInicial() {
    const [{ n }] = await this.ds.query(
      'SELECT count(*)::int AS n FROM usuarios',
    );
    if (n > 0) return;
    const username = this.cfg.get('ADMIN_USERNAME') ?? 'admin';
    let password = this.cfg.get<string>('ADMIN_PASSWORD');
    const generada = !password;
    if (!password)
      password =
        'Adm' +
        createHash('sha256')
          .update(String(Math.random()))
          .digest('hex')
          .slice(0, 9) +
        '9';
    const hash = await bcrypt.hash(password, 12);
    await this.ds.transaction(async (m) => {
      const [u] = await m.query(
        `INSERT INTO unidades_organizacionales (codigo, nombre, sigla, tipo)
         VALUES ('SIS','Unidad de Sistemas','SIS','UNIDAD') RETURNING id`,
      );
      await m.query(
        `INSERT INTO usuarios (username, password_hash, nombres, apellidos, rol, unidad_id, debe_cambiar_password)
         VALUES ($1,$2,'Administrador','del Sistema','ROLE_ADMIN',$3,true)`,
        [username, hash, u.id],
      );
    });
    this.log.warn(
      `Administrador inicial creado: usuario="${username}"${generada ? ` contraseña="${password}"` : ''} (deberá cambiarla al ingresar)`,
    );
  }
}

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        url: cfg.get<string>('DATABASE_URL') || undefined,
        host: String(cfg.get('DB_HOST', 'localhost')),
        port: Number(cfg.get('DB_PORT', 5432)),
        username: String(cfg.get('DB_USER', 'archivo')),
        password: String(cfg.get('DB_PASSWORD', 'archivo')),
        database: String(cfg.get('DB_NAME', 'archivo_gam')),
        entities: ENTITIES,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false, // el esquema se gestiona con database/migrations/*.sql
        extra: {
          max: Number(cfg.get('DB_POOL', 10)),
          options: '-c timezone=America/La_Paz',
        },
      }),
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  providers: [MigracionesService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

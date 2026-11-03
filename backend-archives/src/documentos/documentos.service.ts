import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PDFDocument } from 'pdf-lib';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { CorrespondenciaService } from '../correspondencia/correspondencia.service.js';
import type { UsuarioSesion } from '../common/enums.js';
import { toCamel } from '../common/util.js';

export interface ArchivoSubido {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
}
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

@Injectable()
export class DocumentosService {
  private readonly raiz: string;
  constructor(
    private readonly ds: DataSource,
    cfg: ConfigService,
    private readonly corr: CorrespondenciaService,
  ) {
    this.raiz = resolve(cfg.get<string>('STORAGE_DIR') ?? './storage');
  }

  /** Verifica la firma %PDF del contenido (no se confía en el mime/extension del cliente). */
  static esPdf(buf: Buffer): boolean {
    return (
      buf.length > 8 &&
      buf.subarray(0, 1024).toString('latin1').includes('%PDF-')
    );
  }

  async subir(
    hrId: number,
    file: ArchivoSubido | undefined,
    descripcion: string | undefined,
    u: UsuarioSesion,
  ) {
    if (!file)
      throw new BadRequestException(
        'Debe adjuntar un archivo PDF (campo "archivo")',
      );
    if (file.size > MAX_PDF_BYTES)
      throw new PayloadTooLargeException('El PDF supera los 25 MB');
    if (!DocumentosService.esPdf(file.buffer))
      throw new UnprocessableEntityException('El archivo no es un PDF válido');
    const det = await this.corr.detalle(hrId, u);
    if (!det.permisos.puedeAdjuntar)
      throw new ForbiddenException(
        'No puede adjuntar documentos a esta Hoja de Ruta en su estado actual',
      );

    let paginas: number | null = null;
    try {
      paginas = (
        await PDFDocument.load(file.buffer, {
          ignoreEncryption: true,
          updateMetadata: false,
        })
      ).getPageCount();
    } catch {
      /* PDF no analizable: se guarda igualmente sin conteo de páginas */
    }

    const ahora = new Date();
    const rel = join(
      String(ahora.getFullYear()),
      String(ahora.getMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.pdf`,
    );
    const abs = join(this.raiz, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, file.buffer, { flag: 'wx' });
    try {
      const [d] = await this.ds.query(
        `INSERT INTO documentos_digitales (hoja_ruta_id, nombre_original, nombre_almacenado, tamano_bytes, sha256, paginas, descripcion, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, paginas`,
        [
          hrId,
          Buffer.from(file.originalname, 'latin1')
            .toString('utf8')
            .slice(0, 255),
          rel.split(sep).join('/'),
          file.size,
          createHash('sha256').update(file.buffer).digest('hex'),
          paginas,
          descripcion?.slice(0, 300) ?? null,
          u.id,
        ],
      );
      return toCamel(d);
    } catch (e) {
      await unlink(abs).catch(() => undefined);
      throw e;
    }
  }

  /** Devuelve ruta absoluta + metadatos tras validar visibilidad; registra la consulta en la auditoría. */
  async abrir(id: number, u: UsuarioSesion) {
    const [d] = await this.ds.query(
      `SELECT * FROM documentos_digitales WHERE id = $1 AND activo`,
      [id],
    );
    if (!d || !(await this.corr.puedeVer(d.hoja_ruta_id, u)))
      throw new NotFoundException('Documento no encontrado');
    const abs = resolve(this.raiz, d.nombre_almacenado);
    if (!abs.startsWith(this.raiz + sep) || !existsSync(abs))
      throw new NotFoundException('Archivo no disponible en el almacenamiento');
    await this.ds.query(
      `INSERT INTO audit_log (tabla, registro_id, accion, usuario_id, datos_despues)
       VALUES ('documentos_digitales', $1, 'VIEW', $2, jsonb_build_object('hoja_ruta_id', $3::int))`,
      [String(id), u.id, d.hoja_ruta_id],
    );
    return {
      stream: createReadStream(abs),
      nombre: d.nombre_original as string,
      bytes: Number(d.tamano_bytes),
    };
  }

  async eliminar(id: number, u: UsuarioSesion) {
    const [d] = await this.ds.query(
      `SELECT hoja_ruta_id FROM documentos_digitales WHERE id = $1 AND activo`,
      [id],
    );
    if (!d) throw new NotFoundException('Documento no encontrado');
    const det = await this.corr.detalle(d.hoja_ruta_id, u);
    if (!det.permisos.puedeAdjuntar)
      throw new ForbiddenException(
        'No puede modificar los documentos de esta Hoja de Ruta',
      );
    const [uso] = await this.ds.query(
      `SELECT 1 FROM documentos_internos WHERE archivo_id = $1 AND activo`,
      [id],
    );
    if (uso)
      throw new UnprocessableEntityException(
        'El PDF está vinculado a un documento foliado y no puede darse de baja',
      );
    await this.ds.query(
      `UPDATE documentos_digitales SET activo = false, actualizado_por = $2 WHERE id = $1`,
      [id, u.id],
    );
  }
}

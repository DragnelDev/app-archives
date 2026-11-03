import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/**
 * Traduce los errores de PostgreSQL (CHECK, EXCLUDE, triggers de negocio, UNIQUE, FK)
 * a respuestas HTTP comprensibles. Las reglas viven en la BD; aquí solo se comunican.
 */
@Catch(QueryFailedError)
export class PgExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('PostgreSQL');

  catch(exc: QueryFailedError & { driverError?: any }, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const d = exc.driverError ?? (exc as any);
    const code: string | undefined = d?.code;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno de base de datos';

    switch (code) {
      case 'P0001': // RAISE EXCEPTION de nuestras reglas de negocio
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        message = d.message;
        break;
      case '23514':
        status = HttpStatus.BAD_REQUEST;
        message = `Dato inválido (restricción ${d.constraint ?? 'CHECK'})`;
        if (
          d.constraint === 'ck_doc_fojas' ||
          d.constraint === 'ck_cuerpo_fojas'
        )
          message = 'La foja final debe ser mayor o igual a la foja inicial';
        break;
      case '23P01':
        status = HttpStatus.CONFLICT;
        message = 'Las fojas indicadas se solapan con fojas ya registradas';
        break;
      case '23505':
        status = HttpStatus.CONFLICT;
        message = `Registro duplicado (${d.constraint ?? 'único'})`;
        break;
      case '23503':
        status = HttpStatus.CONFLICT;
        message = 'Referencia inválida o registro en uso';
        break;
      case '23502':
        status = HttpStatus.BAD_REQUEST;
        message = `Falta un dato obligatorio (${d.column ?? ''})`;
        break;
      case '22P02':
      case '22003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Valor con formato inválido';
        break;
      default:
        this.log.error(`${code ?? ''} ${d?.message ?? exc.message}`);
    }
    res
      .status(status)
      .json({ statusCode: status, message, error: code ?? 'DB_ERROR' });
  }
}

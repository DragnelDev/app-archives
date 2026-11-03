import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { visibilidadHR } from '../common/acceso.js';
import { Rol, UsuarioSesion } from '../common/enums.js';
import { gestionActual, toCamel } from '../common/util.js';

export type Tono = 'neutral' | 'ok' | 'aviso' | 'peligro';
export interface Tarjeta {
  clave: string;
  etiqueta: string;
  valor: number;
  tono: Tono;
  enlace?: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly ds: DataSource) {}

  private async n(sql: string, params: any[] = []): Promise<number> {
    const [r] = await this.ds.query(sql, params);
    return Number(r?.n ?? 0);
  }

  async obtener(u: UsuarioSesion) {
    const [{ valor: alertaDias }] = await this.ds.query(
      `SELECT valor FROM parametros_sistema WHERE clave = 'alerta_dias_vencimiento'`,
    );
    const dias = Number(alertaDias);
    const tarjetas: Tarjeta[] = [];
    const alertas: any[] = [];
    const mias = `h.activo AND h.usuario_actual_id = $1`;

    if ([Rol.VENTANILLA, Rol.JEFE, Rol.TECNICO].includes(u.rol)) {
      const porRecibir = await this.n(
        `SELECT count(*) AS n FROM hojas_ruta h WHERE ${mias} AND h.estado = 'DERIVADO' AND EXISTS (
           SELECT 1 FROM hoja_ruta_movimientos m WHERE m.hoja_ruta_id = h.id AND m.orden = (SELECT max(orden) FROM hoja_ruta_movimientos WHERE hoja_ruta_id = h.id)
             AND m.fecha_recepcion IS NULL)`,
        [u.id],
      );
      const enTramite = await this.n(
        `SELECT count(*) AS n FROM hojas_ruta h WHERE ${mias} AND h.estado IN ('REGISTRADO','DERIVADO')`,
        [u.id],
      );
      const porVencer = await this.n(
        `SELECT count(*) AS n FROM hojas_ruta h WHERE ${mias} AND h.estado = 'DERIVADO' AND h.fecha_limite BETWEEN current_date AND current_date + $2::int`,
        [u.id, dias],
      );
      const vencidas = await this.n(
        `SELECT count(*) AS n FROM hojas_ruta h WHERE ${mias} AND h.estado = 'DERIVADO' AND h.fecha_limite < current_date`,
        [u.id],
      );
      tarjetas.push(
        {
          clave: 'porRecibir',
          etiqueta: 'Por recepcionar',
          valor: porRecibir,
          tono: porRecibir ? 'aviso' : 'neutral',
          enlace: '/bandeja?bandeja=mia',
        },
        {
          clave: 'enTramite',
          etiqueta: 'En mi bandeja',
          valor: enTramite,
          tono: 'neutral',
          enlace: '/bandeja?bandeja=mia',
        },
        {
          clave: 'porVencer',
          etiqueta: `Vencen en ${dias} días`,
          valor: porVencer,
          tono: porVencer ? 'aviso' : 'ok',
          enlace: '/bandeja?bandeja=mia',
        },
        {
          clave: 'vencidas',
          etiqueta: 'Vencidas',
          valor: vencidas,
          tono: vencidas ? 'peligro' : 'ok',
          enlace: '/bandeja?bandeja=vencidas',
        },
      );
      if (u.rol === Rol.VENTANILLA) {
        tarjetas.push(
          {
            clave: 'hoy',
            etiqueta: 'Registradas hoy',
            valor: await this.n(
              `SELECT count(*) AS n FROM hojas_ruta WHERE creado_por = $1 AND fecha_recepcion::date = current_date`,
              [u.id],
            ),
            tono: 'ok',
          },
          {
            clave: 'mes',
            etiqueta: 'Registradas en el mes',
            valor: await this.n(
              `SELECT count(*) AS n FROM hojas_ruta WHERE creado_por = $1 AND date_trunc('month', fecha_recepcion) = date_trunc('month', now())`,
              [u.id],
            ),
            tono: 'neutral',
          },
        );
      } else {
        tarjetas.push({
          clave: 'concluidasMes',
          etiqueta: 'Concluidas en el mes',
          tono: 'ok',
          valor: await this.n(
            `SELECT count(*) AS n FROM hoja_ruta_movimientos WHERE accion = 'CONCLUSION' AND remitente_usuario_id = $1 AND date_trunc('month', fecha_envio) = date_trunc('month', now())`,
            [u.id],
          ),
        });
      }
      if (u.rol === Rol.JEFE) {
        tarjetas.push({
          clave: 'unidad',
          etiqueta: 'En trámite en mi unidad',
          tono: 'neutral',
          valor: await this.n(
            `SELECT count(*) AS n FROM hojas_ruta WHERE activo AND estado = 'DERIVADO' AND unidad_actual_id = $1`,
            [u.unidadId],
          ),
        });
        tarjetas.push({
          clave: 'expCerrados',
          etiqueta: 'Expedientes por transferir',
          tono: 'neutral',
          enlace: '/archivo/transferencias',
          valor: await this.n(
            `SELECT count(*) AS n FROM expedientes e WHERE e.activo AND e.estado = 'CERRADO' AND e.unidad_productora_id = $1`,
            [u.unidadId],
          ),
        });
      }
      alertas.push(
        ...toCamel(
          await this.ds.query(
            `SELECT 'PLAZO' AS tipo, h.id, h.codigo, h.asunto, h.fecha_limite, (h.fecha_limite - current_date) AS dias_restantes
           FROM hojas_ruta h WHERE ${mias} AND h.estado = 'DERIVADO' AND h.fecha_limite <= current_date + $2::int
          ORDER BY h.fecha_limite LIMIT 8`,
            [u.id, dias],
          ),
        ),
      );
    }

    if (u.rol === Rol.ARCHIVISTA) {
      tarjetas.push(
        {
          clave: 'transfPend',
          etiqueta: 'Transferencias por aprobar',
          tono: 'aviso',
          enlace: '/archivo/transferencias',
          valor: await this.n(
            `SELECT count(*) AS n FROM transferencias WHERE activo AND estado = 'SOLICITADA'`,
          ),
        },
        {
          clave: 'archivados',
          etiqueta: 'Expedientes en archivo',
          tono: 'neutral',
          enlace: '/archivo/topografia',
          valor: await this.n(
            `SELECT count(*) AS n FROM detalle_transferencia_cajas d JOIN transferencias t ON t.id = d.transferencia_id AND t.estado = 'APROBADA' WHERE d.activo`,
          ),
        },
        {
          clave: 'cajas',
          etiqueta: 'Cajas registradas',
          tono: 'neutral',
          valor: await this.n(
            `SELECT count(*) AS n FROM cajas_archivo WHERE activo`,
          ),
        },
        {
          clave: 'retencion',
          etiqueta: 'Retención cumplida',
          tono: 'peligro',
          enlace: '/archivo/topografia',
          valor: await this
            .n(`SELECT count(*) AS n FROM detalle_transferencia_cajas d JOIN transferencias t ON t.id = d.transferencia_id AND t.estado = 'APROBADA'
                                 JOIN expedientes e ON e.id = d.expediente_id JOIN cuadro_clasificacion s ON s.id = e.serie_id
                                WHERE d.activo AND e.fecha_cierre + make_interval(years => s.retencion_gestion_anios + s.retencion_central_anios) < current_date`),
        },
      );
      alertas.push(
        ...toCamel(
          await this.ds.query(
            `SELECT 'TRANSFERENCIA' AS tipo, t.id, t.codigo, ('Solicitud de ' || un.sigla) AS asunto, NULL::date AS fecha_limite, NULL::int AS dias_restantes
           FROM transferencias t JOIN unidades_organizacionales un ON un.id = t.unidad_origen_id
          WHERE t.activo AND t.estado = 'SOLICITADA' ORDER BY t.id LIMIT 8`,
          ),
        ),
      );
    }

    if (u.rol === Rol.ADMIN) {
      tarjetas.push(
        {
          clave: 'usuarios',
          etiqueta: 'Usuarios activos',
          tono: 'neutral',
          enlace: '/admin/usuarios',
          valor: await this.n(
            `SELECT count(*) AS n FROM usuarios WHERE activo`,
          ),
        },
        {
          clave: 'bloqueados',
          etiqueta: 'Cuentas bloqueadas',
          tono: 'aviso',
          enlace: '/admin/usuarios',
          valor: await this.n(
            `SELECT count(*) AS n FROM usuarios WHERE bloqueado_hasta > now()`,
          ),
        },
        {
          clave: 'unidades',
          etiqueta: 'Unidades',
          tono: 'neutral',
          enlace: '/admin/unidades',
          valor: await this.n(
            `SELECT count(*) AS n FROM unidades_organizacionales WHERE activo`,
          ),
        },
        {
          clave: 'series',
          etiqueta: 'Series del ICA',
          tono: 'neutral',
          enlace: '/admin/series',
          valor: await this.n(
            `SELECT count(*) AS n FROM cuadro_clasificacion WHERE activo`,
          ),
        },
        {
          clave: 'hrGestion',
          etiqueta: 'HR de la gestión',
          tono: 'ok',
          valor: await this.n(
            `SELECT count(*) AS n FROM hojas_ruta WHERE gestion = $1`,
            [gestionActual()],
          ),
        },
        {
          clave: 'vencidasGlobal',
          etiqueta: 'Trámites vencidos',
          tono: 'peligro',
          enlace: '/bandeja?bandeja=vencidas',
          valor: await this.n(
            `SELECT count(*) AS n FROM hojas_ruta WHERE activo AND estado = 'DERIVADO' AND fecha_limite < current_date`,
          ),
        },
      );
    }

    const vis = visibilidadHR(u, 2);
    const porEstado: Record<string, number> = {
      REGISTRADO: 0,
      DERIVADO: 0,
      CONCLUIDO: 0,
      ARCHIVADO: 0,
    };
    for (const r of await this.ds.query(
      `SELECT h.estado, count(*)::int AS n FROM hojas_ruta h WHERE h.activo AND h.gestion = $1 AND (${vis.sql}) GROUP BY h.estado`,
      [gestionActual(), ...vis.params],
    ))
      porEstado[r.estado] = r.n;

    const vis1 = visibilidadHR(u, 1);
    const actividad = toCamel(
      await this.ds.query(
        `SELECT m.id, m.accion, m.fecha_envio, m.proveido, h.id AS hoja_ruta_id, h.codigo,
              (r.nombres || ' ' || r.apellidos) AS remitente_nombre, (d.nombres || ' ' || d.apellidos) AS destinatario_nombre
         FROM hoja_ruta_movimientos m JOIN hojas_ruta h ON h.id = m.hoja_ruta_id
         JOIN usuarios r ON r.id = m.remitente_usuario_id LEFT JOIN usuarios d ON d.id = m.destinatario_usuario_id
        WHERE h.activo AND (${vis1.sql}) ORDER BY m.fecha_envio DESC, m.id DESC LIMIT 8`,
        vis1.params,
      ),
    );
    return {
      rol: u.rol,
      gestion: gestionActual(),
      tarjetas,
      alertas,
      porEstado,
      actividad,
    };
  }
}

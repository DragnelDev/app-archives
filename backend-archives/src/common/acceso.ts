import { Rol, UsuarioSesion } from './enums.js';

/**
 * Fragmento SQL de visibilidad de una Hoja de Ruta (alias `h`) según el rol.
 *  - ADMIN / VENTANILLA: todas (ADMIN solo lectura).
 *  - ARCHIVISTA: solo concluidas/archivadas.
 *  - JEFE: las que pasaron por su unidad.
 *  - TECNICO: las que pasaron por sus manos.
 * Devuelve el SQL y el parámetro (si requiere) en la posición `p`.
 */
export function visibilidadHR(
  u: UsuarioSesion,
  p: number,
): { sql: string; params: any[] } {
  switch (u.rol) {
    case Rol.ADMIN:
    case Rol.VENTANILLA:
      return { sql: 'TRUE', params: [] };
    case Rol.ARCHIVISTA:
      return { sql: `h.estado IN ('CONCLUIDO','ARCHIVADO')`, params: [] };
    case Rol.JEFE:
      return {
        sql: `EXISTS (SELECT 1 FROM hoja_ruta_movimientos vm WHERE vm.hoja_ruta_id = h.id
                AND (vm.destinatario_unidad_id = $${p} OR vm.remitente_unidad_id = $${p}))`,
        params: [u.unidadId],
      };
    default:
      return {
        sql: `EXISTS (SELECT 1 FROM hoja_ruta_movimientos vm WHERE vm.hoja_ruta_id = h.id
                AND (vm.destinatario_usuario_id = $${p} OR vm.remitente_usuario_id = $${p}))`,
        params: [u.id],
      };
  }
}

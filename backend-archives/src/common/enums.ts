export enum Rol {
  ADMIN = 'ROLE_ADMIN',
  VENTANILLA = 'ROLE_VENTANILLA',
  JEFE = 'ROLE_JEFE',
  TECNICO = 'ROLE_TECNICO',
  ARCHIVISTA = 'ROLE_ARCHIVISTA',
}

export enum EstadoHR {
  REGISTRADO = 'REGISTRADO',
  DERIVADO = 'DERIVADO',
  CONCLUIDO = 'CONCLUIDO',
  ARCHIVADO = 'ARCHIVADO',
}

export enum TipoDocumento {
  ORIGEN = 'ORIGEN',
  INFORME_TECNICO = 'INFORME_TECNICO',
  INFORME_LEGAL = 'INFORME_LEGAL',
  NOTA = 'NOTA',
  CARTA = 'CARTA',
  RESOLUCION = 'RESOLUCION',
  PROVEIDO = 'PROVEIDO',
  OTRO = 'OTRO',
}

/** Datos mínimos de la sesión, adjuntos a `request.user` por JwtAuthGuard. (Clase: se usa en firmas decoradas.) */
export class UsuarioSesion {
  id!: number;
  username!: string;
  nombre!: string;
  rol!: Rol;
  unidadId!: number;
  debeCambiarPassword!: boolean;
}

-- =====================================================================
-- Sistema de Gestión Documental, Correspondencia y Archivo Municipal
-- Esquema base (PostgreSQL 14+). Ley 2341, Ley 1178 (SAFCO), ABNB.
-- Las reglas críticas (foliado, trazabilidad, auditoría) viven en la BD
-- para que NINGÚN cliente pueda saltárselas.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- Parámetros del sistema ----------
CREATE TABLE parametros_sistema (
  clave       varchar(60) PRIMARY KEY,
  valor       varchar(200) NOT NULL,
  descripcion varchar(300)
);
INSERT INTO parametros_sistema VALUES
 ('fojas_por_cuerpo', '200', 'Máximo de fojas por cuerpo de expediente'),
 ('plazo_dias_defecto', '5', 'Plazo por defecto (días hábiles) de un proveído'),
 ('alerta_dias_vencimiento', '2', 'Días de anticipación para alertar vencimientos');

-- ---------- Unidades organizacionales ----------
CREATE TABLE unidades_organizacionales (
  id                   serial PRIMARY KEY,
  codigo               varchar(20)  NOT NULL,
  nombre               varchar(200) NOT NULL,
  sigla                varchar(20)  NOT NULL,
  tipo                 varchar(20)  NOT NULL DEFAULT 'UNIDAD'
                         CHECK (tipo IN ('DESPACHO','SECRETARIA','DIRECCION','UNIDAD','ARCHIVO','VENTANILLA')),
  padre_id             int REFERENCES unidades_organizacionales(id),
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true,
  CONSTRAINT ck_unidad_padre CHECK (padre_id IS NULL OR padre_id <> id)
);
CREATE UNIQUE INDEX uq_unidades_codigo ON unidades_organizacionales (upper(codigo));

-- ---------- Usuarios ----------
CREATE TABLE usuarios (
  id                   serial PRIMARY KEY,
  username             varchar(50)  NOT NULL UNIQUE,
  password_hash        varchar(100) NOT NULL,
  nombres              varchar(100) NOT NULL,
  apellidos            varchar(100) NOT NULL,
  ci                   varchar(20),
  cargo                varchar(120),
  email                varchar(150),
  rol                  varchar(20)  NOT NULL
                         CHECK (rol IN ('ROLE_ADMIN','ROLE_VENTANILLA','ROLE_JEFE','ROLE_TECNICO','ROLE_ARCHIVISTA')),
  unidad_id            int NOT NULL REFERENCES unidades_organizacionales(id),
  debe_cambiar_password boolean NOT NULL DEFAULT false,
  intentos_fallidos    int NOT NULL DEFAULT 0,
  bloqueado_hasta      timestamptz,
  ultimo_acceso        timestamptz,
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true
);
CREATE INDEX ix_usuarios_unidad_rol ON usuarios (unidad_id, rol) WHERE activo;

-- ---------- Cuadro de Clasificación (ICA) ----------
CREATE TABLE cuadro_clasificacion (
  id                       serial PRIMARY KEY,
  codigo                   varchar(30)  NOT NULL,
  nombre                   varchar(200) NOT NULL,
  descripcion              text,
  unidad_id                int REFERENCES unidades_organizacionales(id),
  retencion_gestion_anios  int NOT NULL CHECK (retencion_gestion_anios >= 0),
  retencion_central_anios  int NOT NULL CHECK (retencion_central_anios >= 0),
  disposicion_final        varchar(30) NOT NULL DEFAULT 'CONSERVACION_PERMANENTE'
                             CHECK (disposicion_final IN ('CONSERVACION_PERMANENTE','ELIMINACION','MUESTREO')),
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX uq_cuadro_codigo ON cuadro_clasificacion (upper(codigo));

-- ---------- Correlativos por gestión (sin saltos: se revierten con el rollback) ----------
CREATE TABLE correlativos (
  gestion int NOT NULL,
  tipo    varchar(20) NOT NULL,
  ultimo  int NOT NULL DEFAULT 0,
  PRIMARY KEY (gestion, tipo)
);
CREATE FUNCTION fn_siguiente_correlativo(p_gestion int, p_tipo varchar) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE v_n int;
BEGIN
  INSERT INTO correlativos AS c (gestion, tipo, ultimo) VALUES (p_gestion, p_tipo, 1)
  ON CONFLICT (gestion, tipo) DO UPDATE SET ultimo = c.ultimo + 1
  RETURNING c.ultimo INTO v_n;
  RETURN v_n;
END $$;

-- ---------- Hojas de Ruta ----------
CREATE TABLE hojas_ruta (
  id                   serial PRIMARY KEY,
  gestion              int  NOT NULL CHECK (gestion BETWEEN 2000 AND 2100),
  numero               int  NOT NULL CHECK (numero > 0),
  codigo               varchar(30) NOT NULL UNIQUE,
  cite_origen          varchar(100),
  remitente            varchar(200) NOT NULL,
  remitente_cargo      varchar(150),
  institucion_origen   varchar(200),
  asunto               text NOT NULL,
  tipo_documento       varchar(10) NOT NULL DEFAULT 'EXTERNO' CHECK (tipo_documento IN ('EXTERNO','INTERNO')),
  prioridad            varchar(12) NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('NORMAL','URGENTE','MUY_URGENTE')),
  fecha_recepcion      timestamptz NOT NULL DEFAULT now(),
  fojas_iniciales      int NOT NULL CHECK (fojas_iniciales >= 1),
  anexos               varchar(200),
  serie_id             int REFERENCES cuadro_clasificacion(id),
  estado               varchar(12) NOT NULL DEFAULT 'REGISTRADO'
                         CHECK (estado IN ('REGISTRADO','DERIVADO','CONCLUIDO','ARCHIVADO')),
  unidad_actual_id     int REFERENCES unidades_organizacionales(id),
  usuario_actual_id    int REFERENCES usuarios(id),
  fecha_limite         date,
  fecha_conclusion     timestamptz,
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true,
  UNIQUE (gestion, numero)
);
CREATE INDEX ix_hr_estado        ON hojas_ruta (gestion, estado) WHERE activo;
CREATE INDEX ix_hr_usuario       ON hojas_ruta (usuario_actual_id, estado) WHERE activo;
CREATE INDEX ix_hr_limite        ON hojas_ruta (fecha_limite) WHERE activo AND estado = 'DERIVADO';
CREATE INDEX ix_hr_busqueda_trgm ON hojas_ruta USING gin
  ((coalesce(codigo,'') || ' ' || coalesce(cite_origen,'') || ' ' || remitente || ' ' || asunto) gin_trgm_ops);

-- Máquina de estados + campos de identidad inmutables
CREATE FUNCTION fn_hr_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'ARCHIVADO' THEN
    RAISE EXCEPTION 'La Hoja de Ruta % está ARCHIVADA y no admite modificaciones', OLD.codigo;
  END IF;
  IF NEW.gestion <> OLD.gestion OR NEW.numero <> OLD.numero OR NEW.codigo <> OLD.codigo THEN
    RAISE EXCEPTION 'El correlativo de la Hoja de Ruta es inmutable';
  END IF;
  IF NEW.estado <> OLD.estado AND NOT (
       (OLD.estado = 'REGISTRADO' AND NEW.estado IN ('DERIVADO','CONCLUIDO')) OR
       (OLD.estado = 'DERIVADO'   AND NEW.estado = 'CONCLUIDO') OR
       (OLD.estado = 'CONCLUIDO'  AND NEW.estado = 'ARCHIVADO')) THEN
    RAISE EXCEPTION 'Transición de estado inválida: % -> %', OLD.estado, NEW.estado;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_hr_guard BEFORE UPDATE ON hojas_ruta FOR EACH ROW EXECUTE FUNCTION fn_hr_guard();

-- ---------- Historial de derivaciones (inmutable, con cadena de hash) ----------
CREATE TABLE hoja_ruta_movimientos (
  id                       bigserial PRIMARY KEY,
  hoja_ruta_id             int NOT NULL REFERENCES hojas_ruta(id),
  orden                    int NOT NULL,
  accion                   varchar(12) NOT NULL
                             CHECK (accion IN ('REGISTRO','DERIVACION','DEVOLUCION','CONCLUSION','ARCHIVO')),
  remitente_usuario_id     int NOT NULL REFERENCES usuarios(id),
  remitente_unidad_id      int NOT NULL REFERENCES unidades_organizacionales(id),
  destinatario_usuario_id  int REFERENCES usuarios(id),
  destinatario_unidad_id   int REFERENCES unidades_organizacionales(id),
  proveido                 text NOT NULL CHECK (length(btrim(proveido)) > 0),
  plazo_dias               int CHECK (plazo_dias IS NULL OR plazo_dias > 0),
  fecha_limite             date,
  fojas                    int CHECK (fojas IS NULL OR fojas >= 1),
  fecha_envio              timestamptz NOT NULL DEFAULT now(),
  fecha_recepcion          timestamptz,
  hash_anterior            char(64),
  hash                     char(64) NOT NULL,
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true,
  UNIQUE (hoja_ruta_id, orden),
  CONSTRAINT ck_mov_recepcion CHECK (fecha_recepcion IS NULL OR fecha_recepcion >= fecha_envio),
  CONSTRAINT ck_mov_destino CHECK (accion IN ('CONCLUSION','ARCHIVO') OR destinatario_usuario_id IS NOT NULL)
);
CREATE INDEX ix_mov_hr ON hoja_ruta_movimientos (hoja_ruta_id, orden);

CREATE FUNCTION fn_mov_hash(p_prev text, m hoja_ruta_movimientos) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(
    coalesce(p_prev,'') || '|' || m.hoja_ruta_id || '|' || m.orden || '|' || m.accion || '|' ||
    m.remitente_usuario_id || '|' || coalesce(m.destinatario_usuario_id::text,'') || '|' ||
    m.proveido || '|' || floor(extract(epoch FROM m.fecha_envio) * 1000000)::text, 'sha256'), 'hex')
$$;

CREATE FUNCTION fn_mov_before_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_prev RECORD;
BEGIN
  PERFORM 1 FROM hojas_ruta WHERE id = NEW.hoja_ruta_id FOR UPDATE;   -- serializa pases concurrentes
  SELECT orden, hash INTO v_prev FROM hoja_ruta_movimientos
   WHERE hoja_ruta_id = NEW.hoja_ruta_id ORDER BY orden DESC LIMIT 1;
  NEW.orden         := coalesce(v_prev.orden, 0) + 1;
  NEW.hash_anterior := v_prev.hash;
  NEW.hash          := fn_mov_hash(v_prev.hash, NEW);
  RETURN NEW;
END $$;
CREATE TRIGGER tr_mov_1_insert BEFORE INSERT ON hoja_ruta_movimientos
  FOR EACH ROW EXECUTE FUNCTION fn_mov_before_insert();

CREATE FUNCTION fn_mov_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los movimientos de la Hoja de Ruta son inmutables: no se pueden eliminar';
  END IF;
  IF OLD.fecha_recepcion IS NOT NULL THEN
    RAISE EXCEPTION 'El movimiento ya fue recepcionado y no admite cambios';
  END IF;
  IF (to_jsonb(NEW) - 'fecha_recepcion' - 'actualizado_por' - 'fecha_actualizacion')
     IS DISTINCT FROM (to_jsonb(OLD) - 'fecha_recepcion' - 'actualizado_por' - 'fecha_actualizacion') THEN
    RAISE EXCEPTION 'Los movimientos de la Hoja de Ruta son inmutables: solo puede registrarse la recepción';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_mov_2_inmutable BEFORE UPDATE OR DELETE ON hoja_ruta_movimientos
  FOR EACH ROW EXECUTE FUNCTION fn_mov_inmutable();

-- Verificación de integridad de la cadena (detecta manipulación directa de datos)
CREATE FUNCTION fn_verificar_cadena(p_hr int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE r hoja_ruta_movimientos; v_prev text := NULL; v_ok boolean := true;
BEGIN
  FOR r IN SELECT * FROM hoja_ruta_movimientos WHERE hoja_ruta_id = p_hr ORDER BY orden LOOP
    IF r.hash_anterior IS DISTINCT FROM v_prev OR r.hash <> fn_mov_hash(v_prev, r) THEN v_ok := false; END IF;
    v_prev := r.hash;
  END LOOP;
  RETURN v_ok;
END $$;

-- ---------- Expedientes ----------
CREATE TABLE expedientes (
  id                   serial PRIMARY KEY,
  hoja_ruta_id         int NOT NULL UNIQUE REFERENCES hojas_ruta(id),
  codigo               varchar(40) NOT NULL UNIQUE,
  serie_id             int REFERENCES cuadro_clasificacion(id),
  unidad_productora_id int NOT NULL REFERENCES unidades_organizacionales(id),
  titulo               varchar(300) NOT NULL,
  estado               varchar(12) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO','CERRADO','TRANSFERIDO')),
  fecha_apertura       date NOT NULL DEFAULT current_date,
  fecha_cierre         date,
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true,
  CONSTRAINT ck_exp_fechas CHECK (fecha_cierre IS NULL OR fecha_cierre >= fecha_apertura),
  CONSTRAINT ck_exp_cierre CHECK (estado = 'ABIERTO' OR fecha_cierre IS NOT NULL)
);

CREATE TABLE expediente_cuerpos (
  id                   serial PRIMARY KEY,
  expediente_id        int NOT NULL REFERENCES expedientes(id),
  numero_cuerpo        int NOT NULL CHECK (numero_cuerpo >= 1),
  foja_inicio          int NOT NULL CHECK (foja_inicio >= 1),
  foja_fin             int NOT NULL,
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true,
  CONSTRAINT ck_cuerpo_fojas CHECK (foja_fin >= foja_inicio),
  UNIQUE (expediente_id, numero_cuerpo),
  CONSTRAINT ex_cuerpo_solape EXCLUDE USING gist
    (expediente_id WITH =, int4range(foja_inicio, foja_fin, '[]') WITH &&) WHERE (activo)
);

CREATE TABLE documentos_digitales (
  id                   serial PRIMARY KEY,
  hoja_ruta_id         int NOT NULL REFERENCES hojas_ruta(id),
  nombre_original      varchar(255) NOT NULL,
  nombre_almacenado    varchar(120) NOT NULL UNIQUE,
  mime                 varchar(80)  NOT NULL DEFAULT 'application/pdf',
  tamano_bytes         bigint NOT NULL CHECK (tamano_bytes > 0),
  sha256               char(64) NOT NULL,
  paginas              int CHECK (paginas IS NULL OR paginas > 0),
  descripcion          varchar(300),
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true
);
CREATE INDEX ix_docdig_hr ON documentos_digitales (hoja_ruta_id) WHERE activo;

CREATE TABLE documentos_internos (
  id                   serial PRIMARY KEY,
  expediente_id        int NOT NULL REFERENCES expedientes(id),
  cuerpo_id            int NOT NULL REFERENCES expediente_cuerpos(id),
  tipo                 varchar(25) NOT NULL DEFAULT 'OTRO'
                         CHECK (tipo IN ('ORIGEN','INFORME_TECNICO','INFORME_LEGAL','NOTA','CARTA','RESOLUCION','PROVEIDO','OTRO')),
  cite                 varchar(100),
  titulo               varchar(300) NOT NULL,
  fecha_documento      date NOT NULL DEFAULT current_date,
  foja_inicio          int NOT NULL CHECK (foja_inicio >= 1),
  foja_fin             int NOT NULL,
  fojas                int GENERATED ALWAYS AS (foja_fin - foja_inicio + 1) STORED,
  autor_id             int REFERENCES usuarios(id),
  archivo_id           int REFERENCES documentos_digitales(id),
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true,
  CONSTRAINT ck_doc_fojas CHECK (foja_fin >= foja_inicio),
  CONSTRAINT ex_doc_solape EXCLUDE USING gist
    (expediente_id WITH =, int4range(foja_inicio, foja_fin, '[]') WITH &&) WHERE (activo)
);
CREATE INDEX ix_doc_exp ON documentos_internos (expediente_id, foja_inicio) WHERE activo;

-- Foliado correlativo SIN baches ni solapes; asigna/crea el cuerpo automáticamente
CREATE FUNCTION fn_doc_before_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_exp   expedientes;
  v_max   int;
  v_lim   int;
  v_n     int;
  v_cuerpo expediente_cuerpos;
BEGIN
  SELECT * INTO v_exp FROM expedientes WHERE id = NEW.expediente_id AND activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expediente inexistente'; END IF;
  IF v_exp.estado <> 'ABIERTO' THEN
    RAISE EXCEPTION 'El expediente % está % y no admite nuevos documentos', v_exp.codigo, v_exp.estado;
  END IF;

  SELECT coalesce(max(foja_fin), 0) INTO v_max FROM documentos_internos
   WHERE expediente_id = NEW.expediente_id AND activo;
  IF NEW.foja_inicio <> v_max + 1 THEN
    RAISE EXCEPTION 'Foliado inválido: la siguiente foja disponible es % (se intentó iniciar en %). No se permiten baches ni solapes.',
      v_max + 1, NEW.foja_inicio;
  END IF;

  SELECT valor::int INTO v_lim FROM parametros_sistema WHERE clave = 'fojas_por_cuerpo';
  v_n := NEW.foja_fin - NEW.foja_inicio + 1;
  IF v_n > v_lim THEN
    RAISE EXCEPTION 'Un documento no puede superar % fojas (un cuerpo)', v_lim;
  END IF;

  SELECT * INTO v_cuerpo FROM expediente_cuerpos
   WHERE expediente_id = NEW.expediente_id AND activo ORDER BY numero_cuerpo DESC LIMIT 1;
  IF FOUND AND (NEW.foja_fin - v_cuerpo.foja_inicio + 1) <= v_lim THEN
    UPDATE expediente_cuerpos SET foja_fin = NEW.foja_fin, actualizado_por = NEW.creado_por
     WHERE id = v_cuerpo.id;
    NEW.cuerpo_id := v_cuerpo.id;
  ELSE
    INSERT INTO expediente_cuerpos (expediente_id, numero_cuerpo, foja_inicio, foja_fin, creado_por)
    VALUES (NEW.expediente_id, coalesce(v_cuerpo.numero_cuerpo, 0) + 1, NEW.foja_inicio, NEW.foja_fin, NEW.creado_por)
    RETURNING id INTO NEW.cuerpo_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_doc_1_insert BEFORE INSERT ON documentos_internos
  FOR EACH ROW EXECUTE FUNCTION fn_doc_before_insert();

-- El foliado registrado es inmutable. Solo se puede anular el ÚLTIMO documento (sin dejar baches)
CREATE FUNCTION fn_doc_before_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max int; v_cuerpo expediente_cuerpos; v_estado varchar;
BEGIN
  IF NEW.foja_inicio <> OLD.foja_inicio OR NEW.foja_fin <> OLD.foja_fin
     OR NEW.expediente_id <> OLD.expediente_id OR NEW.cuerpo_id <> OLD.cuerpo_id THEN
    RAISE EXCEPTION 'El foliado de un documento registrado es inmutable; anule el último documento y regístrelo de nuevo';
  END IF;
  IF OLD.activo AND NOT NEW.activo THEN
    SELECT estado INTO v_estado FROM expedientes WHERE id = OLD.expediente_id FOR UPDATE;
    IF v_estado <> 'ABIERTO' THEN RAISE EXCEPTION 'El expediente está % y no admite anulaciones', v_estado; END IF;
    SELECT max(foja_fin) INTO v_max FROM documentos_internos WHERE expediente_id = OLD.expediente_id AND activo;
    IF OLD.foja_fin <> v_max THEN
      RAISE EXCEPTION 'Solo puede anularse el último documento foliado (este termina en foja %, el último termina en %)', OLD.foja_fin, v_max;
    END IF;
    IF OLD.tipo = 'ORIGEN' THEN RAISE EXCEPTION 'El documento de origen no puede anularse'; END IF;
    SELECT * INTO v_cuerpo FROM expediente_cuerpos WHERE id = OLD.cuerpo_id;
    IF OLD.foja_inicio = v_cuerpo.foja_inicio THEN
      UPDATE expediente_cuerpos SET activo = false, actualizado_por = NEW.actualizado_por WHERE id = v_cuerpo.id;
    ELSE
      UPDATE expediente_cuerpos SET foja_fin = OLD.foja_inicio - 1, actualizado_por = NEW.actualizado_por WHERE id = v_cuerpo.id;
    END IF;
  ELSIF NOT OLD.activo AND NEW.activo THEN
    RAISE EXCEPTION 'Un documento anulado no puede reactivarse';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_doc_2_update BEFORE UPDATE ON documentos_internos
  FOR EACH ROW EXECUTE FUNCTION fn_doc_before_update();

-- Cierre de expediente: debe tener al menos el documento de origen
-- ---------- Transferencias y topografía ----------
CREATE TABLE transferencias (
  id                   serial PRIMARY KEY,
  gestion              int NOT NULL,
  numero               int NOT NULL CHECK (numero > 0),
  codigo               varchar(30) NOT NULL UNIQUE,
  unidad_origen_id     int NOT NULL REFERENCES unidades_organizacionales(id),
  estado               varchar(12) NOT NULL DEFAULT 'SOLICITADA' CHECK (estado IN ('SOLICITADA','APROBADA','RECHAZADA')),
  solicitante_id       int NOT NULL REFERENCES usuarios(id),
  fecha_solicitud      timestamptz NOT NULL DEFAULT now(),
  aprobado_por         int REFERENCES usuarios(id),
  fecha_aprobacion     timestamptz,
  motivo_rechazo       text,
  observaciones        text,
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true,
  UNIQUE (gestion, numero),
  CONSTRAINT ck_transf_aprob CHECK (estado = 'SOLICITADA' OR (aprobado_por IS NOT NULL AND fecha_aprobacion IS NOT NULL)),
  CONSTRAINT ck_transf_rechazo CHECK (estado <> 'RECHAZADA' OR length(btrim(coalesce(motivo_rechazo,''))) > 0)
);

CREATE TABLE cajas_archivo (
  id                   serial PRIMARY KEY,
  codigo               varchar(30) NOT NULL UNIQUE,
  estante              varchar(10) NOT NULL,
  cuerpo               varchar(10) NOT NULL,
  balda                int NOT NULL CHECK (balda >= 1),
  capacidad            int NOT NULL DEFAULT 10 CHECK (capacidad > 0),
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true
);
CREATE INDEX ix_cajas_topografia ON cajas_archivo (estante, cuerpo, balda);

CREATE TABLE detalle_transferencia_cajas (
  id                   serial PRIMARY KEY,
  transferencia_id     int NOT NULL REFERENCES transferencias(id),
  expediente_id        int NOT NULL REFERENCES expedientes(id),
  caja_id              int REFERENCES cajas_archivo(id),
  fojas_total          int NOT NULL CHECK (fojas_total >= 1),
  observaciones        varchar(300),
  creado_por           int,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  actualizado_por      int,
  fecha_actualizacion  timestamptz,
  activo               boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX uq_detalle_expediente ON detalle_transferencia_cajas (expediente_id) WHERE activo;
CREATE INDEX ix_detalle_caja ON detalle_transferencia_cajas (caja_id) WHERE activo;

CREATE FUNCTION fn_detalle_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_estado varchar; v_cap int; v_ocup int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT estado INTO v_estado FROM expedientes WHERE id = NEW.expediente_id;
    IF v_estado IS DISTINCT FROM 'CERRADO' THEN
      RAISE EXCEPTION 'Solo pueden transferirse expedientes CERRADOS (estado actual: %)', coalesce(v_estado,'inexistente');
    END IF;
  END IF;
  IF NEW.caja_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.caja_id IS DISTINCT FROM OLD.caja_id) THEN
    SELECT capacidad INTO v_cap FROM cajas_archivo WHERE id = NEW.caja_id FOR UPDATE;
    SELECT count(*) INTO v_ocup FROM detalle_transferencia_cajas
     WHERE caja_id = NEW.caja_id AND activo AND id IS DISTINCT FROM NEW.id;
    IF v_ocup >= v_cap THEN RAISE EXCEPTION 'La caja ya alcanzó su capacidad (% expedientes)', v_cap; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_detalle_guard BEFORE INSERT OR UPDATE ON detalle_transferencia_cajas
  FOR EACH ROW EXECUTE FUNCTION fn_detalle_guard();

-- ---------- Auditoría (append-only) ----------
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  tabla       varchar(60) NOT NULL,
  registro_id varchar(40),
  accion      varchar(10) NOT NULL,
  usuario_id  int,
  datos_antes jsonb,
  datos_despues jsonb,
  fecha       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_tabla ON audit_log (tabla, registro_id);
CREATE INDEX ix_audit_usuario ON audit_log (usuario_id, fecha DESC);

CREATE FUNCTION fn_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_new jsonb; v_old jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD) - 'password_hash'; END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW) - 'password_hash'; END IF;
  INSERT INTO audit_log (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  VALUES (TG_TABLE_NAME, coalesce(v_new, v_old) ->> 'id', TG_OP,
          coalesce((v_new ->> 'actualizado_por')::int, (v_new ->> 'creado_por')::int, (v_old ->> 'actualizado_por')::int),
          v_old, v_new);
  RETURN coalesce(NEW, OLD);
END $$;

CREATE FUNCTION fn_audit_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'El registro de auditoría es de solo anexado (append-only)'; END $$;
CREATE TRIGGER tr_audit_inmutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_audit_inmutable();

CREATE FUNCTION fn_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.fecha_actualizacion := now(); RETURN NEW; END $$;

CREATE FUNCTION fn_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Eliminación física no permitida en %: use baja lógica (activo = false)', TG_TABLE_NAME; END $$;

-- Aplica auditoría, sello de actualización, FKs de autoría y bloqueo de DELETE físico
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'unidades_organizacionales','usuarios','cuadro_clasificacion','hojas_ruta','hoja_ruta_movimientos',
    'expedientes','expediente_cuerpos','documentos_digitales','documentos_internos',
    'transferencias','cajas_archivo','detalle_transferencia_cajas'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%s_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id)', t, t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%s_actualizado FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)', t, t);
    EXECUTE format('CREATE TRIGGER tr_zz_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_touch()', t);
    EXECUTE format('CREATE TRIGGER tr_zz_audit AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_audit()', t);
    EXECUTE format('CREATE TRIGGER tr_zz_nodelete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_no_delete()', t);
  END LOOP;
END $$;
-- (hoja_ruta_movimientos ya tiene su propio trigger de inmutabilidad; el DELETE lo captura primero por orden alfabético)

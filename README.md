# Sistema de Gestión Documental, Correspondencia y Archivo Municipal (GAM · Bolivia)

Hojas de Ruta, expedientes con foliado estricto, transferencias y topografía del Archivo Central.
**Stack:** NestJS 12 (ESM) · TypeORM + PostgreSQL 16 · Vue 3 (Composition API) · Vite · Tailwind CSS 4 (modo claro/oscuro).

```
backend-archives/   API NestJS  (database/migrations/*.sql = fuente de verdad del esquema)
frontend-archives/  SPA Vue 3
docker-compose.yml  PostgreSQL para desarrollo
```

## Puesta en marcha

```bash
docker compose up -d                       # o use su PostgreSQL 14+ propio
cd backend-archives
cp .env.example .env                       # edite JWT_SECRET (openssl rand -hex 48); SEED_DEMO=true para datos de demostración
npm install && npm run build && npm run start:prod   # aplica migraciones al arrancar (o: npm run start:dev)

cd ../frontend-archives
npm install && npm run dev                 # http://localhost:5173  (proxy /api → :3000)
```

- Primer arranque: crea la unidad *Sistemas* y el usuario `ADMIN_USERNAME` (si `ADMIN_PASSWORD` está vacío se imprime una clave aleatoria en el log). **Debe cambiarla al ingresar.**
- Con `SEED_DEMO=true` se cargan 6 unidades, usuarios de cada rol (`ventanilla`, `smg`, `jefe.daf`, `tecnico.daf`, `jefe.dju`, `tecnico.dju`, `jefe.dop`, `tecnico.dop`, `archivista`; clave `Demo#2026`), 6 series ICA **ilustrativas** y 6 cajas. **No usar en producción.**
- Si su contraseña contiene `#`, enciérrela entre comillas en `.env`.

## Pruebas
```bash
cd backend-archives && npm test                       # unitarias
npm run start:prod &  &&  npm run test:smoke          # flujo completo de extremo a extremo (45 verificaciones)
cd ../frontend-archives && npm test && npm run type-check && npm run build
```

## Reglas críticas que viven en PostgreSQL (ningún cliente puede saltárselas)
| Regla | Mecanismo |
|---|---|
| `foja_fin >= foja_inicio` (cuerpos y documentos) | `CHECK` |
| Sin solapes de fojas por expediente | `EXCLUDE USING gist (int4range …)` |
| Sin baches: cada documento inicia en la siguiente foja libre | trigger `fn_doc_before_insert` |
| Cuerpos automáticos (máx. `fojas_por_cuerpo`, def. 200) | mismo trigger |
| Foliado inmutable; solo se anula el **último** documento | trigger `fn_doc_before_update` |
| Correlativo de HR por gestión, sin saltos | `fn_siguiente_correlativo` (se revierte con el rollback) |
| Máquina de estados REGISTRADO→DERIVADO→CONCLUIDO→ARCHIVADO | trigger `fn_hr_guard` |
| Movimientos inmutables + **cadena de hash SHA-256** (detecta manipulación directa) | triggers + `fn_verificar_cadena` |
| Solo expedientes CERRADOS se transfieren; capacidad de cajas | trigger `fn_detalle_guard` |
| Auditoría (`creado_por`, `fecha_creacion`, `actualizado_por`, `fecha_actualizacion`, `activo`) en todas las tablas + `audit_log` append-only | triggers |
| Sin `DELETE` físico | trigger `fn_no_delete` |

## Roles y flujo
`VENTANILLA` registra y escanea → deriva a `JEFE` → el Jefe recepciona y deriva a `TECNICO` (con plazo en días hábiles) → el Técnico recepciona, abre el expediente, folia, concluye y cierra → Jefe/Técnico solicita transferencia → `ARCHIVISTA` aprueba asignando caja (estante/cuerpo/balda) y la HR pasa a ARCHIVADA. `ADMIN` gestiona usuarios, unidades, ICA y consulta auditoría.
Visibilidad: Jefe ve lo que pasó por su unidad; Técnico lo que pasó por sus manos; Archivista solo concluidas/archivadas; Admin consulta en solo lectura. Toda consulta de un PDF queda en `audit_log`.

## Decisiones y supuestos a validar con el GAM
1. **200 fojas por cuerpo** es parámetro (`parametros_sistema`); confirmar contra la norma ABNB aplicable.
2. Las series y plazos del ICA son **de ejemplo**; el GAM debe aprobar el suyo con el ABNB. La retención se cuenta desde el cierre del expediente (simplificación).
3. Los días hábiles excluyen sábados y domingos, **no feriados** (falta tabla de feriados).
4. Almacenamiento de PDF: **disco local** (`STORAGE_DIR`). S3 no está implementado.
5. Visor PDF = visor nativo del navegador sobre el archivo descargado con token (sin guardado local). No usa pdf.js.
6. La telemetría `@nestjs/observe` del scaffold queda **desactivada** salvo que defina `OBSERVE_APP_KEY/SECRET` (los datos saldrían del servidor institucional).
7. Sesión: JWT de 8 h en `sessionStorage`, sin refresh token. Bloqueo de cuenta tras 5 intentos (15 min).
8. TypeORM se usa para entidades administrativas (unidades, usuarios, series, cajas); el resto usa SQL explícito dentro de transacciones por la lógica de triggers.
9. La anulación del último documento foliado queda en `audit_log` pero aún no pide un motivo.

// Prueba de humo de extremo a extremo contra un servidor en ejecución.
//   SEED_DEMO=true npm run start:prod   (en otra terminal)   →   node test/flujo.smoke.mjs
import { PDFDocument } from 'pdf-lib';

const API = process.env.API ?? 'http://localhost:3000/api';
let fallos = 0;
const ok = (c, msg) => { console.log(`${c ? '✔' : '✘'} ${msg}`); if (!c) fallos++; };

async function http(method, ruta, { token, body, form } = {}) {
  const r = await fetch(API + ruta, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const ct = r.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await r.json() : ct.includes('pdf') ? Buffer.from(await r.arrayBuffer()) : await r.text();
  return { s: r.status, d: data };
}
const login = async (u, p = 'Demo#2026') => (await http('POST', '/auth/login', { body: { username: u, password: p } })).d.accessToken;

const pdf = await PDFDocument.create(); for (let i = 0; i < 3; i++) pdf.addPage();
const pdfBytes = Buffer.from(await pdf.save());

// --- Autenticación / RBAC
ok((await http('POST', '/auth/login', { body: { username: 'ventanilla', password: 'mala' } })).s === 401, 'login con clave errónea → 401');
ok((await http('GET', '/correspondencia')).s === 401, 'sin token → 401');
const tAdmin = await login('admin', 'Admin#2026');
ok((await http('GET', '/admin/usuarios', { token: tAdmin })).s === 403, 'admin con clave inicial debe cambiarla (403 PASSWORD_CHANGE_REQUIRED)');
ok((await http('POST', '/auth/cambiar-password', { token: tAdmin, body: { actual: 'Admin#2026', nueva: 'Admin#2027x' } })).s === 204, 'admin cambia su contraseña');
const admin = await login('admin', 'Admin#2027x');
ok((await http('GET', '/admin/usuarios', { token: admin })).d.length >= 10, 'admin lista usuarios');

const ven = await login('ventanilla'), jefe = await login('jefe.daf'), tec = await login('tecnico.daf');
const jdju = await login('jefe.dju'), arch = await login('archivista');
ok((await http('GET', '/admin/usuarios', { token: ven })).s === 403, 'ventanilla NO accede a /admin');
ok((await http('POST', '/correspondencia', { token: jefe, body: {} })).s === 403, 'jefe NO puede registrar HR (solo Ventanilla)');

// --- Registro en Ventanilla
const dests = (await http('GET', '/catalogos/destinatarios', { token: ven })).d;
const jefeDaf = dests.find((d) => d.unidadSigla === 'DAF');
const series = (await http('GET', '/catalogos/series', { token: ven })).d;
const hr = (await http('POST', '/correspondencia', { token: ven, body: {
  citeOrigen: 'CITE-ASOC/045/2026', remitente: 'Juan Pérez', institucionOrigen: 'Asociación de Vecinos',
  asunto: 'Solicitud de certificación de pagos pendientes', fojasIniciales: 3, destinatarioUsuarioId: jefeDaf.id,
} })).d;
ok(/^HR-\d{5}\/\d{4}$/.test(hr.codigo), `HR registrada con correlativo ${hr.codigo}`);
const hr2 = (await http('POST', '/correspondencia', { token: ven, body: { remitente: 'María López', asunto: 'Otra solicitud sin derivar', fojasIniciales: 1 } })).d;
ok(Number(hr2.codigo.slice(3, 8)) === Number(hr.codigo.slice(3, 8)) + 1, 'correlativo consecutivo');

// --- Subida de PDF
const form = new FormData(); form.append('archivo', new Blob([pdfBytes], { type: 'application/pdf' }), 'solicitud.pdf'); form.append('descripcion', 'Carta original');
const up = await http('POST', `/documentos/hoja-ruta/${hr.id}`, { token: ven, form });
ok(up.s === 201 && up.d.paginas === 3, `PDF subido (${up.d.paginas} páginas detectadas) por Ventanilla`);
const falso = new FormData(); falso.append('archivo', new Blob(['esto no es un pdf'], { type: 'application/pdf' }), 'x.pdf');
ok((await http('POST', `/documentos/hoja-ruta/${hr.id}`, { token: ven, form: falso })).s === 422, 'archivo que no es PDF → 422');

// --- Recepción y derivación
ok((await http('POST', `/correspondencia/${hr.id}/derivar`, { token: jefe, body: { destinatarioUsuarioId: 1, proveido: 'Intento sin recepcionar' } })).s === 422, 'jefe no puede derivar sin recepcionar');
ok((await http('GET', `/correspondencia/${hr.id}`, { token: tec })).s === 404, 'técnico ajeno NO ve la HR');
ok((await http('POST', `/correspondencia/${hr.id}/recibir`, { token: jefe })).s === 200, 'jefe recepciona');
const tecnicos = (await http('GET', '/catalogos/destinatarios', { token: jefe })).d.filter((d) => d.rol === 'ROLE_TECNICO');
const tecDaf = tecnicos.find((d) => d.unidadSigla === 'DAF');
ok((await http('POST', `/correspondencia/${hr.id}/derivar`, { token: jefe, body: { destinatarioUsuarioId: tecDaf.id, proveido: 'Elaborar informe técnico de pagos', plazoDias: 3 } })).s === 200, 'jefe deriva a técnico con plazo de 3 días hábiles');
ok((await http('POST', `/correspondencia/${hr.id}/concluir`, { token: tec, body: { proveido: 'Intento sin recepcionar' } })).s === 422, 'técnico no puede concluir sin recepcionar');
ok((await http('POST', `/correspondencia/${hr.id}/recibir`, { token: tec })).s === 200, 'técnico recepciona');

// --- Expediente y foliado
const exp = (await http('POST', '/expedientes', { token: tec, body: { hojaRutaId: hr.id, serieId: series[0].id } })).d;
ok(exp.id > 0, `expediente ${exp.codigo} abierto (doc. de origen foliado 1–3)`);
const doc = (b) => http('POST', `/expedientes/${exp.id}/documentos`, { token: tec, body: { tipo: 'INFORME_TECNICO', titulo: 'Informe', ...b } });
let r = await doc({ fojaInicio: 6, fojaFin: 8 });
ok(r.s === 422 && /siguiente foja disponible es 4/.test(r.d.message), `bache rechazado: «${r.d.message}»`);
r = await doc({ fojaInicio: 3, fojaFin: 5 });
ok(r.s === 422, 'solape rechazado');
r = await doc({ fojaInicio: 4, fojaFin: 3 });
ok(r.s === 400 && /mayor o igual/.test(r.d.message), 'foja_fin < foja_inicio rechazada (CHECK)');
r = await doc({ fojaInicio: 4, fojaFin: 12, archivoId: up.d.id, cite: 'INF-DAF-001/2026' });
ok(r.s === 201 && r.d.fojas === 9, 'informe foliado 4–12 (9 fojas) con PDF vinculado');
r = await doc({ fojaInicio: 13, fojaFin: 210 });
ok(r.s === 201, 'informe de 198 fojas: la BD abre el cuerpo 2 automáticamente');
let e = (await http('GET', `/expedientes/${exp.id}`, { token: tec })).d;
ok(e.cuerpos.length === 2 && e.cuerpos[0].fojaFin === 12 && e.cuerpos[1].fojaInicio === 13, `cuerpos: ${e.cuerpos.map((c) => `#${c.numeroCuerpo} ${c.fojaInicio}-${c.fojaFin}`).join(' | ')}`);
ok(e.siguienteFoja === 211 && e.foliadoIntegro, 'siguiente foja 211, foliado íntegro');
ok((await http('POST', `/expedientes/documentos/${e.documentos[1].id}/anular`, { token: tec })).s === 422, 'anular documento intermedio rechazado');
ok((await http('POST', `/expedientes/documentos/${e.documentos[2].id}/anular`, { token: tec })).s === 204, 'anular último documento permitido');
e = (await http('GET', `/expedientes/${exp.id}`, { token: tec })).d;
ok(e.cuerpos.length === 1 && e.siguienteFoja === 13, 'cuerpo 2 retirado; siguiente foja 13 (sin baches)');

// --- Conclusión, cierre
ok((await http('POST', `/expedientes/${exp.id}/cerrar`, { token: tec, body: {} })).s === 422, 'no se cierra expediente con HR no concluida');
ok((await http('POST', `/correspondencia/${hr.id}/concluir`, { token: tec, body: { proveido: 'Se emitió informe y se notificó al solicitante' } })).s === 200, 'técnico concluye el trámite');
ok((await http('POST', `/expedientes/${exp.id}/cerrar`, { token: tec, body: {} })).s === 204, 'expediente CERRADO');
ok((await doc({ fojaInicio: 13, fojaFin: 14 })).s === 422, 'expediente cerrado no admite más documentos');

// --- Transferencia y topografía
ok((await http('POST', '/archivo/transferencias', { token: jdju, body: { expedienteIds: [exp.id] } })).s === 403, 'jefe de OTRA unidad no puede transferir');
const tr = (await http('POST', '/archivo/transferencias', { token: jefe, body: { expedienteIds: [exp.id], observaciones: 'Transferencia anual' } })).d;
ok(!!tr.codigo, `transferencia ${tr.codigo} solicitada`);
const cajas = (await http('GET', '/archivo/cajas', { token: arch })).d;
ok((await http('POST', `/archivo/transferencias/${tr.id}/aprobar`, { token: jefe, body: { asignaciones: [{ expedienteId: exp.id, cajaId: cajas[0].id }] } })).s === 403, 'solo el Archivista aprueba');
ok((await http('POST', `/archivo/transferencias/${tr.id}/aprobar`, { token: arch, body: { asignaciones: [{ expedienteId: exp.id, cajaId: cajas[0].id }] } })).s === 200, 'archivista aprueba y asigna caja');
const topo = (await http('GET', '/archivo/topografia', { token: arch })).d;
ok(topo.length === 1 && topo[0].estante === 'E01' && topo[0].cajaCodigo === cajas[0].codigo, `topografía: estante ${topo[0]?.estante}, cuerpo ${topo[0]?.cuerpo}, balda ${topo[0]?.balda}, caja ${topo[0]?.cajaCodigo}; fin retención ${topo[0]?.finRetencion}`);

// --- Línea de tiempo, integridad, visor PDF, auditoría
const det = (await http('GET', `/correspondencia/${hr.id}`, { token: jefe })).d;
ok(det.estado === 'ARCHIVADO' && det.cadenaIntegra, 'HR ARCHIVADA con cadena de hash íntegra');
ok(det.movimientos.map((m) => m.accion).join(',') === 'REGISTRO,DERIVACION,DERIVACION,CONCLUSION,ARCHIVO', `timeline: ${det.movimientos.map((m) => m.accion).join(' → ')}`);
const pdfRes = await http('GET', `/documentos/${up.d.id}/archivo`, { token: jefe });
ok(pdfRes.s === 200 && Buffer.isBuffer(pdfRes.d) && pdfRes.d.subarray(0, 5).toString() === '%PDF-', 'visor: PDF servido en línea');
ok((await http('GET', `/documentos/${up.d.id}/archivo`, { token: jdju })).s === 404, 'jefe de otra unidad no puede ver el PDF');
const aud = (await http('GET', `/auditoria?tabla=documentos_digitales&accion=VIEW`, { token: admin })).d;
ok(aud.total >= 1, 'consulta del PDF queda auditada');
ok((await http('GET', `/auditoria/hoja-ruta/${hr.id}/verificar`, { token: admin })).d.integra === true, 'verificación de cadena (admin)');

for (const [n, t] of [['ventanilla', ven], ['jefe', jefe], ['técnico', tec], ['archivista', arch], ['admin', admin]]) {
  const d = (await http('GET', '/dashboard', { token: t })).d;
  ok(d.tarjetas?.length > 0, `dashboard ${n}: ${d.tarjetas.map((x) => `${x.etiqueta}=${x.valor}`).join(', ')}`);
}
const lista = (await http('GET', '/correspondencia?bandeja=todas&q=pagos&gestion=' + new Date().getFullYear(), { token: ven })).d;
ok(lista.total === 1 && lista.items[0].estado === 'ARCHIVADO', 'bandeja: búsqueda y filtro por gestión');

console.log(fallos ? `\n${fallos} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fallos ? 1 : 0);

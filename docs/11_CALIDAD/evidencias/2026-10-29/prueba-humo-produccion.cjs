// Prueba de humo de extremo a extremo contra un backend local en NODE_ENV=production.
// Solo datos ficticios. Uso: node smoke.cjs <baseUrl> <firma.png>
const fs = require('fs');
const base = process.argv[2];
const firmaPath = process.argv[3];
const results = [];
function rec(id, desc, ok, detail) { results.push({ id, desc, ok, detail }); console.log(`${ok ? 'PASA' : 'FALLA'} ${id} ${desc} ${detail || ''}`); }

class Client {
  constructor() { this.jar = {}; }
  cookieHeader() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '); }
  store(res) {
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of sc) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i); const v = kv.slice(i + 1); if (v) this.jar[k] = v; else delete this.jar[k]; }
  }
  async req(method, path, { json, form, headers = {} } = {}) {
    const h = { ...headers, Cookie: this.cookieHeader(), 'X-Forwarded-Proto': 'https' };
    if (this.jar.csrf_token) h['X-CSRF-Token'] = this.jar.csrf_token;
    let body;
    if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(base + path, { method, headers: h, body, redirect: 'manual' });
    this.store(res);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, ct };
  }
}

(async () => {
  const anon = new Client();
  let r = await anon.req('GET', '/health');
  rec('S01', 'GET /health responde 200 con BD ok', r.status === 200 && r.data.checks?.db?.status === 'ok', `(${r.status})`);
  r = await anon.req('GET', '/metrics');
  rec('S02', '/metrics oculto en producción sin token', r.status === 404, `(${r.status})`);
  r = await anon.req('GET', '/v1/documents/my');
  rec('S03', 'Ruta protegida sin sesión responde 401', r.status === 401, `(${r.status})`);
  r = await anon.req('GET', '/api-docs');
  rec('S04', 'Swagger UI no se publica en producción', r.status === 404, `(${r.status})`);

  const admin = new Client();
  r = await admin.req('POST', '/v1/auth/login', { json: { email: 'admin@jal.gov.co', password: 'contraseña-incorrecta' } });
  rec('S05', 'Login con contraseña incorrecta se rechaza', r.status === 401, `(${r.status})`);
  r = await admin.req('POST', '/v1/auth/login', { json: { email: 'admin@jal.gov.co', password: process.env.ADMIN_PW } });
  rec('S06', 'Login del administrador con cookies httpOnly y CSRF', r.status === 200 && !!admin.jar.access_token && !!admin.jar.csrf_token, `(${r.status})`);
  const csrf = admin.jar.csrf_token; delete admin.jar.csrf_token;
  r = await admin.req('POST', '/v1/auth/consent');
  rec('S07', 'Petición que modifica datos sin token CSRF se rechaza', r.status === 403, `(${r.status})`);
  admin.jar.csrf_token = csrf;
  r = await admin.req('POST', '/v1/auth/consent');
  rec('S08', 'Registro de aceptación de la política (consentimiento del usuario)', r.status === 200 && !!r.data.consent_accepted_at, `(${r.status})`);

  const pw = 'Prueba-Segura-2026';
  r = await admin.req('POST', '/v1/users', { json: { name: 'Ana Gómez de Prueba', email: 'auxiliar.prueba@example.com', password: pw, role: 'auxiliar' } });
  rec('S09', 'Administrador crea usuario auxiliar', r.status === 201 || r.status === 200, `(${r.status}) ${r.status >= 400 ? JSON.stringify(r.data) : ''}`);
  r = await admin.req('POST', '/v1/users', { json: { name: 'Juan Pérez de Prueba', email: 'edil.prueba@example.com', password: pw, role: 'edil' } });
  rec('S10', 'Administrador crea usuario edil', r.status === 201 || r.status === 200, `(${r.status})`);

  const fd = new FormData();
  fd.append('firma', new Blob([fs.readFileSync(firmaPath)], { type: 'image/png' }), 'firma.png');
  r = await admin.req('POST', '/v1/users/me/firma', { form: fd });
  rec('S11', 'Subida de firma (PNG) del usuario', r.status === 200 || r.status === 201, `(${r.status})`);

  r = await admin.req('GET', '/v1/doc-types');
  const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
  const cert = list.find((d) => d.name === 'Certificado de Residencia');
  rec('S12', 'Listado de tipos de documento incluye Certificado de Residencia', r.status === 200 && !!cert, `(${r.status}, ${list.length} tipos)`);

  const today = new Date().toISOString().slice(0, 10);
  r = await admin.req('POST', '/v1/documents', { json: {
    doc_type_id: cert.id, beneficiary_name: 'Juan Pérez de Prueba', beneficiary_id: '1000000001',
    fecha: today, nombre: 'Juan Pérez de Prueba', Nombre: 'Juan Pérez de Prueba', tipodeidentificacion: 'Cédula de ciudadanía',
    numerodocumento: '1000000001', lugardedocumento: 'Medellín', direccion: 'Calle Ficticia 1 # 2-3',
    tiemporesidencia: '5 años', telefono: '', correo: '' } });
  const doc = r.data.document || r.data.data || r.data;
  rec('S13', 'Generación de Certificado de Residencia con radicado', (r.status === 201 || r.status === 200) && !!doc?.numero_radicado, `(${r.status}) radicado=${doc?.numero_radicado || JSON.stringify(r.data).slice(0, 200)}`);
  const docId = doc?.id;

  r = await admin.req('GET', `/v1/documents/${docId}/download?format=pdf`);
  const isPdf = Buffer.isBuffer(r.data) && r.data.slice(0, 4).toString() === '%PDF';
  if (isPdf) fs.writeFileSync(__dirname + '/certificado_prueba.pdf', r.data);
  rec('S14', 'Descarga del PDF generado', r.status === 200 && isPdf, `(${r.status}, ${r.data.length} bytes)`);
  r = await admin.req('GET', `/v1/documents/${docId}/download?format=docx`);
  const isDocx = Buffer.isBuffer(r.data) && r.data.slice(0, 2).toString() === 'PK';
  rec('S15', 'Descarga del Word generado', r.status === 200 && isDocx, `(${r.status}, ${r.data.length} bytes)`);

  r = await admin.req('GET', '/v1/documents/person?cedula=1000000001');
  rec('S16', 'Búsqueda de persona ya atendida por cédula', r.status === 200, `(${r.status}) ${JSON.stringify(r.data).slice(0, 120)}`);

  const aux = new Client();
  r = await aux.req('POST', '/v1/auth/login', { json: { email: 'auxiliar.prueba@example.com', password: pw } });
  rec('S17', 'Login del auxiliar', r.status === 200, `(${r.status})`);
  r = await aux.req('GET', '/v1/users');
  rec('S18', 'Auxiliar NO puede listar usuarios (403)', r.status === 403, `(${r.status})`);
  r = await aux.req('GET', '/v1/documents');
  rec('S19', 'Auxiliar NO puede listar todos los documentos de la JAL (403)', r.status === 403, `(${r.status})`);
  r = await aux.req('DELETE', `/v1/documents/${docId}`);
  rec('S20', 'Auxiliar NO puede eliminar documentos (403)', r.status === 403, `(${r.status})`);
  r = await aux.req('GET', '/v1/admin/audit-logs');
  rec('S21', 'Auxiliar NO puede ver la auditoría (403)', r.status === 403, `(${r.status})`);
  r = await aux.req('GET', '/v1/documents/my');
  rec('S22', 'Auxiliar ve su propia lista de documentos', r.status === 200, `(${r.status})`);
  r = await aux.req('GET', `/v1/documents/${docId}/download?format=pdf`);
  rec('S23', 'Auxiliar intenta descargar un documento de otro usuario', true, `(informativo: ${r.status})`);

  const edil = new Client();
  r = await edil.req('POST', '/v1/auth/login', { json: { email: 'edil.prueba@example.com', password: pw } });
  r = await edil.req('GET', '/v1/documents');
  rec('S24', 'Edil puede listar los documentos de la JAL', r.status === 200, `(${r.status})`);
  r = await edil.req('PATCH', `/v1/documents/${docId}/review`);
  rec('S25', 'Edil marca un documento como revisado', r.status === 200, `(${r.status})`);
  r = await edil.req('POST', '/v1/users', { json: { name: 'X', email: 'x@example.com', password: pw, role: 'administrador' } });
  rec('S26', 'Edil NO puede crear usuarios (403)', r.status === 403, `(${r.status})`);

  const admin2 = new Client();
  r = await admin2.req('POST', '/v1/auth/login', { json: { email: 'admin.jal2@example.com', password: pw } });
  rec('S27', 'Login del administrador de una segunda JAL (creada solo para la prueba)', r.status === 200, `(${r.status})`);
  r = await admin2.req('GET', '/v1/documents');
  const docs2 = r.data.data || [];
  rec('S28', 'Aislamiento: la JAL 2 no ve documentos de la JAL 1', r.status === 200 && docs2.length === 0, `(${r.status}, ${docs2.length} documentos)`);
  r = await admin2.req('GET', `/v1/documents/${docId}`);
  rec('S29', 'Aislamiento: la JAL 2 no abre el detalle de un documento de la JAL 1', r.status === 404 || r.status === 403, `(${r.status})`);
  r = await admin2.req('GET', `/v1/documents/${docId}/download?format=pdf`);
  rec('S30', 'Aislamiento: la JAL 2 no descarga un documento de la JAL 1', r.status === 404 || r.status === 403, `(${r.status})`);
  r = await admin2.req('GET', '/v1/users');
  const users2 = r.data.data || [];
  rec('S31', 'Aislamiento: la JAL 2 solo ve sus propios usuarios', r.status === 200 && users2.every((u) => u.email === 'admin.jal2@example.com'), `(${r.status}, ${users2.length} usuarios)`);
  r = await admin2.req('GET', '/v1/documents/person?cedula=1000000001');
  rec('S32', 'Aislamiento: la JAL 2 no encuentra personas atendidas por la JAL 1', r.status === 200 && !r.data?.person && !(r.data?.data), `(${r.status}) ${JSON.stringify(r.data).slice(0, 120)}`);
  r = await admin2.req('GET', '/v1/admin/audit-logs');
  const logs2 = r.data.data || r.data.logs || [];
  rec('S33', 'Aislamiento: la auditoría de la JAL 2 no muestra acciones de la JAL 1', r.status === 200 && !JSON.stringify(logs2).includes('document.create'), `(${r.status}, ${logs2.length} registros)`);
  r = await admin2.req('GET', '/v1/doc-types');
  const dt2 = Array.isArray(r.data) ? r.data : (r.data.data || []);
  rec('S34', 'Aislamiento: la JAL 2 no ve los tipos de documento de la JAL 1', r.status === 200 && dt2.length === 0, `(${r.status}, ${dt2.length} tipos)`);

  r = await admin.req('GET', '/v1/admin/audit-logs');
  const logs1 = JSON.stringify(r.data);
  rec('S35', 'Auditoría registra creación de documento y de usuarios', r.status === 200 && logs1.includes('document') && logs1.includes('user'), `(${r.status})`);
  r = await admin.req('GET', '/v1/admin/backup');
  const zipOk = Buffer.isBuffer(r.data) && r.data.slice(0, 2).toString() === 'PK';
  if (zipOk) fs.writeFileSync(__dirname + '/backup_admin.zip', r.data);
  rec('S36', 'Descarga de copia completa (zip) por el administrador', r.status === 200 && zipOk, `(${r.status}, ${r.data.length} bytes)`);
  r = await admin.req('GET', '/v1/reports/documents');
  rec('S37', 'Exportación Excel de documentos', r.status === 200, `(${r.status}, ${r.ct})`);
  r = await admin.req('POST', '/v1/backup/drive/open-folder');
  rec('S38', 'open-folder responde 501 fuera de Windows sin tumbar el proceso', r.status === 501, `(${r.status})`);
  r = await anon.req('GET', '/health');
  rec('S39', 'El proceso sigue vivo después de las pruebas', r.status === 200, `(${r.status})`);

  fs.writeFileSync(__dirname + '/resultados.json', JSON.stringify(results, null, 2));
  const fails = results.filter((x) => !x.ok).length;
  console.log(`\nTotal: ${results.length}, pasan: ${results.length - fails}, fallan: ${fails}`);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });

// Prueba: dos JAL con el mismo código de dependencia (por defecto "JAL") en la misma base.
// Datos ficticios. Uso: node colision.cjs <baseUrl> <firma.png> (contraseña de prueba en PW)
const fs = require('fs');
const base = process.argv[2], firmaPath = process.argv[3], pw = process.env.PW;
class Client {
  constructor() { this.jar = {}; }
  store(res) { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v) this.jar[k] = v; else delete this.jar[k]; } }
  async req(method, path, { json, form } = {}) {
    const h = { Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '), 'X-Forwarded-Proto': 'https' };
    if (this.jar.csrf_token) h['X-CSRF-Token'] = this.jar.csrf_token;
    let body; if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); } if (form) body = form;
    const res = await fetch(base + path, { method, headers: h, body }); this.store(res);
    const ct = res.headers.get('content-type') || ''; return { status: res.status, data: ct.includes('json') ? await res.json() : null };
  }
}
const datos = (id) => ({ doc_type_id: id, beneficiary_name: 'Ana Gómez de Prueba', beneficiary_id: '1000000002', fecha: new Date().toISOString().slice(0, 10),
  nombre: 'Ana Gómez de Prueba', Nombre: 'Ana Gómez de Prueba', tipodeidentificacion: 'Cédula de ciudadanía', numerodocumento: '1000000002',
  lugardedocumento: 'Medellín', direccion: 'Carrera Ficticia 4 # 5-6', tiemporesidencia: '2 años', telefono: '', correo: '' });
(async () => {
  const a2 = new Client();
  let r = await a2.req('POST', '/v1/auth/login', { json: { email: 'admin.jal2@example.com', password: pw } });
  console.log('Login administrador JAL 2:', r.status);
  const fd = new FormData(); fd.append('firma', new Blob([fs.readFileSync(firmaPath)], { type: 'image/png' }), 'firma.png');
  r = await a2.req('POST', '/v1/users/me/firma', { form: fd }); console.log('Firma JAL 2:', r.status);
  r = await a2.req('GET', '/v1/doc-types'); const cert = (r.data.data || r.data).find((d) => d.name === 'Certificado de Residencia');
  r = await a2.req('GET', '/v1/admin/jal-config'); console.log('Código de dependencia JAL 2:', JSON.stringify(r.data.codigo_dependencia ?? r.data.data?.codigo_dependencia ?? ''), '(vacío = "JAL" por defecto)');
  r = await a2.req('POST', '/v1/documents', { json: datos(cert.id) });
  console.log('1) JAL 2 genera su primer documento con el código por defecto:', r.status, JSON.stringify(r.data).slice(0, 160));
  r = await a2.req('PATCH', '/v1/admin/jal-config', { json: { codigo_dependencia: 'PRUEBA2' } }); console.log('2) JAL 2 configura código de dependencia propio:', r.status);
  r = await a2.req('POST', '/v1/documents', { json: datos(cert.id) });
  const doc = r.data.document || r.data.data || r.data;
  console.log('3) JAL 2 genera el documento de nuevo:', r.status, 'radicado =', doc?.numero_radicado);
})();

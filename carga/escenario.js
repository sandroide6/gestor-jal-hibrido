// Prueba de carga del Gestor JAL con k6 (auditoría 2026-11-05, plan 5.1).
//
// Simula el uso real de una JAL: varias personas consultando a la vez y creando
// documentos con la plantilla oficial (la operación más pesada: LibreOffice convierte el
// DOCX a PDF). Al final k6 compara los resultados con los umbrales de la auditoría y
// termina con código distinto de 0 si alguno no se cumple.
//
// NUNCA contra producción: crea usuarios y documentos de prueba. Usar la base local o
// el staging (docs/06_DESPLIEGUE/STAGING.md).
//
// Uso:
//   k6 run carga/escenario.js \
//     -e BASE_URL=http://localhost:3001 \
//     -e ADMIN_EMAIL=admin@jal.gov.co -e ADMIN_PASSWORD=<contraseña del admin de pruebas>
// Opcionales: -e USUARIOS=5 (auxiliares de prueba) -e DURACION=2m -e DOCS_POR_MIN=12
//             -e RAFAGA=10 (documentos simultáneos en la ráfaga final)
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const USUARIOS = parseInt(__ENV.USUARIOS || '5', 10);
const DURACION = __ENV.DURACION || '2m';
const DOCS_POR_MIN = parseInt(__ENV.DOCS_POR_MIN || '12', 10);
const RAFAGA = parseInt(__ENV.RAFAGA || '10', 10);
const DOC_TYPE = '00000000-0000-0000-0000-000000000023'; // Certificado de Residencia (plantilla oficial)
const CLAVE = 'Carga-k6-Prueba-2026!';
const FIRMA = open('../frontend/public/icons/icon-192x192.png', 'b');

const tCrear = new Trend('crear_documento', true);
const tDescargar = new Trend('descargar_pdf', true);

export const options = {
  scenarios: {
    consultas: {
      executor: 'constant-vus', vus: USUARIOS, duration: DURACION, exec: 'consultar',
    },
    creacion: {
      executor: 'constant-arrival-rate', rate: DOCS_POR_MIN, timeUnit: '1m', duration: DURACION,
      preAllocatedVUs: USUARIOS, maxVUs: USUARIOS * 2, exec: 'crearDocumento',
    },
    rafaga: {
      executor: 'per-vu-iterations', vus: RAFAGA, iterations: 1, startTime: DURACION,
      maxDuration: '3m', exec: 'crearDocumento',
    },
  },
  // Criterios de la auditoría (plan 3.2 y 5.1)
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{tipo:consulta}': ['p(95)<800'],
    crear_documento: ['p(95)<15000'],
    descargar_pdf: ['p(95)<2000'],
  },
};

function cookieDe(res, nombre) {
  const c = res.cookies[nombre];
  return c && c.length ? c[0].value : null;
}

function sesion(email, password) {
  const res = http.post(`${BASE}/v1/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status !== 200) fail(`login ${email}: ${res.status} ${res.body}`);
  const access = cookieDe(res, 'access_token');
  const csrf = cookieDe(res, 'csrf_token');
  return { cookie: `access_token=${access}; csrf_token=${csrf}`, csrf };
}

function cabeceras(s, extra = {}) {
  return { Cookie: s.cookie, 'X-CSRF-Token': s.csrf, ...extra };
}

// Una vez antes de empezar: crea los auxiliares de prueba, les cambia la contraseña
// inicial (obligatorio) y les sube una firma.
export function setup() {
  const admin = sesion(__ENV.ADMIN_EMAIL, __ENV.ADMIN_PASSWORD);
  const sufijo = Date.now();
  const sesiones = [];
  for (let i = 0; i < USUARIOS; i++) {
    const email = `carga-${sufijo}-${i}@prueba.co`;
    const inicial = `Inicial-${sufijo}-${i}`;
    const r = http.post(`${BASE}/v1/users`, JSON.stringify({ name: `Carga ${i}`, email, password: inicial, role: 'auxiliar' }), {
      headers: cabeceras(admin, { 'Content-Type': 'application/json' }),
    });
    if (r.status !== 201 && r.status !== 200) fail(`crear usuario: ${r.status} ${r.body}`);
    const s0 = sesion(email, inicial);
    const c = http.patch(`${BASE}/v1/auth/change-password`, JSON.stringify({ currentPassword: inicial, newPassword: CLAVE }), {
      headers: cabeceras(s0, { 'Content-Type': 'application/json' }),
    });
    if (c.status !== 200) fail(`cambiar contraseña: ${c.status} ${c.body}`);
    const s = sesion(email, CLAVE);
    const f = http.post(`${BASE}/v1/users/me/firma`, { firma: http.file(FIRMA, 'firma.png', 'image/png') }, { headers: cabeceras(s) });
    if (f.status !== 200) fail(`subir firma: ${f.status} ${f.body}`);
    sesiones.push(s);
  }
  return { sesiones };
}

function miSesion(data) {
  return data.sesiones[(__VU - 1) % data.sesiones.length];
}

// Lo que hace una persona entre documento y documento: abrir Inicio, ver tipos, buscar.
export function consultar(data) {
  const s = miSesion(data);
  const p = { headers: cabeceras(s), tags: { tipo: 'consulta' } };
  const r1 = http.get(`${BASE}/v1/documents/my?page=1&limit=10`, p);
  const r2 = http.get(`${BASE}/v1/doc-types`, p);
  const r3 = http.get(`${BASE}/v1/users/me`, p);
  check(r1, { 'mis documentos 200': (r) => r.status === 200 });
  check(r2, { 'tipos 200': (r) => r.status === 200 });
  check(r3, { 'perfil 200': (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);
}

export function crearDocumento(data) {
  const s = miSesion(data);
  const ced = `${Date.now()}${__VU}${__ITER}`.slice(-10);
  const cuerpo = {
    doc_type_id: DOC_TYPE,
    beneficiary_name: `Persona de carga ${ced}`,
    beneficiary_id: ced,
    fecha: '2026-11-06', nombre: `Persona de carga ${ced}`, tipodeidentificacion: 'Cédula de ciudadanía',
    numerodocumento: ced, lugardedocumento: 'Medellín', direccion: 'Calle 1 # 2-3', tiemporesidencia: '5 años',
  };
  const r = http.post(`${BASE}/v1/documents`, JSON.stringify(cuerpo), {
    headers: cabeceras(s, { 'Content-Type': 'application/json' }), tags: { tipo: 'crear' }, timeout: '60s',
  });
  tCrear.add(r.timings.duration);
  if (!check(r, { 'documento creado 201': (x) => x.status === 201 })) return;
  const id = r.json('id') || r.json('document.id');
  const d = http.get(`${BASE}/v1/documents/${id}/download?format=pdf`, { headers: cabeceras(s), tags: { tipo: 'descarga' } });
  tDescargar.add(d.timings.duration);
  check(d, { 'PDF descargado': (x) => x.status === 200 && String(x.body).startsWith('%PDF-') });
}

'use strict';
/**
 * Script de prueba: crea un documento por cada tipo y guarda los PDFs en el Escritorio.
 * Uso (desde la carpeta backend): node test_documentos.js
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
require('dotenv').config();

const jwt         = require('jsonwebtoken');
const { User }    = require('./src/models');

const BASE  = 'http://localhost:3001/v1';
const DESK  = path.join(os.homedir(), 'Desktop', 'documentos_prueba');
const SECRET = process.env.JWT_SECRET;

// ── Datos de prueba por nombre de campo ───────────────────
const DATOS = {
  nombre:              'Juan David Pérez González',
  nombre_completo:     'Juan David Pérez González',
  nombre_titular:      'Juan David Pérez González',
  nombre_pareja:       'María García López',
  nombre_directivo:    'Carlos Rodríguez',
  nombre_entidad:      'Alcaldía de Medellín',
  nombre_comuna:       'La América',
  cedula:              '1234567890',
  cedula_pareja:       '9876543210',
  numerodocumento:     '1234567890',
  fecha:               '2025-07-01',
  fecha_inicio:        '2025-01-15',
  fecha_fin:           '2025-06-30',
  fecha_inicial:       '2025-01-15',
  fecha_final:         '2025-06-30',
  direccion:           'Calle 45 # 23-12, La América',
  'dirección':         'Calle 45 # 23-12, La América',
  'dirección':   'Calle 45 # 23-12, La América',
  direccion_entidad:   'Calle 44 # 52-165',
  celular:             '3001234567',
  telefono:            '3001234567',
  correo:              'juan.perez@correo.com',
  universidad:         'Universidad de Antioquia',
  institucion:         'Universidad de Antioquia',
  programa:            'Ingeniería de Sistemas',
  barrio:              'La América',
  motivo:              'Solicitud de empleo',
  asunto:              'Solicitud de información presupuestal',
  tema:                'Revisión del presupuesto participativo',
  contenido:           'Por medio del presente comunicado, la JAL Comuna 12 informa sobre las actividades comunitarias del periodo.',
  destinatario:        'Secretaría de Participación Ciudadana',
  tiempo:              '5 años',
  tiempo_residencia:   '3 años',
  tiempo_convivencia:  '2 años',
  tiemporesidencia:    '3 años',
  tipodocumento:       'Cédula de ciudadanía',
  lugardocumento:      'Medellín',
  lugardedocumento:    'Medellín',
  lugar:               'Salón comunal La América',
  lugarservicio:       'JAL Comuna 12 - La América',
  estrato:             '2',
  horas:               '80',
  numerohoras:         '80',
  periodo:             '2025-1',
  numeroperiodo:       '2025-1',
  hora:                '3:00 p.m.',
};

// ── HTTP helpers ───────────────────────────────────────────
function httpRequest(url, opts, body) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function jsonGet(url, token) {
  return httpRequest(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => JSON.parse(r.body.toString()));
}

function postMultipart(url, token, fields) {
  const boundary = 'GestorTest' + Date.now();
  const lines = [];
  for (const [k, v] of Object.entries(fields)) {
    lines.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}`);
  }
  const bodyStr = lines.join('\r\n') + `\r\n--${boundary}--\r\n`;
  const buf = Buffer.from(bodyStr, 'utf8');
  return httpRequest(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': buf.length,
    },
  }, buf);
}

// ── Construir datos del formulario ─────────────────────────
function buildFormData(fields) {
  const data = {};
  for (const f of fields) {
    if (f.name in DATOS) {
      data[f.name] = DATOS[f.name];
    } else {
      switch (f.type) {
        case 'date':     data[f.name] = '2025-07-01'; break;
        case 'number':   data[f.name] = '10'; break;
        case 'select':   data[f.name] = f.options?.[0] ?? 'Opción 1'; break;
        case 'checkbox': data[f.name] = 'Sí'; break;
        case 'duracion': data[f.name] = '2 años'; break;
        case 'periodo':  data[f.name] = '2025-1'; break;
        default:         data[f.name] = `Prueba ${f.label}`;
      }
    }
  }
  return data;
}

function safeName(s) {
  return s.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ-]/g, '').trim().replace(/\s+/g, '_');
}

// ── MAIN ───────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(DESK, { recursive: true });
  console.log(`\nCarpeta de salida: ${DESK}\n`);

  const admin = await User.findOne({ where: { role: 'administrador' } });
  if (!admin) throw new Error('No hay usuario administrador en la BD');
  const token = jwt.sign({ sub: admin.id, role: 'administrador', jal_id: admin.jal_id },
    SECRET, { algorithm: 'HS256', expiresIn: '2h' });
  console.log(`Token generado para: ${admin.email}\n`);

  const tipos = await jsonGet(`${BASE}/doc-types`, token);
  const lista = Array.isArray(tipos) ? tipos : (tipos.data ?? []);
  console.log(`Tipos encontrados: ${lista.length}\n`);

  const resultados = [];

  for (const tipo of lista) {
    process.stdout.write(`  > ${tipo.name} ... `);
    try {
      const formData  = buildFormData(tipo.fields ?? []);
      const nameField = (tipo.fields ?? []).find(f => /^(nombre|nombre_completo|nombre_titular)$/i.test(f.name));
      const idField   = (tipo.fields ?? []).find(f => /^(cedula|numerodocumento|numero_documento)$/i.test(f.name));
      const bName = nameField ? (DATOS[nameField.name] ?? 'Juan Pérez') : 'Juan Pérez';
      const bId   = idField   ? (DATOS[idField.name]   ?? '1234567890') : '1234567890';

      // El backend lee req.body directamente: cada campo va como campo multipart propio
      const res = await postMultipart(`${BASE}/documents`, token, {
        doc_type_id:      tipo.id,
        beneficiary_name: bName,
        beneficiary_id:   bId,
        ...formData,
      });

      if (res.status !== 201) {
        const msg = (() => { try { return JSON.parse(res.body.toString()).message; } catch { return res.body.toString().slice(0,120); } })();
        console.log(`ERROR ${res.status}: ${msg}`);
        resultados.push({ nombre: tipo.name, ok: false, error: msg });
        continue;
      }

      const doc   = JSON.parse(res.body.toString());
      const docId = doc.id ?? doc.document?.id;

      const dl = await httpRequest(`${BASE}/documents/${docId}/download?format=pdf`,
        { headers: { Authorization: `Bearer ${token}` } });

      if (dl.status !== 200) {
        console.log(`Creado pero descarga fallo (${dl.status})`);
        resultados.push({ nombre: tipo.name, ok: false, error: `Descarga ${dl.status}` });
        continue;
      }

      const archivo = path.join(DESK, `${safeName(tipo.name)}.pdf`);
      fs.writeFileSync(archivo, dl.body);
      const kb = (dl.body.length / 1024).toFixed(1);
      console.log(`OK ${kb} KB`);
      resultados.push({ nombre: tipo.name, ok: true });

    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      resultados.push({ nombre: tipo.name, ok: false, error: err.message });
    }
  }

  console.log('\n==============================================');
  const ok  = resultados.filter(r => r.ok).length;
  const err = resultados.filter(r => !r.ok).length;
  for (const r of resultados)
    console.log(`  ${r.ok ? '[OK]' : '[ERR]'} ${r.nombre}${r.ok ? '' : ` - ${r.error}`}`);
  console.log(`\n  OK: ${ok}   Errores: ${err}`);
  console.log(`  Archivos en: ${DESK}\n`);
  process.exit(0);
}

main().catch(e => { console.error('\nError fatal:', e.message); process.exit(1); });

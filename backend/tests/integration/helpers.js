'use strict';
// Utilidades para pruebas de integración contra un PostgreSQL REAL (el de la CI, con
// migraciones y seeders aplicados). A diferencia de src/__tests__, aquí no se simula
// ningún modelo: cada prueba pasa por Express, Sequelize y la base.
const fs = require('fs');
const path = require('path');
const request = require('supertest');

const ADMIN_EMAIL = 'admin@jal.gov.co';
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'Admin1234!';
const FIRMA_PNG = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'icons', 'icon-192x192.png');

function cookieValue(res, name) {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(';')[0].slice(name.length + 1) : null;
}

async function login(app, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const res = await request(app).post('/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login ${email} falló: ${res.status} ${JSON.stringify(res.body)}`);
  const access = cookieValue(res, 'access_token');
  const csrf = cookieValue(res, 'csrf_token');
  return {
    user: res.body.user,
    cookie: `access_token=${access}; csrf_token=${csrf}`,
    csrf,
  };
}

async function ensureSignature(app, session) {
  const res = await request(app)
    .post('/v1/users/me/firma')
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrf)
    .attach('firma', fs.readFileSync(FIRMA_PNG), { filename: 'firma.png', contentType: 'image/png' });
  if (res.status !== 200) throw new Error(`subir firma falló: ${res.status} ${JSON.stringify(res.body)}`);
}

function uniq() {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-12);
}

// Tipo con plantilla oficial (.docx en backend/plantillas) y tipo sin plantilla.
const DOC_TYPE_TEMPLATE = '00000000-0000-0000-0000-000000000023';
const DOC_TYPE_SIMPLE = '00000000-0000-0000-0000-000000000011';

function templateFields(cedula) {
  return {
    fecha: '2026-11-05', nombre: `Prueba ${cedula}`, tipodeidentificacion: 'CC',
    numerodocumento: cedula, lugardedocumento: 'Medellín', direccion: 'Calle 1 # 2-3',
    tiemporesidencia: '5 años',
  };
}

function simpleFields(cedula) {
  return {
    cedula, nombre_completo: `Prueba ${cedula}`, direccion: 'Calle 9', barrio: 'La América',
    tiempo_residencia: '2 años', motivo: 'Trámite',
  };
}

module.exports = {
  ADMIN_EMAIL, ADMIN_PASSWORD, login, ensureSignature, uniq, cookieValue,
  DOC_TYPE_TEMPLATE, DOC_TYPE_SIMPLE, templateFields, simpleFields,
};

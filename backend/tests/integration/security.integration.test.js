'use strict';
// Regresiones de seguridad de la auditoría de producción 2026-11-05, contra base real:
//   P1-6  contraseña inicial obligatoria de cambiar
//   P1-1  quitar un rol revoca la sesión al instante
process.env.NODE_ENV = 'test';
const request = require('supertest');
const h = require('./helpers');

let app;
let User;

beforeAll(async () => {
  app = require('../../src/app');
  ({ User } = require('../../src/models'));
}, 60000);

describe('P1-6 — contraseña inicial obligatoria de cambiar', () => {
  it('el administrador sembrado queda marcado para cambiar la contraseña', async () => {
    const admin = await User.findOne({ where: { email: 'admin@jal.gov.co' } });
    expect(admin.must_change_password).toBe(true);
  });

  it('con must_change_password solo se permite cambiar la contraseña; después todo vuelve a funcionar', async () => {
    const u = await h.createTestUser('auxiliar', { mustChange: true });
    const s = await h.login(app, u.email);
    expect(s.user.must_change_password).toBe(true);

    const blocked = await request(app).get('/v1/documents/my').set('Cookie', s.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const me = await request(app).get('/v1/users/me').set('Cookie', s.cookie);
    expect(me.status).toBe(200);

    const change = await request(app).patch('/v1/auth/change-password')
      .set('Cookie', s.cookie).set('X-CSRF-Token', s.csrf)
      .send({ currentPassword: u.password, newPassword: 'Nueva-Clave-2026!' });
    expect(change.status).toBe(200);

    // La sesión sigue abierta en este equipo con los tokens reemitidos en el mismo segundo
    const newAccess = h.cookieValue(change, 'access_token');
    const newCsrf = h.cookieValue(change, 'csrf_token');
    const sameSession = await request(app).get('/v1/documents/my').set('Cookie', `access_token=${newAccess}; csrf_token=${newCsrf}`);
    expect(sameSession.status).toBe(200);

    const s2 = await h.login(app, u.email, 'Nueva-Clave-2026!');
    expect(s2.user.must_change_password).toBe(false);
    const ok = await request(app).get('/v1/documents/my').set('Cookie', s2.cookie);
    expect(ok.status).toBe(200);
  }, 60000);

  it('un usuario creado por el administrador debe cambiar la contraseña asignada', async () => {
    const admin = await h.createTestUser('administrador');
    const s = await h.login(app, admin.email);
    const email = `nuevo-${h.uniq()}@prueba.co`;
    const res = await request(app).post('/v1/users').set('Cookie', s.cookie).set('X-CSRF-Token', s.csrf)
      .send({ name: 'Nuevo', email, password: 'Asignada-123', role: 'auxiliar' });
    expect(res.status).toBe(201);
    const created = await User.findOne({ where: { email } });
    expect(created.must_change_password).toBe(true);
  }, 60000);
});

describe('P1-1 — cambiar el rol revoca la sesión', () => {
  it('un administrador degradado a auxiliar pierde el acceso con su token anterior', async () => {
    const admin = await h.createTestUser('administrador');
    const sAdmin = await h.login(app, admin.email);
    const victim = await h.createTestUser('administrador');
    const sVictim = await h.login(app, victim.email);

    expect((await request(app).get('/v1/users').set('Cookie', sVictim.cookie)).status).toBe(200);

    // Los tokens llevan iat en segundos: esperar a cambiar de segundo evita el empate
    await new Promise((r) => setTimeout(r, 1100));
    const demote = await request(app).patch(`/v1/users/${victim.id}`)
      .set('Cookie', sAdmin.cookie).set('X-CSRF-Token', sAdmin.csrf)
      .send({ role: 'auxiliar' });
    expect(demote.status).toBe(200);

    const after = await request(app).get('/v1/users').set('Cookie', sVictim.cookie);
    expect(after.status).toBe(401);
    const backup = await request(app).get('/v1/admin/backup').set('Cookie', sVictim.cookie);
    expect(backup.status).toBe(401);
  }, 60000);
});

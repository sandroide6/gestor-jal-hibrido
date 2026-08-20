'use strict';
// PT-11: Integración — rutas de autenticación (/v1/auth)
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');
const authService = require('../services/authService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

// Fuerza el path de "BD no disponible" en authenticate → el middleware confía en el token (offline tolerance)
function mockActiveUser() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

// ── Validación Joi — sin DB ────────────────────────────────
describe('POST /v1/auth/login — validación de entrada', () => {
  it('400 si body vacío', async () => {
    const res = await request(app).post('/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it('400 si email es inválido', async () => {
    const res = await request(app).post('/v1/auth/login').send({ email: 'noesemail', password: 'abc123' });
    expect(res.status).toBe(400);
  });

  it('400 si falta password', async () => {
    const res = await request(app).post('/v1/auth/login').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  it('400 si email supera 254 caracteres', async () => {
    const res = await request(app).post('/v1/auth/login').send({
      email: 'a'.repeat(250) + '@x.co',
      password: 'abc123',
    });
    expect(res.status).toBe(400);
  });
});

// ── Credenciales inválidas — mock de authService.login ────
describe('POST /v1/auth/login — credenciales', () => {
  it('401 con credenciales incorrectas', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(
      Object.assign(new Error('Credenciales incorrectas'), { status: 401 })
    );
    const res = await request(app).post('/v1/auth/login').send({ email: 'x@x.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('423 si cuenta bloqueada', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(
      Object.assign(new Error('Cuenta bloqueada'), { status: 423 })
    );
    const res = await request(app).post('/v1/auth/login').send({ email: 'x@x.com', password: 'pass' });
    expect(res.status).toBe(423);
  });
});

// ── Rutas protegidas — sin token ───────────────────────────
describe('Rutas protegidas — 401 sin token', () => {
  const routes = [
    { method: 'post',  path: '/v1/auth/logout' },
    { method: 'patch', path: '/v1/auth/change-password' },
    { method: 'get',   path: '/v1/users' },
    { method: 'get',   path: '/v1/documents' },
    { method: 'get',   path: '/v1/doc-types' },
    { method: 'get',   path: '/v1/reports' },
    { method: 'get',   path: '/v1/admin' },
  ];

  for (const { method, path } of routes) {
    it(`401 sin token — ${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    });
  }
});

// ── Token inválido ────────────────────────────────────────
describe('Rutas protegidas — 401 con token inválido', () => {
  it('401 con token malformado', async () => {
    const res = await request(app).get('/v1/users').set('Authorization', 'Bearer esto-no-es-un-jwt');
    expect(res.status).toBe(401);
  });

  it('401 con token expirado', async () => {
    const expired = jwt.sign({ sub: 'u1', jal_id: 'j1', role: 'auxiliar' }, JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app).get('/v1/users').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

// ── Autorización por rol ───────────────────────────────────
describe('Control de rol', () => {
  it('403 — auxiliar no puede listar usuarios', async () => {
    mockActiveUser();
    const token = makeToken({ sub: 'u1', jal_id: 'j1', role: 'auxiliar' });
    const res = await request(app).get('/v1/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('403 — auxiliar no puede acceder al admin', async () => {
    mockActiveUser();
    const token = makeToken({ sub: 'u1', jal_id: 'j1', role: 'auxiliar' });
    const res = await request(app).get('/v1/admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('403 — edil no puede gestionar usuarios', async () => {
    mockActiveUser();
    const token = makeToken({ sub: 'u2', jal_id: 'j1', role: 'edil' });
    const res = await request(app).post('/v1/users').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });
});

// ── Validación change-password ─────────────────────────────
describe('PATCH /v1/auth/change-password — validación', () => {
  it('400 si newPassword tiene menos de 8 caracteres', async () => {
    mockActiveUser();
    const token = makeToken({ sub: 'u1', jal_id: 'j1', role: 'auxiliar' });
    const res = await request(app)
      .patch('/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldpass', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('400 si faltan campos', async () => {
    mockActiveUser();
    const token = makeToken({ sub: 'u1', jal_id: 'j1', role: 'auxiliar' });
    const res = await request(app)
      .patch('/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

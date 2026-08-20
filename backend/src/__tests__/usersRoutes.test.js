'use strict';
// PT-18: Integración — rutas de usuarios (/v1/users)
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function adminToken() {
  return makeToken({ sub: 'admin-1', jal_id: 'jal-1', role: 'administrador' });
}

function edilToken() {
  return makeToken({ sub: 'edil-1', jal_id: 'jal-1', role: 'edil' });
}

function auxiliarToken() {
  return makeToken({ sub: 'aux-1', jal_id: 'jal-1', role: 'auxiliar' });
}

// Simula offline-tolerance: findByPk rechaza → authenticate confía en el JWT
function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

// ── Autenticación ─────────────────────────────────────────

describe('GET /v1/users — autenticación', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/users');
    expect(res.status).toBe(401);
  });

  it('401 con token malformado', async () => {
    const res = await request(app)
      .get('/v1/users')
      .set('Authorization', 'Bearer esto-no-es-un-jwt');
    expect(res.status).toBe(401);
  });
});

// ── Autorización ──────────────────────────────────────────

describe('GET /v1/users — autorización por rol', () => {
  it('403 para rol edil', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(403);
  });

  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /v1/users — solo admin puede crear', () => {
  it('403 para rol edil', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${edilToken()}`)
      .send({ name: 'Test', email: 'x@x.com', password: 'Pass1234!', role: 'auxiliar' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /v1/users/:id — solo admin puede modificar', () => {
  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/users/some-uuid')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ name: 'Nuevo nombre' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /v1/users/:id — solo admin puede desactivar', () => {
  it('403 para rol edil', async () => {
    mockOfflineDb();
    const res = await request(app)
      .delete('/v1/users/some-uuid')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(403);
  });
});

// ── Validación de entrada (validate middleware) ───────────

describe('POST /v1/users — validación de body', () => {
  it('400 si body vacío', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 si email no es válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Test', email: 'no-es-email', password: 'Pass1234!', role: 'auxiliar' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('400 si password es demasiado corta', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Test', email: 'ok@ok.com', password: 'corta', role: 'auxiliar' });
    expect(res.status).toBe(400);
  });

  it('400 si rol no es válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Test', email: 'ok@ok.com', password: 'Pass1234!', role: 'director' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /v1/users/:id — validación de body', () => {
  it('400 si body vacío', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/users/some-uuid')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/users — validación de query', () => {
  it('400 si page no es entero positivo', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/users?page=0')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  it('400 si limit supera el máximo', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/users?limit=500')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });
});

// ── Perfil propio ─────────────────────────────────────────

describe('GET /v1/users/me', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('200 con cualquier rol autenticado', async () => {
    vi.spyOn(models.User, 'findByPk')
      .mockResolvedValueOnce({ id: 'aux-1', active: true, tokens_invalid_before: null })
      .mockResolvedValueOnce({
        id: 'aux-1', name: 'Auxiliar', email: 'a@a.com', role: 'auxiliar',
        cargo_titulo: null, signature_path: null, signature_data: null, created_at: new Date(),
      });
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue({ id: 'jal-1', name: 'JAL Test' });

    const res = await request(app)
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('jal');
  });
});

describe('PATCH /v1/users/me — validación', () => {
  it('400 si body vacío', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── Fix: GET /:id/firma solo expone la firma de ediles ────────────────────────
// Antes, cualquier rol autenticado de la JAL podía descargar la firma real de
// CUALQUIER usuario (incluidos otros administradores) — no solo la de ediles, que es
// el único caso de uso legítimo (delegar la firma en la generación de documentos).
// Además, solo auxiliar (quien usa la delegación) y administrador (control total)
// pueden llamar este endpoint — un edil no tiene caso de uso legítimo para ver la
// firma de otro edil.
describe('GET /v1/users/:id/firma — solo expone firmas de ediles', () => {
  const EDIL_ID = '11111111-1111-1111-1111-111111111111';
  const ADMIN_ID = '22222222-2222-2222-2222-222222222222';

  it('401 sin token', async () => {
    const res = await request(app).get(`/v1/users/${EDIL_ID}/firma`);
    expect(res.status).toBe(401);
  });

  it('403 para rol edil (sin caso de uso legítimo sobre la firma de otro edil)', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get(`/v1/users/${EDIL_ID}/firma`)
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(403);
  });

  it('200 con la firma cuando el usuario destino SÍ es edil de la misma JAL', async () => {
    mockOfflineDb();
    vi.spyOn(models.User, 'findOne').mockResolvedValue({ id: EDIL_ID, jal_id: 'jal-1', role: 'edil' });
    vi.spyOn(models.User, 'unscoped').mockReturnValue({
      findByPk: vi.fn().mockResolvedValue({ signature_data: 'data:image/png;base64,abc123' }),
    });

    const res = await request(app)
      .get(`/v1/users/${EDIL_ID}/firma`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data_url).toBe('data:image/png;base64,abc123');
  });

  it('404 cuando el usuario destino existe en la JAL pero NO es edil (ej. otro administrador)', async () => {
    mockOfflineDb();
    vi.spyOn(models.User, 'findOne').mockResolvedValue({ id: ADMIN_ID, jal_id: 'jal-1', role: 'administrador' });
    const sigSpy = vi.fn();
    vi.spyOn(models.User, 'unscoped').mockReturnValue({ findByPk: sigSpy });

    const res = await request(app)
      .get(`/v1/users/${ADMIN_ID}/firma`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(404);
    // Ni siquiera debe consultarse la firma si el rol no es válido
    expect(sigSpy).not.toHaveBeenCalled();
  });

  it('404 cuando el usuario no existe en la JAL del solicitante', async () => {
    mockOfflineDb();
    vi.spyOn(models.User, 'findOne').mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/users/${EDIL_ID}/firma`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(404);
  });
});

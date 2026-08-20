'use strict';
// PT-12: Integración — rutas de tipos de documento (/v1/doc-types)
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function adminToken() {
  return jwt.sign({ sub: 'admin-1', jal_id: 'jal-1', role: 'administrador' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function mockUser() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

describe('GET /v1/doc-types — autenticación', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/doc-types');
    expect(res.status).toBe(401);
  });

  it('403 — auxiliar no puede crear tipo de documento', async () => {
    vi.spyOn(models.User, 'findByPk').mockResolvedValue({ id: 'u1', active: true, tokens_invalid_before: null });
    const token = jwt.sign({ sub: 'u1', jal_id: 'jal-1', role: 'auxiliar' }, JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).post('/v1/doc-types').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });
});

describe('POST /v1/doc-types — validación', () => {
  it('400 si body vacío', async () => {
    mockUser();
    const fd = Buffer.from(JSON.stringify({}));
    const res = await request(app)
      .post('/v1/doc-types')
      .set('Authorization', `Bearer ${adminToken()}`)
      .field('data', JSON.stringify({}));
    expect(res.status).toBe(400);
  });

  it('400 si name es demasiado corto', async () => {
    mockUser();
    const payload = { name: 'A', fields: [{ name: 'campo', label: 'Campo', type: 'text', required: true }] };
    const res = await request(app)
      .post('/v1/doc-types')
      .set('Authorization', `Bearer ${adminToken()}`)
      .field('data', JSON.stringify(payload));
    expect(res.status).toBe(400);
  });

  it('400 si tipo de campo es inválido', async () => {
    mockUser();
    const payload = {
      name: 'Tipo Válido',
      fields: [{ name: 'campo', label: 'Campo', type: 'tipo_inexistente', required: true }],
    };
    const res = await request(app)
      .post('/v1/doc-types')
      .set('Authorization', `Bearer ${adminToken()}`)
      .field('data', JSON.stringify(payload));
    expect(res.status).toBe(400);
  });

  it('400 si campo select no tiene opciones', async () => {
    mockUser();
    const payload = {
      name: 'Tipo Con Select',
      fields: [{ name: 'campo', label: 'Campo', type: 'select', required: true }],
    };
    const res = await request(app)
      .post('/v1/doc-types')
      .set('Authorization', `Bearer ${adminToken()}`)
      .field('data', JSON.stringify(payload));
    expect(res.status).toBe(400);
  });
});

'use strict';
// Tests de rutas de configuración de JAL (/v1/admin/jal-config), incluida la
// lógica de codigo_dependencia agregada en jal.config.codigo_dependencia.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');
const audit   = require('../services/auditService');

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

function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

// Simula una instancia de Sequelize: jal.update(...) muta el propio objeto,
// igual que lo hace una instancia real.
function makeJalInstance(overrides = {}) {
  const jal = {
    id: 'jal-1',
    name: 'JAL Comuna 12',
    logo_url: null,
    features: {},
    config: {},
    ...overrides,
  };
  jal.update = vi.fn(async (updates) => {
    Object.assign(jal, updates);
    return jal;
  });
  return jal;
}

afterEach(() => vi.restoreAllMocks());

describe('GET /v1/admin/jal-config — autenticación y autorización', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/admin/jal-config');
    expect(res.status).toBe(401);
  });

  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('404 si la JAL no existe', async () => {
    mockOfflineDb();
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(null);
    const res = await request(app)
      .get('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(404);
  });

  it('200 y expone codigo_dependencia cuando está guardado en jal.config', async () => {
    mockOfflineDb();
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(
      makeJalInstance({ config: { codigo_dependencia: 'DEP123' } })
    );
    const res = await request(app)
      .get('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.codigo_dependencia).toBe('DEP123');
  });

  it('200 y devuelve codigo_dependencia vacío cuando no está configurado', async () => {
    mockOfflineDb();
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(makeJalInstance({ config: {} }));
    const res = await request(app)
      .get('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.codigo_dependencia).toBe('');
  });

  it('200 y devuelve codigo_dependencia vacío cuando jal.config es null', async () => {
    mockOfflineDb();
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(makeJalInstance({ config: null }));
    const res = await request(app)
      .get('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.codigo_dependencia).toBe('');
  });
});

describe('PATCH /v1/admin/jal-config — solo administrador', () => {
  it('403 para rol edil', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${edilToken()}`)
      .send({ codigo_dependencia: 'DEP1' });
    expect(res.status).toBe(403);
  });

  it('400 si body vacío', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 si codigo_dependencia contiene caracteres no alfanuméricos', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ codigo_dependencia: 'DEP-123!' });
    expect(res.status).toBe(400);
  });

  it('400 si codigo_dependencia supera 20 caracteres', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ codigo_dependencia: 'A'.repeat(21) });
    expect(res.status).toBe(400);
  });

  it('404 si la JAL no existe', async () => {
    mockOfflineDb();
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(null);
    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ codigo_dependencia: 'DEP1' });
    expect(res.status).toBe(404);
  });

  it('200 y persiste codigo_dependencia dentro de jal.config preservando otras claves', async () => {
    mockOfflineDb();
    const jal = makeJalInstance({ config: { otraClave: 'valor-previo' } });
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(jal);
    vi.spyOn(audit, 'log').mockResolvedValue(undefined);

    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ codigo_dependencia: 'DEP999' });

    expect(res.status).toBe(200);
    expect(jal.update).toHaveBeenCalledWith(
      expect.objectContaining({ config: { otraClave: 'valor-previo', codigo_dependencia: 'DEP999' } })
    );
    expect(res.body.codigo_dependencia).toBe('DEP999');
  });

  it('200 y permite limpiar codigo_dependencia enviando cadena vacía', async () => {
    mockOfflineDb();
    const jal = makeJalInstance({ config: { codigo_dependencia: 'DEP-ANTIGUO' } });
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(jal);
    vi.spyOn(audit, 'log').mockResolvedValue(undefined);

    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ codigo_dependencia: '' });

    expect(res.status).toBe(200);
    expect(jal.update).toHaveBeenCalledWith(
      expect.objectContaining({ config: { codigo_dependencia: null } })
    );
    expect(res.body.codigo_dependencia).toBe('');
  });

  it('200 y actualiza name sin tocar codigo_dependencia cuando no se envía', async () => {
    mockOfflineDb();
    const jal = makeJalInstance({ config: { codigo_dependencia: 'DEP-EXISTENTE' } });
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(jal);
    vi.spyOn(audit, 'log').mockResolvedValue(undefined);

    const res = await request(app)
      .patch('/v1/admin/jal-config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'JAL Renombrada' });

    expect(res.status).toBe(200);
    expect(jal.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ config: expect.anything() })
    );
    expect(res.body.codigo_dependencia).toBe('DEP-EXISTENTE');
    expect(res.body.name).toBe('JAL Renombrada');
  });
});

'use strict';
// Tests de rutas de administración (/v1/admin) — stats, backup, export, audit-logs.
// Incluye la demostración explícita del hallazgo de auditoría: GET /audit-logs sin
// user_id no filtra por jal_id en el WHERE principal (fuga multi-tenant).
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { Op }  = require('sequelize');
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

// Offline-tolerance: findByPk rechaza → authenticate confía en el JWT
function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

// ── Autenticación / autorización ───────────────────────────

describe('GET /v1/admin/stats — autenticación y autorización', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/admin/stats');
    expect(res.status).toBe(401);
  });

  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('200 para rol edil', async () => {
    mockOfflineDb();
    vi.spyOn(models.Document, 'count').mockResolvedValue(0);
    vi.spyOn(models.DocType, 'count').mockResolvedValue(0);
    vi.spyOn(models.User, 'count').mockResolvedValue(0);
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalDocuments', 0);
    expect(res.body).toHaveProperty('recentDocuments');
  });

  it('200 para rol administrador con datos', async () => {
    mockOfflineDb();
    vi.spyOn(models.Document, 'count').mockResolvedValue(3);
    vi.spyOn(models.DocType, 'count').mockResolvedValue(2);
    vi.spyOn(models.User, 'count').mockResolvedValue(5);
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([
      { id: 'doc-1', doc_type_name: 'Certificado', beneficiary_name: 'Juan', reviewed: false, sync_status: 'synced', created_at: new Date(), author: { name: 'Ana' } },
    ]);

    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.totalDocuments).toBe(3);
    expect(res.body.recentDocuments[0].author).toBe('Ana');
  });
});

describe('GET /v1/admin/backup — solo administrador', () => {
  it('403 para rol edil', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/admin/backup')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /v1/admin/export — solo administrador', () => {
  it('403 para rol edil', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/admin/export')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(403);
  });

  it('200 genera el zip para administrador', async () => {
    mockOfflineDb();
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([]);
    vi.spyOn(audit, 'log').mockResolvedValue(undefined);

    const res = await request(app)
      .get('/v1/admin/export')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
  });
});

// ── Validación de query en audit-logs ──────────────────────

describe('GET /v1/admin/audit-logs — validación y autorización', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/admin/audit-logs');
    expect(res.status).toBe(401);
  });

  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('400 si limit supera el máximo permitido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/admin/audit-logs?limit=500')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  it('400 si user_id no es un uuid válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/admin/audit-logs?user_id=no-es-un-uuid')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  it('200 y filtra correctamente cuando SÍ se pasa user_id (y ese usuario pertenece a la JAL del solicitante)', async () => {
    mockOfflineDb();
    const userId = '11111111-1111-1111-1111-111111111111';
    vi.spyOn(models.User, 'findAll').mockResolvedValue([{ id: userId }]);
    vi.spyOn(models.AuditLog, 'findAndCountAll').mockResolvedValue({ count: 0, rows: [] });

    const res = await request(app)
      .get(`/v1/admin/audit-logs?user_id=${userId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const [callArgs] = models.AuditLog.findAndCountAll.mock.calls[0];
    expect(callArgs.where.user_id[Op.eq]).toBe(userId);
    // También exige pertenecer al conjunto de usuarios de la JAL del solicitante
    expect(callArgs.where.user_id[Op.in]).toEqual([userId]);
  });

  // ── Fix: adminController.js — aislamiento multi-tenant en audit-logs ──────
  //
  // ANTES: cuando no se pasaba `user_id`, el WHERE principal de
  // AuditLog.findAndCountAll no incluía jal_id — la restricción vivía solo en
  // el include de User con `required:false`, que no filtra filas. Un admin
  // podía ver logs de auditoría de TODAS las JAL. Corregido calculando el
  // conjunto de user_id de la JAL del solicitante y usándolo como filtro
  // principal (con Op.in), tanto si se pasa user_id explícito como si no.
  it('GET /audit-logs sin user_id SÍ restringe el WHERE principal a los usuarios de la JAL del solicitante', async () => {
    mockOfflineDb();
    const jalUserIds = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];
    vi.spyOn(models.User, 'findAll').mockResolvedValue(jalUserIds.map(id => ({ id })));
    vi.spyOn(models.AuditLog, 'findAndCountAll').mockResolvedValue({ count: 0, rows: [] });

    const res = await request(app)
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);

    // User.findAll debe consultarse filtrando por la JAL del token
    expect(models.User.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jal_id: 'jal-1' } }),
    );

    const [callArgs] = models.AuditLog.findAndCountAll.mock.calls[0];
    // El WHERE principal ahora SÍ restringe user_id al conjunto de la JAL.
    expect(callArgs.where.user_id[Op.in]).toEqual(jalUserIds);
  });

  it('GET /audit-logs?user_id=<de-otra-JAL> no devuelve resultados (el id no pertenece al conjunto de la JAL)', async () => {
    mockOfflineDb();
    const ajenoId = '99999999-9999-9999-9999-999999999999'; // no está en la JAL del solicitante
    vi.spyOn(models.User, 'findAll').mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111111' }]);
    const spy = vi.spyOn(models.AuditLog, 'findAndCountAll').mockResolvedValue({ count: 0, rows: [] });

    const res = await request(app)
      .get(`/v1/admin/audit-logs?user_id=${ajenoId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const [callArgs] = spy.mock.calls[0];
    // user_id ajeno + conjunto de la JAL sin ese id → Op.in ∩ Op.eq nunca puede
    // matchear ninguna fila real (AND implícito entre operadores del mismo campo).
    expect(callArgs.where.user_id[Op.eq]).toBe(ajenoId);
    expect(callArgs.where.user_id[Op.in]).not.toContain(ajenoId);
  });
});

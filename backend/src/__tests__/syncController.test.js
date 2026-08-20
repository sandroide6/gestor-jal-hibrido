'use strict';
// Tests de rutas de sincronización (/v1/sync) — batch y status
//
// Nota: syncController.js hace `const { processBatch } = require('../services/syncService')`,
// es decir, desestructura la función en el momento del require. Ni vi.spyOn ni vi.mock sobre
// el módulo syncService afectan esa referencia ya capturada (se comprobó experimentalmente que
// vi.mock no intercepta los require() de este proyecto). Por eso estos tests ejercitan el
// processBatch REAL, pero solo a través de ramas que no requieren tocar la BD real:
//  - operaciones no soportadas (resource distinto de 'documents') — no llegan a ningún modelo,
//  - DocType.findOne (método de una clase compartida, sí se puede espiar con vi.spyOn) devuelto
//    null para forzar la rama de conflicto sin generar documentos reales.
// auditService.log() ya swallowea errores de BD internamente (ver src/services/auditService.js),
// así que el ruido de "[AUDIT] Error al registrar" en stderr es esperado y no falla los tests.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function auxiliarToken() {
  return makeToken({ sub: 'aux-1', jal_id: 'jal-1', role: 'auxiliar' });
}

function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

describe('POST /v1/sync/batch — autenticación y validación', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/v1/sync/batch').send({ operations: [] });
    expect(res.status).toBe(401);
  });

  it('400 si operations está vacío', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/sync/batch')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ operations: [] });
    expect(res.status).toBe(400);
  });

  it('400 si falta el campo operations', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/sync/batch')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 si una operación no trae payload.resource', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/sync/batch')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ operations: [{ operation: 'create', payload: { localId: 'x', data: {} } }] });
    expect(res.status).toBe(400);
  });

  it('400 si operation no es uno de los valores permitidos', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/sync/batch')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ operations: [{ operation: 'archive', payload: { resource: 'documents', localId: 'x' } }] });
    expect(res.status).toBe(400);
  });

  it('200 y marca la operación como error cuando el recurso no está soportado', async () => {
    mockOfflineDb();
    vi.spyOn(models.AuditLog, 'create').mockResolvedValue({});

    const res = await request(app)
      .post('/v1/sync/batch')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({
        operations: [
          { operation: 'update', payload: { resource: 'documents', localId: 'x1', data: {} } },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { localId: 'x1', status: 'error', message: expect.stringContaining('no soportada') },
    ]);
  });

  it('200 y marca la operación como conflicto cuando el tipo de documento no existe', async () => {
    mockOfflineDb();
    vi.spyOn(models.DocType, 'findOne').mockResolvedValue(null);
    vi.spyOn(models.AuditLog, 'create').mockResolvedValue({});

    const res = await request(app)
      .post('/v1/sync/batch')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({
        operations: [
          { operation: 'create', payload: { resource: 'documents', localId: 'x1', data: { doc_type_id: 'dt-1' } } },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { localId: 'x1', status: 'conflict', message: 'Tipo de documento no encontrado o inactivo' },
    ]);
    expect(models.DocType.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dt-1', jal_id: 'jal-1', active: true } })
    );
  });
});

describe('GET /v1/sync/status', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/sync/status');
    expect(res.status).toBe(401);
  });

  it('200 con lastSyncAt null cuando no hay sincronizaciones previas', async () => {
    mockOfflineDb();
    vi.spyOn(models.AuditLog, 'findOne').mockResolvedValue(null);

    const res = await request(app)
      .get('/v1/sync/status')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'aux-1', lastSyncAt: null, lastSyncStats: null });
  });

  it('200 con datos de la última sincronización exitosa', async () => {
    mockOfflineDb();
    const timestamp = new Date('2026-08-15T10:00:00Z');
    vi.spyOn(models.AuditLog, 'findOne').mockResolvedValue({
      timestamp, metadata: { synced: 3, failed: 0 },
    });

    const res = await request(app)
      .get('/v1/sync/status')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.lastSyncStats).toEqual({ synced: 3, failed: 0 });
    expect(models.AuditLog.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'aux-1', action: 'sync.batch', result: 'success' } })
    );
  });
});

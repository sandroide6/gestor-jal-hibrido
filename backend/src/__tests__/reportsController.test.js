'use strict';
// Tests de rutas de reportes (/v1/reports) — estadísticas y exportación a Excel
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

function auxiliarToken() {
  return makeToken({ sub: 'aux-1', jal_id: 'jal-1', role: 'auxiliar' });
}

function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

describe('GET /v1/reports/stats — autenticación y autorización', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/reports/stats');
    expect(res.status).toBe(401);
  });

  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/reports/stats')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('400 si doc_type_id no es un uuid válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/reports/stats?doc_type_id=no-es-un-uuid')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  it('400 si date_to es anterior a date_from', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/reports/stats?date_from=2026-02-01&date_to=2026-01-01')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  it('200 con lista vacía retorna totales en cero', async () => {
    mockOfflineDb();
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/reports/stats')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, reviewed: 0, pending: 0, byType: [], byUser: [], byDay: [] });
  });

  it('200 agrupa correctamente por tipo, usuario y día', async () => {
    mockOfflineDb();
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([
      { doc_type_name: 'Certificado', reviewed: true,  created_at: new Date('2026-01-01T10:00:00Z'), author: { name: 'Ana' } },
      { doc_type_name: 'Certificado', reviewed: false, created_at: new Date('2026-01-01T12:00:00Z'), author: { name: 'Ana' } },
      { doc_type_name: 'Constancia',  reviewed: false, created_at: new Date('2026-01-02T09:00:00Z'), author: { name: 'Beto' } },
    ]);

    const res = await request(app)
      .get('/v1/reports/stats')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.reviewed).toBe(1);
    expect(res.body.pending).toBe(2);
    expect(res.body.byType).toEqual(
      expect.arrayContaining([
        { name: 'Certificado', total: 2, reviewed: 1, pending: 1 },
        { name: 'Constancia', total: 1, reviewed: 0, pending: 1 },
      ])
    );
    expect(res.body.byUser).toEqual(
      expect.arrayContaining([{ name: 'Ana', total: 2 }, { name: 'Beto', total: 1 }])
    );
    expect(res.body.byDay).toEqual([
      { date: '2026-01-01', count: 2 },
      { date: '2026-01-02', count: 1 },
    ]);
  });

  it('200 usa "Desconocido" cuando el documento no tiene autor', async () => {
    mockOfflineDb();
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([
      { doc_type_name: 'Certificado', reviewed: false, created_at: new Date('2026-01-01T10:00:00Z'), author: null },
    ]);

    const res = await request(app)
      .get('/v1/reports/stats')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.byUser).toEqual([{ name: 'Desconocido', total: 1 }]);
  });
});

describe('GET /v1/reports/documents — autenticación, autorización y export', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/reports/documents');
    expect(res.status).toBe(401);
  });

  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/reports/documents')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('400 si reviewed no es booleano', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/reports/documents?reviewed=tal-vez')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  it('200 genera el archivo xlsx y registra auditoría', async () => {
    mockOfflineDb();
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([
      {
        id: 'doc-1', created_at: new Date(), doc_type_name: 'Certificado',
        beneficiary_name: 'Juan', beneficiary_id: '123', sync_status: 'synced',
        reviewed: true, reviewed_at: new Date(),
        author: { name: 'Ana', email: 'ana@test.com' }, reviewer: { name: 'Admin' },
      },
    ]);
    vi.spyOn(audit, 'log').mockResolvedValue(undefined);

    const res = await request(app)
      .get('/v1/reports/documents')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.export_documents' })
    );
  });
});

'use strict';
// Tests de rutas de documentos (/v1/documents) — create, download, list, review, delete.
// Se espía docService/audit/notificationService/usersService (todos requeridos con
// property-access, nunca desestructurados) para no tocar la BD real ni generar
// documentos DOCX/PDF de verdad.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');
const docService = require('../services/documentService');
const audit       = require('../services/auditService');
const notificationService = require('../services/notificationService');
const usersService = require('../services/usersService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function auxiliarToken() {
  return makeToken({ sub: 'aux-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Auxiliar Uno' });
}

function edilToken() {
  return makeToken({ sub: 'edil-1', jal_id: 'jal-1', role: 'edil', name: 'Edil Uno' });
}

function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

const VALID_DOC_TYPE_ID = '11111111-1111-1111-1111-111111111111';
const VALID_DOC_ID      = '22222222-2222-2222-2222-222222222222';

describe('POST /v1/documents — creación', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/v1/documents').send({ doc_type_id: VALID_DOC_TYPE_ID });
    expect(res.status).toBe(401);
  });

  it('400 si doc_type_id no es un uuid válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/documents')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ doc_type_id: 'no-es-un-uuid' });
    expect(res.status).toBe(400);
  });

  it('400 si falta doc_type_id', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/documents')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ beneficiary_name: 'Juan' });
    expect(res.status).toBe(400);
  });

  it('201 y expone document_number y numero_radicado en la respuesta', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'createDocument').mockResolvedValue({
      doc: {
        id: VALID_DOC_ID,
        document_number: '0001-2026',
        numero_radicado: '2026-JAL-SAL-000001',
        created_at: new Date('2026-08-16T00:00:00Z'),
      },
      docType: { name: 'Certificado de Convivencia' },
    });

    const res = await request(app)
      .post('/v1/documents')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ doc_type_id: VALID_DOC_TYPE_ID, beneficiary_name: 'Juan Pérez', beneficiary_id: '123' });

    expect(res.status).toBe(201);
    expect(res.body.document_number).toBe('0001-2026');
    expect(res.body.numero_radicado).toBe('2026-JAL-SAL-000001');
    expect(res.body.doc_type_name).toBe('Certificado de Convivencia');
    expect(res.body.download).toEqual({
      docx: `/documents/${VALID_DOC_ID}/download?format=docx`,
      pdf: `/documents/${VALID_DOC_ID}/download?format=pdf`,
    });
  });

  it('notifica al edil cuando se genera el documento a su nombre (edil_id)', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'createDocument').mockResolvedValue({
      doc: { id: VALID_DOC_ID, document_number: '0001-2026', numero_radicado: null, created_at: new Date() },
      docType: { name: 'Certificado' },
    });
    vi.spyOn(notificationService, 'notify').mockResolvedValue(undefined);
    const edilId = '33333333-3333-3333-3333-333333333333';

    const res = await request(app)
      .post('/v1/documents')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ doc_type_id: VALID_DOC_TYPE_ID, beneficiary_name: 'Juan Pérez', edil_id: edilId });

    expect(res.status).toBe(201);
    expect(notificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: edilId, type: 'document.pending_review' })
    );
  });

  it('propaga el error 404 cuando el tipo de documento no existe', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'createDocument').mockRejectedValue(
      Object.assign(new Error('Tipo de documento no encontrado o inactivo'), { status: 404 })
    );

    const res = await request(app)
      .post('/v1/documents')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .send({ doc_type_id: VALID_DOC_TYPE_ID });

    expect(res.status).toBe(404);
  });
});

describe('GET /v1/documents/:id/download', () => {
  it('401 sin token', async () => {
    const res = await request(app).get(`/v1/documents/${VALID_DOC_ID}/download`);
    expect(res.status).toBe(401);
  });

  it('400 si el id no es un uuid válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/documents/no-es-un-uuid/download')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(400);
  });

  it('404 si el documento no existe en la JAL', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentInJal').mockResolvedValue(null);
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}/download`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(404);
  });

  it('404 si el archivo solicitado no está disponible', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentInJal').mockResolvedValue({
      id: VALID_DOC_ID, user_id: 'aux-1', file_path_docx: null, file_path_pdf: null,
    });
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}/download?format=pdf`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(404);
  });

  it('403 si la ruta del archivo intenta salir del directorio de almacenamiento (path traversal)', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentInJal').mockResolvedValue({
      id: VALID_DOC_ID, user_id: 'aux-1', file_path_pdf: '/etc/passwd', file_path_docx: null,
    });
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}/download?format=pdf`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  // ── Fix: IDOR en descarga — solo el autor o edil/administrador de la JAL ──────
  // Antes, findDocumentInJal solo filtraba por jal_id: cualquier usuario autenticado
  // de la JAL (incluido un auxiliar) podía descargar el DOCX/PDF de un documento
  // generado por OTRO usuario con solo conocer o adivinar el UUID.

  it('404 si un auxiliar intenta descargar el documento de OTRO usuario (IDOR)', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentInJal').mockResolvedValue({
      id: VALID_DOC_ID, user_id: 'otro-usuario', file_path_pdf: '/data/output/x.pdf', file_path_docx: null,
    });
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}/download?format=pdf`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(404);
  });

  it('permite a edil descargar el documento de OTRO usuario de la misma JAL (rol de revisión)', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentInJal').mockResolvedValue({
      id: VALID_DOC_ID, user_id: 'otro-usuario', file_path_docx: null, file_path_pdf: null,
    });
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}/download?format=pdf`)
      .set('Authorization', `Bearer ${edilToken()}`);
    // No 404 "Documento no encontrado" por falta de acceso — llega hasta la
    // validación de archivo disponible (también 404, pero por otra razón).
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('no disponible');
  });
});

describe('GET /v1/documents/my — lista propia', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/documents/my');
    expect(res.status).toBe(401);
  });

  it('400 si limit supera el máximo permitido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/documents/my?limit=500')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(400);
  });

  it('200 y delega en listOwnDocuments con jal_id/user_id del token', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'listOwnDocuments').mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, pages: 0 });

    const res = await request(app)
      .get('/v1/documents/my')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(docService.listOwnDocuments).toHaveBeenCalledWith('jal-1', 'aux-1', expect.objectContaining({ page: 1, limit: 20 }));
  });
});

describe('GET /v1/documents — panel edil/admin', () => {
  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/documents')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('200 para rol edil', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'listDocumentsForEdil').mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, pages: 0 });
    const res = await request(app)
      .get('/v1/documents')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /v1/documents/:id — detalle', () => {
  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('404 si el documento no existe', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentWithAuthor').mockResolvedValue(null);
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}`)
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(404);
  });

  it('200 y retorna el documento', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentWithAuthor').mockResolvedValue({ id: VALID_DOC_ID, doc_type_name: 'Certificado' });
    const res = await request(app)
      .get(`/v1/documents/${VALID_DOC_ID}`)
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(VALID_DOC_ID);
  });
});

describe('PATCH /v1/documents/:id/review — marcar revisado', () => {
  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch(`/v1/documents/${VALID_DOC_ID}/review`)
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('404 si el documento no existe en la JAL', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'findDocumentInJal').mockResolvedValue(null);
    const res = await request(app)
      .patch(`/v1/documents/${VALID_DOC_ID}/review`)
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(404);
  });

  it('200 marca revisado, registra auditoría y notifica al autor y a los admins', async () => {
    mockOfflineDb();
    const doc = {
      id: VALID_DOC_ID, user_id: 'aux-1', doc_type_name: 'Certificado',
      beneficiary_name: 'Juan', beneficiary_id: '123', reviewed_at: new Date(),
    };
    vi.spyOn(docService, 'findDocumentInJal').mockResolvedValue(doc);
    vi.spyOn(docService, 'markDocumentReviewed').mockResolvedValue(undefined);
    vi.spyOn(audit, 'log').mockResolvedValue(undefined);
    vi.spyOn(notificationService, 'notify').mockResolvedValue(undefined);
    vi.spyOn(usersService, 'listAdmins').mockResolvedValue([{ id: 'admin-1' }, { id: 'aux-1' }]);

    const res = await request(app)
      .patch(`/v1/documents/${VALID_DOC_ID}/review`)
      .set('Authorization', `Bearer ${edilToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: VALID_DOC_ID, reviewed: true });
    expect(docService.markDocumentReviewed).toHaveBeenCalledWith(doc, 'edil-1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.review' }));
    // Se notifica al autor y a los admins salvo que el admin sea el propio autor (se filtra 'aux-1').
    expect(notificationService.notify).toHaveBeenCalledTimes(2);
    expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'aux-1' }));
    expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1' }));
  });
});

describe('GET /v1/documents/pending-review-count', () => {
  it('403 para rol auxiliar', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/documents/pending-review-count')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(403);
  });

  it('200 con el conteo de pendientes', async () => {
    mockOfflineDb();
    vi.spyOn(docService, 'countPendingReview').mockResolvedValue(4);
    const res = await request(app)
      .get('/v1/documents/pending-review-count')
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(4);
  });
});

describe('DELETE /v1/documents/:id', () => {
  it('403 para rol edil (solo administrador)', async () => {
    mockOfflineDb();
    const res = await request(app)
      .delete(`/v1/documents/${VALID_DOC_ID}`)
      .set('Authorization', `Bearer ${edilToken()}`);
    expect(res.status).toBe(403);
  });

  it('400 si el id no es un uuid válido', async () => {
    mockOfflineDb();
    const adminToken = makeToken({ sub: 'admin-1', jal_id: 'jal-1', role: 'administrador' });
    const res = await request(app)
      .delete('/v1/documents/no-es-un-uuid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('200 y elimina el documento para administrador', async () => {
    mockOfflineDb();
    const adminToken = makeToken({ sub: 'admin-1', jal_id: 'jal-1', role: 'administrador' });
    vi.spyOn(docService, 'deleteDocument').mockResolvedValue({ id: VALID_DOC_ID });

    const res = await request(app)
      .delete(`/v1/documents/${VALID_DOC_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: VALID_DOC_ID, deleted: true });
  });
});

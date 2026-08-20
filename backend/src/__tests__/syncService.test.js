'use strict';
// Fix: syncService.processDocumentCreate — edil_id venía del payload sincronizado por
// el cliente sin validar que el edil perteneciera a la JAL del usuario (mismo IDOR que
// en documentService.createDocument). Este archivo prueba solo esa validación —
// processDocumentCreate en su conjunto queda fuera del alcance de esta sesión (ya
// estaba excluido del umbral de cobertura en vitest.config.js).

process.env.NODE_ENV = 'test';

const models = require('../models');
const documentGeneratorService = require('../services/documentGeneratorService');
const radicadoService = require('../services/radicadoService');
const documentNumberService = require('../services/documentNumberService');
const audit = require('../services/auditService');
const notify = require('../services/notificationService');
const { processDocumentCreate } = require('../services/syncService');

const BASE_DATA = {
  doc_type_id: 'dt-1',
  beneficiary_name: 'Juan Pérez',
  beneficiary_id: '123',
  fecha: '2026-01-01',
};

const MOCK_DOC_TYPE = { id: 'dt-1', name: 'Constancia', fields: [], template_path: null, template_data: null, tipo_tramite: 'salida' };
const MOCK_JAL = { id: 'jal-1', name: 'JAL Test', config: {} };

beforeEach(() => {
  vi.spyOn(models.DocType, 'findOne').mockResolvedValue(MOCK_DOC_TYPE);
  vi.spyOn(models.Jal, 'findByPk').mockResolvedValue(MOCK_JAL);
  vi.spyOn(models.User, 'findOne');
  vi.spyOn(models.Document, 'create').mockResolvedValue({ id: 'doc-1' });
  vi.spyOn(models.Document.sequelize, 'transaction').mockImplementation(async (cb) => cb({}));
  vi.spyOn(radicadoService, 'assignNumeroRadicado').mockResolvedValue('2026-JAL-SAL-000001');
  vi.spyOn(documentNumberService, 'assignDocumentNumber').mockResolvedValue('0001-2026');
  vi.spyOn(documentGeneratorService, 'generateDocuments').mockResolvedValue({ docxPath: '/tmp/a.docx', pdfPath: '/tmp/a.pdf' });
  vi.spyOn(audit, 'log').mockResolvedValue(undefined);
  vi.spyOn(notify, 'notify').mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('processDocumentCreate() — validación de edil_id (IDOR)', () => {
  it('procesa sin problema cuando no se envía edil_id', async () => {
    models.User.findOne.mockResolvedValue(null); // no debería ni consultarse
    const result = await processDocumentCreate({
      localId: 'local-1', data: BASE_DATA, userId: 'user-1', jalId: 'jal-1', ip: '127.0.0.1',
    });
    expect(result.status).toBe('success');
    expect(models.User.findOne).not.toHaveBeenCalled();
  });

  it('rechaza cuando edil_id no pertenece a la JAL del usuario (IDOR)', async () => {
    models.User.findOne.mockResolvedValue(null); // ninguna fila cumple id+jal_id+role

    await expect(processDocumentCreate({
      localId: 'local-1',
      data: { ...BASE_DATA, edil_id: 'edil-de-otra-jal' },
      userId: 'user-1', jalId: 'jal-1', ip: '127.0.0.1',
    })).rejects.toMatchObject({ code: 'INVALID_EDIL' });

    // La búsqueda debe exigir jal_id + role:'edil', no solo el id
    expect(models.User.findOne).toHaveBeenCalledWith({
      where: { id: 'edil-de-otra-jal', jal_id: 'jal-1', role: 'edil', active: true },
    });
    expect(models.Document.create).not.toHaveBeenCalled();
  });

  it('acepta y persiste edil_id cuando el edil sí pertenece a la JAL', async () => {
    models.User.findOne.mockResolvedValue({ id: 'edil-1', jal_id: 'jal-1', role: 'edil', active: true });

    const result = await processDocumentCreate({
      localId: 'local-1',
      data: { ...BASE_DATA, edil_id: 'edil-1' },
      userId: 'user-1', jalId: 'jal-1', ip: '127.0.0.1',
    });

    expect(result.status).toBe('success');
    const [createArgs] = models.Document.create.mock.calls[0];
    expect(createArgs.edil_id).toBe('edil-1');
  });
});

// Fix: esta ruta nunca asignaba document_number (a diferencia de
// documentService.createDocument) — los documentos sincronizados offline quedaban
// con ese campo en NULL para siempre.
describe('processDocumentCreate() — asigna document_number (antes quedaba NULL)', () => {
  it('asigna document_number al crear el Document, igual que la ruta online', async () => {
    documentNumberService.assignDocumentNumber.mockResolvedValue('0007-2026');

    await processDocumentCreate({
      localId: 'local-1', data: BASE_DATA, userId: 'user-1', jalId: 'jal-1', ip: '127.0.0.1',
    });

    expect(documentNumberService.assignDocumentNumber).toHaveBeenCalledWith(
      expect.objectContaining({ jalId: 'jal-1' }),
    );
    const [createArgs] = models.Document.create.mock.calls[0];
    expect(createArgs.document_number).toBe('0007-2026');
  });
});

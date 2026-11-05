'use strict';
// syncService delega la creación en documentService.createDocument (auditoría
// 2026-11-05, P0-2). Estas pruebas unitarias comprueban el contrato de esa delegación;
// el comportamiento de extremo a extremo con base real está en
// tests/integration/sync.integration.test.js. La validación de edil_id (IDOR) vive
// ahora en documentService y la cubre documentService.test.js.
process.env.NODE_ENV = 'test';

const documentService = require('../services/documentService');
const audit = require('../services/auditService');
const notify = require('../services/notificationService');
const { processDocumentCreate, processBatch } = require('../services/syncService');

const DATA = {
  doc_type_id: 'dt-1', beneficiary_name: 'Juan Pérez', beneficiary_id: '123', fecha: '2026-01-01',
};
const DOC = { id: 'doc-1', numero_radicado: '2026-JAL-SAL-000001', document_number: '0001-2026' };

beforeEach(() => {
  vi.spyOn(audit, 'log').mockResolvedValue(undefined);
  vi.spyOn(notify, 'notify').mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('processDocumentCreate()', () => {
  it('delega en createDocument con el localId como client_local_id y el rol del usuario', async () => {
    const spy = vi.spyOn(documentService, 'createDocument')
      .mockResolvedValue({ doc: DOC, docType: { name: 'Constancia' }, duplicate: false });

    const r = await processDocumentCreate({ localId: 'local-1', data: DATA, userId: 'u1', jalId: 'j1', role: 'auxiliar', ip: '1.1.1.1' });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      jalId: 'j1', userId: 'u1', role: 'auxiliar', docTypeId: 'dt-1',
      beneficiaryName: 'Juan Pérez', beneficiaryId: '123', clientLocalId: 'local-1',
      formFields: { fecha: '2026-01-01' }, edilId: null,
    }));
    expect(r).toMatchObject({ status: 'success', serverId: 'doc-1', numero_radicado: DOC.numero_radicado, duplicate: false });
    expect(notify.notify).toHaveBeenCalledTimes(1);
  });

  it('un reenvío (duplicate) no vuelve a notificar ni a auditar la creación', async () => {
    vi.spyOn(documentService, 'createDocument')
      .mockResolvedValue({ doc: DOC, docType: { name: 'Constancia' }, duplicate: true });

    const r = await processDocumentCreate({ localId: 'local-1', data: { ...DATA, edil_id: 'e1' }, userId: 'u1', jalId: 'j1', role: 'auxiliar' });

    expect(r).toMatchObject({ status: 'success', serverId: 'doc-1', duplicate: true });
    expect(notify.notify).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('notifica al edil cuando el documento se generó a su nombre', async () => {
    vi.spyOn(documentService, 'createDocument')
      .mockResolvedValue({ doc: DOC, docType: { name: 'Constancia' }, duplicate: false });
    await processDocumentCreate({ localId: 'l', data: { ...DATA, edil_id: 'e1' }, userId: 'u1', jalId: 'j1', role: 'auxiliar' });
    expect(notify.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'e1', type: 'document.pending_review' }));
  });

  it('ignora un client_local_id dentro de data: manda el localId de la operación', async () => {
    const spy = vi.spyOn(documentService, 'createDocument')
      .mockResolvedValue({ doc: DOC, docType: { name: 'X' }, duplicate: false });
    await processDocumentCreate({ localId: 'bueno', data: { ...DATA, client_local_id: 'otro' }, userId: 'u1', jalId: 'j1', role: 'auxiliar' });
    expect(spy.mock.calls[0][0].clientLocalId).toBe('bueno');
    expect(spy.mock.calls[0][0].formFields).not.toHaveProperty('client_local_id');
  });
});

describe('processBatch()', () => {
  it('marca conflicto si el tipo no existe y error en otros fallos, sin cortar el lote', async () => {
    vi.spyOn(documentService, 'createDocument')
      .mockRejectedValueOnce(Object.assign(new Error('Tipo de documento no encontrado o inactivo'), { code: 'DOC_TYPE_NOT_FOUND' }))
      .mockRejectedValueOnce(Object.assign(new Error('Campos requeridos faltantes: X'), { status: 400 }))
      .mockResolvedValueOnce({ doc: DOC, docType: { name: 'X' }, duplicate: false });

    const op = (id) => ({ operation: 'create', payload: { resource: 'documents', localId: id, data: DATA } });
    const results = await processBatch({ operations: [op('a'), op('b'), op('c')], userId: 'u1', jalId: 'j1', role: 'auxiliar' });

    expect(results.map((r) => r.status)).toEqual(['conflict', 'error', 'success']);
  });
});

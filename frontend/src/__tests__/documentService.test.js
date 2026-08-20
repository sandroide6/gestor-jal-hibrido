// Tests de documentService — flujo offline/online de generateDocument()
vi.mock('../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), blob: vi.fn(), download: vi.fn(), delete: vi.fn() },
}));

vi.mock('../db/index', () => ({
  saveDocument: vi.fn(),
  addToSyncQueue: vi.fn(),
  getPendingSyncCount: vi.fn(),
  getDB: vi.fn(),
  cacheTemplate: vi.fn(),
  getCachedTemplate: vi.fn(),
  cacheUserData: vi.fn(),
  getCachedUserData: vi.fn(),
}));

vi.mock('../stores/syncStore', () => ({
  useSyncStore: { getState: vi.fn() },
}));

vi.mock('../services/clientDocumentGenerator', () => ({
  generateDocxBlob: vi.fn(),
  generatePdfBlob: vi.fn(),
  generateDocxBlobFromTemplate: vi.fn(),
}));

import { api } from '../services/api';
import {
  saveDocument, addToSyncQueue, getPendingSyncCount, getDB,
  getCachedTemplate, getCachedUserData,
} from '../db/index';
import { useSyncStore } from '../stores/syncStore';
import { generateDocxBlob, generatePdfBlob, generateDocxBlobFromTemplate } from '../services/clientDocumentGenerator';
import { generateDocument, fetchDocTypes } from '../services/documentService';

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { writable: true, configurable: true, value });
}

const docType = { id: 'dt1', name: 'Constancia', fields: [] };
const baseArgs = {
  docType,
  formData: { motivo: 'x' },
  beneficiaryName: 'Juan Pérez',
  beneficiaryId: '123',
  token: 'tok',
};

let setOnlineMock;
let setPendingCountMock;

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
  setOnlineMock = vi.fn();
  setPendingCountMock = vi.fn();
  useSyncStore.getState.mockReturnValue({
    setOnline: setOnlineMock,
    setPendingCount: setPendingCountMock,
  });
  getPendingSyncCount.mockResolvedValue(1);
  getCachedTemplate.mockResolvedValue(null);
  getCachedUserData.mockImplementation((key) => {
    if (key === 'signature') return Promise.resolve({ data: new ArrayBuffer(4), mime: 'image/png' });
    if (key === 'profile') return Promise.resolve({ name: 'Admin', cargo: 'Presidente' });
    return Promise.resolve(null);
  });
  generateDocxBlob.mockResolvedValue(new Blob(['docx']));
  generatePdfBlob.mockResolvedValue(new Blob(['pdf']));
  generateDocxBlobFromTemplate.mockResolvedValue(new Blob(['docx-tpl']));
});

afterEach(() => {
  setOnline(true);
});

describe('generateDocument — modo online', () => {
  it('genera el documento vía API y lo guarda como sincronizado', async () => {
    api.post.mockResolvedValue({ id: 'srv1', created_at: '2026-01-01', download: { docx: '/d' } });

    const result = await generateDocument(baseArgs);

    expect(api.post).toHaveBeenCalledWith('/documents', expect.objectContaining({
      doc_type_id: 'dt1',
      beneficiary_name: 'Juan Pérez',
      beneficiary_id: '123',
      motivo: 'x',
    }), { token: 'tok' });

    expect(saveDocument).toHaveBeenCalledWith(expect.objectContaining({
      id: 'srv1',
      syncStatus: 'synced',
    }));
    expect(addToSyncQueue).not.toHaveBeenCalled();
    expect(result.offline).toBe(false);
  });

  it('propaga el error si el servidor responde con error (no cae a modo offline)', async () => {
    const serverError = Object.assign(new Error('Datos inválidos'), { status: 400 });
    api.post.mockRejectedValue(serverError);

    await expect(generateDocument(baseArgs)).rejects.toThrow('Datos inválidos');

    expect(addToSyncQueue).not.toHaveBeenCalled();
    expect(setOnlineMock).not.toHaveBeenCalled();
  });

  it('cae a modo offline automáticamente cuando la llamada online falla por error de red', async () => {
    const networkError = new Error('Failed to fetch'); // sin .status → error de red
    api.post.mockRejectedValue(networkError);

    const result = await generateDocument(baseArgs);

    expect(setOnlineMock).toHaveBeenCalledWith(false);
    expect(addToSyncQueue).toHaveBeenCalledWith('create', expect.objectContaining({
      resource: 'documents',
      data: expect.objectContaining({ doc_type_id: 'dt1' }),
    }));
    expect(result.offline).toBe(true);
  });
});

describe('generateDocument — modo offline (navigator.onLine = false)', () => {
  it('va directo a la rama offline sin llamar a la API', async () => {
    setOnline(false);

    const result = await generateDocument(baseArgs);

    expect(api.post).not.toHaveBeenCalled();
    expect(saveDocument).toHaveBeenCalledWith(expect.objectContaining({ syncStatus: 'pending' }));
    expect(addToSyncQueue).toHaveBeenCalledTimes(1);
    expect(result.offline).toBe(true);
  });

  it('agrega el documento a la cola de sincronización con el payload correcto', async () => {
    setOnline(false);

    await generateDocument(baseArgs);

    const [operation, item] = addToSyncQueue.mock.calls[0];
    expect(operation).toBe('create');
    expect(item.resource).toBe('documents');
    expect(item.data).toEqual(expect.objectContaining({
      doc_type_id: 'dt1',
      beneficiary_name: 'Juan Pérez',
    }));
    expect(item.localId).toBeTruthy();
  });

  it('actualiza el contador de pendientes tras encolar', async () => {
    setOnline(false);
    getPendingSyncCount.mockResolvedValue(3);

    await generateDocument(baseArgs);

    expect(setPendingCountMock).toHaveBeenCalledWith(3);
  });

  it('lanza error si no hay firma cacheada para generar el documento localmente', async () => {
    setOnline(false);
    getCachedUserData.mockImplementation((key) => (key === 'profile' ? Promise.resolve({ name: 'A', cargo: 'B' }) : Promise.resolve(null)));

    await expect(generateDocument(baseArgs)).rejects.toThrow(/no tiene firma registrada/);
  });

  it('genera los blobs offline usando la plantilla cacheada cuando existe', async () => {
    setOnline(false);
    getCachedTemplate.mockResolvedValue({ data: new ArrayBuffer(8) });

    const result = await generateDocument(baseArgs);

    expect(generateDocxBlobFromTemplate).toHaveBeenCalled();
    expect(generateDocxBlob).not.toHaveBeenCalled();
    expect(result.offlineBlobs).toEqual({ docx: expect.any(Blob), pdf: expect.any(Blob) });
  });

  it('si falla la generación de docx, intenta generar solo el PDF', async () => {
    setOnline(false);
    generateDocxBlob.mockRejectedValue(new Error('Error docx'));

    const result = await generateDocument(baseArgs);

    expect(result.offlineBlobs).toEqual({ pdf: expect.any(Blob) });
    expect(result.offlineBlobError).toBeNull();
  });

  it('reporta offlineBlobError si tampoco puede generar el PDF', async () => {
    setOnline(false);
    generateDocxBlob.mockRejectedValue(new Error('Error docx'));
    generatePdfBlob.mockRejectedValue(new Error('Error pdf'));

    const result = await generateDocument(baseArgs);

    expect(result.offlineBlobs).toBeNull();
    expect(result.offlineBlobError).toBe('Error pdf');
  });
});

describe('fetchDocTypes', () => {
  it('devuelve los tipos desde la API y actualiza la caché local', async () => {
    const types = [{ id: 't1', name: 'Acta', has_template: false }];
    api.get.mockResolvedValue(types);
    const storeMock = { put: vi.fn() };
    const txMock = { store: storeMock, done: Promise.resolve() };
    getDB.mockResolvedValue({ transaction: vi.fn(() => txMock) });

    const result = await fetchDocTypes('tok');

    expect(result).toEqual(types);
  });

  it('cae a IndexedDB si la petición falla por error de red', async () => {
    api.get.mockRejectedValue(new Error('Failed to fetch'));
    const cachedTypes = [{ id: 't1', name: 'Acta' }];
    getDB.mockResolvedValue({ getAll: vi.fn().mockResolvedValue(cachedTypes) });

    const result = await fetchDocTypes('tok');

    expect(result).toEqual(cachedTypes);
  });

  it('propaga errores que no son de red (ej. 403)', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Prohibido'), { status: 403 }));
    await expect(fetchDocTypes('tok')).rejects.toThrow('Prohibido');
  });
});

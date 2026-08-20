'use strict';
// documentNumberService — extraído de documentService.createDocument para reusarlo
// también en syncService.processDocumentCreate (ver documentService.test.js y
// syncService.test.js para las pruebas de integración de ese fix).

process.env.NODE_ENV = 'test';

const models = require('../models');
const { assignDocumentNumber } = require('../services/documentNumberService');

const FAKE_TRANSACTION = { id: 'fake-tx' };

beforeEach(() => {
  vi.spyOn(models.Document.sequelize, 'query');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('assignDocumentNumber()', () => {
  it('arma el número con formato NNNN-AÑO, rellenado a 4 dígitos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    models.Document.sequelize.query
      .mockResolvedValueOnce(undefined) // advisory lock
      .mockResolvedValueOnce([{ next_n: 7 }]); // MAX+1

    const result = await assignDocumentNumber({ jalId: 'jal-1', transaction: FAKE_TRANSACTION });
    expect(result).toBe('0007-2026');
  });

  it('no trunca si el consecutivo supera 4 dígitos', async () => {
    models.Document.sequelize.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ next_n: 12345 }]);

    const result = await assignDocumentNumber({ jalId: 'jal-1', transaction: FAKE_TRANSACTION });
    expect(result).toMatch(/^12345-\d{4}$/);
  });

  it('toma el advisory lock antes de leer el MAX (evita condición de carrera)', async () => {
    models.Document.sequelize.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ next_n: 1 }]);

    await assignDocumentNumber({ jalId: 'jal-1', transaction: FAKE_TRANSACTION });

    const [firstSql] = models.Document.sequelize.query.mock.calls[0];
    expect(firstSql).toMatch(/pg_advisory_xact_lock/i);
  });

  it('ejecuta ambas queries dentro de la misma transacción recibida', async () => {
    models.Document.sequelize.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ next_n: 1 }]);

    await assignDocumentNumber({ jalId: 'jal-1', transaction: FAKE_TRANSACTION });

    for (const call of models.Document.sequelize.query.mock.calls) {
      const [, options] = call;
      expect(options.transaction).toBe(FAKE_TRANSACTION);
    }
  });

  it('la key del advisory lock está particionada por jal_id + año', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    models.Document.sequelize.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ next_n: 1 }]);

    await assignDocumentNumber({ jalId: 'jal-77', transaction: FAKE_TRANSACTION });

    const [, lockOptions] = models.Document.sequelize.query.mock.calls[0];
    expect(lockOptions.replacements.key).toBe('doc_num_jal-77_2026');
  });

  it('el patrón de búsqueda del MAX se limita al año actual', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    models.Document.sequelize.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ next_n: 1 }]);

    await assignDocumentNumber({ jalId: 'jal-1', transaction: FAKE_TRANSACTION });

    const [, maxOptions] = models.Document.sequelize.query.mock.calls[1];
    expect(maxOptions.replacements).toEqual({ jalId: 'jal-1', pattern: '%-2026' });
  });
});

'use strict';
// PT-21: auditService — fire-and-forget, error silencing

process.env.NODE_ENV = 'test';

const models = require('../models');
const auditService = require('../services/auditService');
const logger = require('../config/logger');

beforeEach(() => {
  vi.spyOn(models.AuditLog, 'create');
});
afterEach(() => vi.restoreAllMocks());

describe('auditService.log()', () => {

  it('crea un AuditLog con los campos exactos', async () => {
    models.AuditLog.create.mockResolvedValue({});
    await auditService.log({
      userId:   'u-1',
      action:   'auth.login',
      resource: 'users/u-1',
      result:   'success',
      ip:       '192.168.1.10',
      metadata: { agent: 'test' },
    });
    expect(models.AuditLog.create).toHaveBeenCalledWith({
      user_id:  'u-1',
      action:   'auth.login',
      resource: 'users/u-1',
      result:   'success',
      ip:       '192.168.1.10',
      metadata: { agent: 'test' },
    });
  });

  it('usa null/vacío para campos opcionales omitidos', async () => {
    models.AuditLog.create.mockResolvedValue({});
    await auditService.log({ action: 'backup', result: 'success' });
    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, resource: null, ip: null, metadata: {} }),
    );
  });

  it('resuelve sin lanzar cuando AuditLog.create falla', async () => {
    models.AuditLog.create.mockRejectedValue(new Error('DB down'));
    await expect(
      auditService.log({ action: 'auth.login', result: 'failure' }),
    ).resolves.toBeUndefined();
  });

  it('registra el fallo con logger.error (estructurado) cuando create falla', async () => {
    const spy = vi.spyOn(logger, 'error');
    models.AuditLog.create.mockRejectedValue(new Error('crash'));
    await auditService.log({ action: 'x', result: 'y' });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('auditService.log'),
      expect.objectContaining({ action: 'x', result: 'y', error: 'crash' }),
    );
  });

});

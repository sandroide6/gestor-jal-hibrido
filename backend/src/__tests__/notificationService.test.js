'use strict';
// PT-21: notificationService — fire-and-forget, error silencing

process.env.NODE_ENV = 'test';

const models = require('../models');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

beforeEach(() => {
  vi.spyOn(models.Notification, 'create');
});
afterEach(() => vi.restoreAllMocks());

describe('notificationService.notify()', () => {

  it('crea una Notification con los campos correctos', async () => {
    models.Notification.create.mockResolvedValue({});
    await notificationService.notify({
      userId:   'u-1',
      type:     'document.ready',
      message:  'Tu documento está listo',
      metadata: { docId: 'd-1' },
    });
    const [args] = models.Notification.create.mock.calls[0];
    expect(args).toMatchObject({
      user_id:  'u-1',
      type:     'document.ready',
      message:  'Tu documento está listo',
      metadata: { docId: 'd-1' },
    });
  });

  it('genera un UUID en el campo id', async () => {
    models.Notification.create.mockResolvedValue({});
    await notificationService.notify({ userId: 'u-1', type: 'info', message: 'Hola' });
    const [args] = models.Notification.create.mock.calls[0];
    expect(args.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('usa metadata vacío cuando no se provee', async () => {
    models.Notification.create.mockResolvedValue({});
    await notificationService.notify({ userId: 'u-2', type: 'info', message: 'ok' });
    expect(models.Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} }),
    );
  });

  it('resuelve sin lanzar cuando Notification.create falla', async () => {
    models.Notification.create.mockRejectedValue(new Error('DB error'));
    await expect(
      notificationService.notify({ userId: 'u-1', type: 'x', message: 'y' }),
    ).resolves.toBeUndefined();
  });

  it('registra el fallo con logger.error (estructurado) cuando create falla', async () => {
    const spy = vi.spyOn(logger, 'error');
    models.Notification.create.mockRejectedValue(new Error('crash'));
    await notificationService.notify({ userId: 'u-1', type: 'x', message: 'y' });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('notificationService.notify'),
      expect.objectContaining({ userId: 'u-1', type: 'x', error: 'crash' }),
    );
  });

});

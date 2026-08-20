'use strict';
// Tests de rutas de notificaciones (/v1/notifications)
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

describe('GET /v1/notifications — autenticación', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('200 y calcula unread contando notificaciones con read=false', async () => {
    mockOfflineDb();
    vi.spyOn(models.Notification, 'findAll').mockResolvedValue([
      { id: 'n1', read: false },
      { id: 'n2', read: true },
      { id: 'n3', read: false },
    ]);

    const res = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(3);
    expect(res.body.unread).toBe(2);
  });

  it('200 con lista vacía y unread 0', async () => {
    mockOfflineDb();
    vi.spyOn(models.Notification, 'findAll').mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.unread).toBe(0);
  });
});

describe('GET /v1/notifications/unread-count', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('200 con el conteo de no leídas', async () => {
    mockOfflineDb();
    vi.spyOn(models.Notification, 'count').mockResolvedValue(7);

    const res = await request(app)
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(7);
    expect(models.Notification.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'aux-1', read: false } })
    );
  });
});

describe('PATCH /v1/notifications/read-all', () => {
  it('401 sin token', async () => {
    const res = await request(app).patch('/v1/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('200 y marca todas como leídas para el usuario autenticado', async () => {
    mockOfflineDb();
    vi.spyOn(models.Notification, 'update').mockResolvedValue([2]);

    const res = await request(app)
      .patch('/v1/notifications/read-all')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(models.Notification.update).toHaveBeenCalledWith(
      { read: true },
      { where: { user_id: 'aux-1', read: false } }
    );
  });
});

describe('PATCH /v1/notifications/:id/read', () => {
  it('400 si el id no es un uuid válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .patch('/v1/notifications/no-es-un-uuid/read')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(400);
  });

  it('404 si la notificación no existe o no pertenece al usuario', async () => {
    mockOfflineDb();
    vi.spyOn(models.Notification, 'findOne').mockResolvedValue(null);
    const res = await request(app)
      .patch('/v1/notifications/11111111-1111-1111-1111-111111111111/read')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(404);
  });

  it('200 y marca la notificación como leída', async () => {
    mockOfflineDb();
    const update = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(models.Notification, 'findOne').mockResolvedValue({ id: 'n1', update });

    const res = await request(app)
      .patch('/v1/notifications/11111111-1111-1111-1111-111111111111/read')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'n1', read: true });
    expect(update).toHaveBeenCalledWith({ read: true });
  });
});

describe('DELETE /v1/notifications/:id', () => {
  it('400 si el id no es un uuid válido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .delete('/v1/notifications/no-es-un-uuid')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(400);
  });

  it('404 si la notificación no existe o no pertenece al usuario', async () => {
    mockOfflineDb();
    vi.spyOn(models.Notification, 'destroy').mockResolvedValue(0);
    const res = await request(app)
      .delete('/v1/notifications/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(404);
  });

  it('200 y elimina la notificación', async () => {
    mockOfflineDb();
    vi.spyOn(models.Notification, 'destroy').mockResolvedValue(1);
    const res = await request(app)
      .delete('/v1/notifications/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/eliminada/);
  });
});

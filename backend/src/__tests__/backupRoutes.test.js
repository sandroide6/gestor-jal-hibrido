'use strict';
// Fix: routes/backup.js — el callback de OAuth de Google Drive tenía 3 problemas:
//   1) authenticate/authorize se aplicaban a TODO el router, incluido /callback, que
//      Google llama sin ningún header de auth nuestro → siempre devolvía 401 y rompía
//      el flujo de conexión con Drive.
//   2) No había protección CSRF (`state`) en el flujo OAuth.
//   3) El callback guardaba los tokens en "la primera JAL de la tabla" en vez de la
//      JAL del admin que inició la conexión.
// Este archivo prueba la corrección: /callback es público y usa un `state` firmado
// para recuperar el jal_id correcto y protegerse de CSRF.

process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');
const drive   = require('../services/driveBackupService');
const { decryptJSON } = require('../utils/crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function adminToken(jalId = 'jal-1') {
  return jwt.sign({ sub: 'admin-1', jal_id: jalId, role: 'administrador' }, JWT_SECRET, {
    algorithm: 'HS256', expiresIn: '1h',
  });
}

function signState(jalId, userId = 'admin-1', overrides = {}) {
  return jwt.sign(
    { type: 'drive_oauth_state', jal_id: jalId, sub: userId, ...overrides },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: overrides.expiresIn || '10m' },
  );
}

// Offline-tolerance: findByPk rechaza → authenticate confía en el JWT (igual que en
// adminController.test.js)
function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

afterEach(() => vi.restoreAllMocks());

describe('GET /v1/backup/drive/callback — público, sin JWT (Google no lo envía)', () => {
  it('responde sin exigir Authorization header (antes daba 401 y rompía el flujo)', async () => {
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue({ id: 'jal-1', config: {} });
    vi.spyOn(models.Jal, 'update').mockResolvedValue([1]);
    vi.spyOn(drive, 'exchangeCode').mockResolvedValue({ access_token: 'at', refresh_token: 'rt' });

    const res = await request(app)
      .get('/v1/backup/drive/callback')
      .query({ code: 'auth-code', state: signState('jal-1') });

    expect(res.status).not.toBe(401);
    expect(res.status).toBe(302); // redirect
  });

  it('guarda los tokens en la JAL codificada en el state, NO en "la primera JAL de la tabla"', async () => {
    const findByPkSpy = vi.spyOn(models.Jal, 'findByPk').mockResolvedValue({ id: 'jal-2', config: {} });
    const updateSpy   = vi.spyOn(models.Jal, 'update').mockResolvedValue([1]);
    vi.spyOn(drive, 'exchangeCode').mockResolvedValue({ access_token: 'at', refresh_token: 'rt' });

    await request(app)
      .get('/v1/backup/drive/callback')
      .query({ code: 'auth-code', state: signState('jal-2') });

    expect(findByPkSpy).toHaveBeenCalledWith('jal-2');
    const [updateArgs, updateOpts] = updateSpy.mock.calls[0];
    expect(updateOpts.where.id).toBe('jal-2');
    // Fix: los tokens se guardan CIFRADOS, no en texto plano (ver util crypto.js).
    const storedTokens = updateArgs.config.drive_backup.tokens;
    expect(typeof storedTokens).toBe('string');
    expect(storedTokens).not.toContain('refresh_token'); // no debe aparecer en claro
    expect(decryptJSON(storedTokens)).toEqual({ access_token: 'at', refresh_token: 'rt' });
  });

  it('redirige con error y NO guarda tokens si falta el state', async () => {
    const updateSpy = vi.spyOn(models.Jal, 'update').mockResolvedValue([1]);
    const exchangeSpy = vi.spyOn(drive, 'exchangeCode');

    const res = await request(app)
      .get('/v1/backup/drive/callback')
      .query({ code: 'auth-code' }); // sin state

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=invalid_state');
    expect(exchangeSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('redirige con error y NO guarda tokens si el state está firmado con otro secreto (forjado)', async () => {
    const updateSpy = vi.spyOn(models.Jal, 'update').mockResolvedValue([1]);
    const forgedState = jwt.sign({ type: 'drive_oauth_state', jal_id: 'jal-999' }, 'secreto-falso', { algorithm: 'HS256' });

    const res = await request(app)
      .get('/v1/backup/drive/callback')
      .query({ code: 'auth-code', state: forgedState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=invalid_state');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('redirige con error si el state expiró (más de 10 minutos)', async () => {
    const expiredState = jwt.sign(
      { type: 'drive_oauth_state', jal_id: 'jal-1' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '-1s' }, // ya vencido
    );

    const res = await request(app)
      .get('/v1/backup/drive/callback')
      .query({ code: 'auth-code', state: expiredState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=invalid_state');
  });

  it('redirige con error si el state es de otro propósito (ej. un access token real reutilizado)', async () => {
    // Un token de acceso normal de la app NO debe servir como state del flujo Drive.
    const accessToken = jwt.sign({ sub: 'user-1', jal_id: 'jal-1', role: 'administrador' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

    const res = await request(app)
      .get('/v1/backup/drive/callback')
      .query({ code: 'auth-code', state: accessToken });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=invalid_state');
  });

  it('redirige con auth_denied si Google devuelve error o no manda code', async () => {
    const res = await request(app)
      .get('/v1/backup/drive/callback')
      .query({ error: 'access_denied' });

    expect(res.headers.location).toContain('error=auth_denied');
  });
});

describe('GET /v1/backup/drive/auth-url — genera state atado al admin autenticado', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/v1/backup/drive/auth-url');
    expect(res.status).toBe(401);
  });

  it('pasa un state firmado a drive.getAuthUrl, codificando el jal_id del token', async () => {
    mockOfflineDb();
    const spy = vi.spyOn(drive, 'getAuthUrl').mockReturnValue('https://accounts.google.com/fake');
    process.env.GOOGLE_CLIENT_ID = 'x';
    process.env.GOOGLE_CLIENT_SECRET = 'y';

    const res = await request(app)
      .get('/v1/backup/drive/auth-url')
      .set('Authorization', `Bearer ${adminToken('jal-77')}`);

    expect(res.status).toBe(200);
    const [, state] = spy.mock.calls[0];
    const decoded = jwt.verify(state, JWT_SECRET, { algorithms: ['HS256'] });
    expect(decoded.jal_id).toBe('jal-77');
    expect(decoded.type).toBe('drive_oauth_state');
  });
});

describe('Resto de rutas de /v1/backup/drive siguen exigiendo auth de administrador', () => {
  it('401 sin token en /config', async () => {
    const res = await request(app).get('/v1/backup/drive/config');
    expect(res.status).toBe(401);
  });

  it('401 sin token en /run', async () => {
    const res = await request(app).post('/v1/backup/drive/run');
    expect(res.status).toBe(401);
  });

  it('401 sin token en /disconnect', async () => {
    const res = await request(app).delete('/v1/backup/drive/disconnect');
    expect(res.status).toBe(401);
  });
});

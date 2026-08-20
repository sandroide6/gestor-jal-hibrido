'use strict';
// Tests de rutas de 2FA (/v1/auth/2fa/*)
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');
const totpService  = require('../services/totpService');
const authService  = require('../services/authService');

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

function mockWithTotpScope(user) {
  return vi.spyOn(models.User, 'scope').mockReturnValue({
    findByPk: vi.fn().mockResolvedValue(user),
  });
}

// totpLimiter (routes/auth.js) permite máx. 5 solicitudes / 5 min por IP — y desde el
// fix de esta sesión se aplica también a /2fa/enable y /2fa/disable, no solo a
// /2fa/validate. Se usa un X-Forwarded-For distinto por test que sí llega al
// controlador (app.set('trust proxy', 1) en app.js) para que cada caso tenga su
// propio cupo y no interfiera con los demás.
let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `10.10.10.${ipCounter}`;
}

afterEach(() => vi.restoreAllMocks());

// ── POST /2fa/setup ─────────────────────────────────────────

describe('POST /v1/auth/2fa/setup', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/v1/auth/2fa/setup');
    expect(res.status).toBe(401);
  });

  it('404 si el usuario no existe', async () => {
    mockOfflineDb();
    mockWithTotpScope(null);
    const res = await request(app)
      .post('/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(404);
  });

  it('400 si 2FA ya está activado', async () => {
    mockOfflineDb();
    mockWithTotpScope({ id: 'aux-1', email: 'aux@test.com', totp_enabled: true });
    const res = await request(app)
      .post('/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${auxiliarToken()}`);
    expect(res.status).toBe(400);
  });

  it('200 y devuelve secreto y QR', async () => {
    mockOfflineDb();
    const update = vi.fn().mockResolvedValue(undefined);
    mockWithTotpScope({ id: 'aux-1', email: 'aux@test.com', totp_enabled: false, update });
    vi.spyOn(totpService, 'generateSecret').mockReturnValue({ base32: 'SECRET123', otpauth_url: 'otpauth://...' });
    vi.spyOn(totpService, 'generateQRDataURL').mockResolvedValue('data:image/png;base64,xyz');

    const res = await request(app)
      .post('/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${auxiliarToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.secret).toBe('SECRET123');
    expect(res.body.qrCode).toBe('data:image/png;base64,xyz');
    expect(update).toHaveBeenCalledWith({ totp_secret: 'SECRET123' });
  });
});

// ── POST /2fa/enable ────────────────────────────────────────

describe('POST /v1/auth/2fa/enable', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/v1/auth/2fa/enable').send({ token: '123456' });
    expect(res.status).toBe(401);
  });

  it('400 si el token no tiene 6 dígitos', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '12' });
    expect(res.status).toBe(400);
  });

  it('404 si el usuario no existe', async () => {
    mockOfflineDb();
    mockWithTotpScope(null);
    const res = await request(app)
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });
    expect(res.status).toBe(404);
  });

  it('400 si 2FA ya está activado', async () => {
    mockOfflineDb();
    mockWithTotpScope({ id: 'aux-1', totp_enabled: true });
    const res = await request(app)
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });
    expect(res.status).toBe(400);
  });

  it('400 si no se generó el secreto todavía', async () => {
    mockOfflineDb();
    mockWithTotpScope({ id: 'aux-1', totp_enabled: false, totp_secret: null });
    const res = await request(app)
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });
    expect(res.status).toBe(400);
  });

  it('401 si el código es incorrecto', async () => {
    mockOfflineDb();
    mockWithTotpScope({ id: 'aux-1', totp_enabled: false, totp_secret: 'SECRET123' });
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(false);

    const res = await request(app)
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });
    expect(res.status).toBe(401);
  });

  it('200 y activa 2FA cuando el código es correcto', async () => {
    mockOfflineDb();
    const update = vi.fn().mockResolvedValue(undefined);
    mockWithTotpScope({ id: 'aux-1', totp_enabled: false, totp_secret: 'SECRET123', update });
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(true);
    vi.spyOn(models.AuditLog, 'create').mockResolvedValue({});

    const res = await request(app)
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ totp_enabled: true });
    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.2fa.enabled', result: 'success' })
    );
  });

  it('429 al superar el límite de intentos (rate-limit compartido con /validate y /disable)', async () => {
    mockOfflineDb();
    mockWithTotpScope({ id: 'aux-1', totp_enabled: false, totp_secret: 'SECRET123' });
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(false);
    const ip = nextIp();

    let lastRes;
    for (let i = 0; i < 6; i++) {
      lastRes = await request(app)
        .post('/v1/auth/2fa/enable')
        .set('Authorization', `Bearer ${auxiliarToken()}`)
        .set('X-Forwarded-For', ip)
        .send({ token: '123456' });
    }
    expect(lastRes.status).toBe(429);
  });
});

// ── POST /2fa/disable ───────────────────────────────────────

describe('POST /v1/auth/2fa/disable', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/v1/auth/2fa/disable').send({ token: '123456' });
    expect(res.status).toBe(401);
  });

  it('404 si el usuario no existe', async () => {
    mockOfflineDb();
    mockWithTotpScope(null);
    const res = await request(app)
      .post('/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });
    expect(res.status).toBe(404);
  });

  it('400 si 2FA no está activado', async () => {
    mockOfflineDb();
    mockWithTotpScope({ id: 'aux-1', totp_enabled: false });
    const res = await request(app)
      .post('/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });
    expect(res.status).toBe(400);
  });

  it('401 si el código es incorrecto', async () => {
    mockOfflineDb();
    mockWithTotpScope({ id: 'aux-1', totp_enabled: true, totp_secret: 'SECRET123' });
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(false);

    const res = await request(app)
      .post('/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '000000' });
    expect(res.status).toBe(401);
  });

  it('200 y desactiva 2FA cuando el código es correcto', async () => {
    mockOfflineDb();
    const update = vi.fn().mockResolvedValue(undefined);
    mockWithTotpScope({ id: 'aux-1', totp_enabled: true, totp_secret: 'SECRET123', update });
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(true);
    vi.spyOn(models.AuditLog, 'create').mockResolvedValue({});

    const res = await request(app)
      .post('/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${auxiliarToken()}`)
      .set('X-Forwarded-For', nextIp())
      .send({ token: '123456' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ totp_enabled: false, totp_secret: null });
  });
});

// ── POST /2fa/validate — segunda fase del login (sin authenticate) ────────

describe('POST /v1/auth/2fa/validate', () => {
  it('400 si el body no cumple el esquema', async () => {
    const res = await request(app)
      .post('/v1/auth/2fa/validate')
      .set('X-Forwarded-For', nextIp())
      .send({ tempToken: 'x' });
    expect(res.status).toBe(400);
  });

  it('401 si el tempToken es inválido o expiró', async () => {
    const res = await request(app)
      .post('/v1/auth/2fa/validate')
      .set('X-Forwarded-For', nextIp())
      .send({ tempToken: 'token-invalido', token: '123456' });
    expect(res.status).toBe(401);
  });

  it('401 si el token no es de tipo 2fa_pending', async () => {
    const wrongTypeToken = jwt.sign({ sub: 'aux-1', type: 'refresh' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const res = await request(app)
      .post('/v1/auth/2fa/validate')
      .set('X-Forwarded-For', nextIp())
      .send({ tempToken: wrongTypeToken, token: '123456' });
    expect(res.status).toBe(401);
  });

  it('401 si el usuario no existe o está inactivo', async () => {
    const tempToken = jwt.sign({ sub: 'aux-1', type: '2fa_pending' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    mockWithTotpScope(null);
    const res = await request(app)
      .post('/v1/auth/2fa/validate')
      .set('X-Forwarded-For', nextIp())
      .send({ tempToken, token: '123456' });
    expect(res.status).toBe(401);
  });

  it('401 si el código TOTP es incorrecto', async () => {
    const tempToken = jwt.sign({ sub: 'aux-1', type: '2fa_pending' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    mockWithTotpScope({ id: 'aux-1', active: true, totp_secret: 'SECRET123' });
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(false);
    vi.spyOn(models.AuditLog, 'create').mockResolvedValue({});

    const res = await request(app)
      .post('/v1/auth/2fa/validate')
      .set('X-Forwarded-For', nextIp())
      .send({ tempToken, token: '000000' });
    expect(res.status).toBe(401);
  });

  it('200 y emite access token cuando el código es correcto', async () => {
    const tempToken = jwt.sign({ sub: 'aux-1', type: '2fa_pending' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    mockWithTotpScope({
      id: 'aux-1', active: true, totp_secret: 'SECRET123',
      jal_id: 'jal-1', role: 'auxiliar', name: 'Auxiliar Test', email: 'aux@test.com',
    });
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(true);
    vi.spyOn(models.AuditLog, 'create').mockResolvedValue({});

    const res = await request(app)
      .post('/v1/auth/2fa/validate')
      .set('X-Forwarded-For', nextIp())
      .send({ tempToken, token: '123456' });

    expect(res.status).toBe(200);
    // Fix: el access token ya no viaja en el body (evita que quede expuesto a un XSS
    // que lea la respuesta) — se entrega en cookies httpOnly, igual que en login().
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ id: 'aux-1', role: 'auxiliar' });

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('csrf_token='))).toBe(true);
    // Regresión del bug de path corregido en esta sesión: antes decía '/auth/refresh'
    // (sin el prefijo /v1 real) y la cookie nunca llegaba a la ruta de refresh.
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toMatch(/Path=\/v1\/auth\/refresh/i);
  });
});

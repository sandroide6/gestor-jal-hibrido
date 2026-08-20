'use strict';
// Fix: migración del access token de IndexedDB (legible por JS, exfiltrable vía XSS) a
// cookies httpOnly. Cubre: cookies correctas en login/refresh, el token ya no viaja en
// el body, protección CSRF (double-submit cookie) en mutaciones autenticadas por
// cookie, y que un header Authorization explícito sigue funcionando sin CSRF.
//
// Se usa POST /v1/auth/logout como endpoint de prueba para "mutación autenticada"
// porque solo depende de AuditLog.create (fácil de mockear), a diferencia de otras
// rutas mutantes que además requieren mocks de negocio específicos.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');
const authService = require('../services/authService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function mockOfflineDb() {
  return vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));
}

function cookieMap(res) {
  const raw = res.headers['set-cookie'] || [];
  const map = {};
  for (const c of raw) {
    const [pair, ...attrs] = c.split(';');
    const [name, value] = pair.split('=');
    map[name.trim()] = { value: value ?? '', attrs: attrs.map((a) => a.trim()) };
  }
  return map;
}

beforeEach(() => {
  vi.spyOn(models.AuditLog, 'create').mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /v1/auth/login — cookies httpOnly, sin token en el body', () => {
  it('setea access_token, refresh_token y csrf_token; el body no incluye el JWT', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      token: 'fake-access-jwt',
      refreshToken: 'fake-refresh-jwt',
      user: { id: 'u-1', name: 'Ana', role: 'auxiliar', jal_id: 'jal-1' },
    });

    const res = await request(app).post('/v1/auth/login').send({ email: 'ana@jal.co', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ id: 'u-1' });

    const cookies = cookieMap(res);
    expect(cookies.access_token.value).toBe('fake-access-jwt');
    expect(cookies.access_token.attrs.some((a) => /^HttpOnly$/i.test(a))).toBe(true);

    expect(cookies.refresh_token.value).toBe('fake-refresh-jwt');
    expect(cookies.refresh_token.attrs.some((a) => /^HttpOnly$/i.test(a))).toBe(true);
    expect(cookies.refresh_token.attrs.some((a) => /^Path=\/v1\/auth\/refresh$/i.test(a))).toBe(true);

    // csrf_token debe ser legible por JS — sin HttpOnly (es la mitad "double-submit")
    expect(cookies.csrf_token.value).toBeTruthy();
    expect(cookies.csrf_token.attrs.some((a) => /^HttpOnly$/i.test(a))).toBe(false);
  });

  it('no setea cookies cuando requiere 2FA (aún no hay sesión)', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({ requires2fa: true, tempToken: 'temp-jwt' });

    const res = await request(app).post('/v1/auth/login').send({ email: 'ana@jal.co', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requires2fa: true, tempToken: 'temp-jwt' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('authenticate — extrae el token de la cookie access_token cuando no hay header Authorization', () => {
  it('200 en una ruta protegida usando solo la cookie (sin header Authorization)', async () => {
    mockOfflineDb();
    const token = makeToken({ sub: 'u-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana' });

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Cookie', [`access_token=${token}`, 'csrf_token=x'])
      .set('X-CSRF-Token', 'x');

    expect(res.status).toBe(200);
  });

  it('prioriza el header Authorization sobre la cookie si ambos están presentes', async () => {
    mockOfflineDb();
    const headerToken = makeToken({ sub: 'header-user', jal_id: 'jal-1', role: 'auxiliar', name: 'Header' });
    const cookieToken  = makeToken({ sub: 'cookie-user', jal_id: 'jal-1', role: 'auxiliar', name: 'Cookie' });

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${headerToken}`)
      .set('Cookie', [`access_token=${cookieToken}`]); // sin csrf_token — probaría el gate si tomara la cookie

    expect(res.status).toBe(200); // sin 403 → no exigió CSRF → se autenticó por header, no por cookie
    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'header-user' }),
    );
  });
});

describe('CSRF (double-submit cookie) — solo aplica a mutaciones autenticadas por cookie', () => {
  it('403 en una mutación autenticada por cookie sin csrf_token', async () => {
    mockOfflineDb();
    const token = makeToken({ sub: 'u-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana' });

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Cookie', [`access_token=${token}`]);

    expect(res.status).toBe(403);
  });

  it('403 si el header X-CSRF-Token no coincide con la cookie csrf_token', async () => {
    mockOfflineDb();
    const token = makeToken({ sub: 'u-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana' });

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Cookie', [`access_token=${token}`, 'csrf_token=abc123'])
      .set('X-CSRF-Token', 'algo-distinto');

    expect(res.status).toBe(403);
  });

  it('200 si el header X-CSRF-Token coincide con la cookie csrf_token', async () => {
    mockOfflineDb();
    const token = makeToken({ sub: 'u-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana' });

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Cookie', [`access_token=${token}`, 'csrf_token=matching-value'])
      .set('X-CSRF-Token', 'matching-value');

    expect(res.status).toBe(200);
  });

  it('una mutación autenticada por header Authorization (no cookie) no requiere csrf_token', async () => {
    mockOfflineDb();
    const token = makeToken({ sub: 'u-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana' });

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`); // sin cookies en absoluto

    expect(res.status).toBe(200);
  });
});

describe('POST /v1/auth/refresh — CSRF y cookies', () => {
  it('403 si hay refresh_token cookie pero el csrf_token no coincide', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', ['refresh_token=some-refresh-jwt', 'csrf_token=abc']);
    // sin header X-CSRF-Token → no coincide con la cookie
    expect(res.status).toBe(403);
  });

  it('200 y renueva cookies cuando el csrf_token coincide y el refresh es válido', async () => {
    vi.spyOn(authService, 'refresh').mockResolvedValue({ token: 'new-access', refreshToken: 'new-refresh' });

    const res = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', ['refresh_token=some-refresh-jwt', 'csrf_token=matching'])
      .set('X-CSRF-Token', 'matching');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true }); // ya no devuelve el token en el body
    const cookies = cookieMap(res);
    expect(cookies.access_token.value).toBe('new-access');
    expect(cookies.refresh_token.value).toBe('new-refresh');
  });

  it('no exige csrf_token cuando el refresh token llega por body (cliente sin cookies)', async () => {
    vi.spyOn(authService, 'refresh').mockResolvedValue({ token: 'new-access', refreshToken: 'new-refresh' });

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'body-refresh-jwt' }); // sin cookies

    expect(res.status).toBe(200);
  });
});

describe('POST /v1/auth/logout — limpia las 3 cookies', () => {
  it('responde Set-Cookie con expiración inmediata para access_token, refresh_token y csrf_token', async () => {
    mockOfflineDb();
    const token = makeToken({ sub: 'u-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana' });

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Cookie', [`access_token=${token}`, 'csrf_token=x'])
      .set('X-CSRF-Token', 'x');

    expect(res.status).toBe(200);
    const cookies = cookieMap(res);
    for (const name of ['access_token', 'refresh_token', 'csrf_token']) {
      expect(cookies[name]).toBeDefined();
      expect(cookies[name].attrs.some((a) => /^Expires=/i.test(a) && /1970/.test(a))).toBe(true);
    }
  });
});

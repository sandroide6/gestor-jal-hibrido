'use strict';
// PT-20: authService — lockout, failed_attempts, 2FA, JWT helpers

process.env.NODE_ENV = 'test';

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const models  = require('../models');
const authService = require('../services/authService');
const E = require('../config/errorCodes');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return {
    id:              'user-1',
    email:           'test@jal.co',
    jal_id:          'jal-1',
    role:            'auxiliar',
    name:            'Ana Torres',
    password_hash:   '$2b$12$fakehash',
    active:          true,
    failed_attempts: 0,
    locked_until:    null,
    totp_enabled:    false,
    update:          vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Scoped model returned by User.scope('withPassword')
let mockScopedModel;

beforeEach(() => {
  mockScopedModel = { findOne: vi.fn() };
  vi.spyOn(models.User,     'scope').mockReturnValue(mockScopedModel);
  vi.spyOn(models.User,     'findByPk');
  vi.spyOn(models.AuditLog, 'create').mockResolvedValue(undefined);
  vi.spyOn(bcrypt,          'compare');
});

afterEach(() => vi.restoreAllMocks());

// ── login() ───────────────────────────────────────────────────────────────────

describe('login() — PT-20', () => {

  const BASE = { email: 'test@jal.co', password: 'Secure123!', ip: '127.0.0.1' };

  it('lanza 401 cuando el usuario no existe', async () => {
    mockScopedModel.findOne.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login(BASE)).rejects.toMatchObject({
      status: 401,
      code: E.AUTH_INVALID_CREDENTIALS,
    });

    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', result: 'failure' })
    );
  });

  // Fix: antes, "usuario no existe" retornaba de inmediato sin ejecutar bcrypt,
  // mientras "contraseña incorrecta" sí lo hacía (~cientos de ms) — la diferencia de
  // tiempo de respuesta permitía a un atacante enumerar qué correos están registrados.
  it('ejecuta bcrypt.compare también cuando el usuario no existe (mitiga enumeración por timing)', async () => {
    mockScopedModel.findOne.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login(BASE)).rejects.toMatchObject({ status: 401 });

    expect(bcrypt.compare).toHaveBeenCalledOnce();
  });

  it('lanza 423 cuando la cuenta está bloqueada', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min en el futuro
    mockScopedModel.findOne.mockResolvedValue(makeUser({ locked_until: lockedUntil }));

    await expect(authService.login(BASE)).rejects.toMatchObject({
      status: 423,
      code: E.AUTH_ACCOUNT_LOCKED,
      message: expect.stringContaining('minuto'),
    });
  });

  it('no lanza 423 si locked_until ya pasó (bloqueo expirado)', async () => {
    const pastDate = new Date(Date.now() - 1000);
    const user = makeUser({ locked_until: pastDate, active: false }); // inactive para cortar antes de bcrypt
    mockScopedModel.findOne.mockResolvedValue(user);

    // Debe pasar el check de bloqueo y fallar en active
    await expect(authService.login(BASE)).rejects.toMatchObject({ status: 403 });
  });

  it('lanza 403 cuando la cuenta está desactivada', async () => {
    mockScopedModel.findOne.mockResolvedValue(makeUser({ active: false }));

    await expect(authService.login(BASE)).rejects.toMatchObject({
      status: 403,
      code: E.FORBIDDEN,
    });
  });

  it('incrementa failed_attempts en contraseña incorrecta', async () => {
    const user = makeUser({ failed_attempts: 2 });
    mockScopedModel.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login(BASE)).rejects.toMatchObject({ status: 401 });

    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({ failed_attempts: 3 })
    );
    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failure', metadata: expect.objectContaining({ attempt: 3 }) })
    );
  });

  it('no bloquea la cuenta antes de alcanzar MAX_FAILED_ATTEMPTS', async () => {
    const user = makeUser({ failed_attempts: 8 }); // intento 9 → no bloquea aún
    mockScopedModel.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login(BASE)).rejects.toMatchObject({ status: 401 });

    const updateArg = user.update.mock.calls[0][0];
    expect(updateArg.failed_attempts).toBe(9);
    expect(updateArg.locked_until).toBeUndefined();
  });

  it('bloquea la cuenta al alcanzar MAX_FAILED_ATTEMPTS y resetea el contador', async () => {
    const user = makeUser({ failed_attempts: 9 }); // intento 10 → bloquea
    mockScopedModel.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login(BASE)).rejects.toMatchObject({ status: 401 });

    const updateArg = user.update.mock.calls[0][0];
    expect(updateArg.failed_attempts).toBe(0);
    expect(updateArg.locked_until).toBeInstanceOf(Date);
    expect(updateArg.locked_until.getTime()).toBeGreaterThan(Date.now());
  });

  it('login exitoso: resetea failed_attempts y devuelve tokens y datos de usuario', async () => {
    const user = makeUser({ failed_attempts: 3 });
    mockScopedModel.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login(BASE);

    expect(result.token).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({ id: 'user-1', email: 'test@jal.co', role: 'auxiliar' });

    expect(user.update).toHaveBeenCalledWith({ failed_attempts: 0, locked_until: null });
    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', result: 'success' })
    );
  });

  it('login exitoso con 2FA: devuelve requires2fa y tempToken (no access token)', async () => {
    const user = makeUser({ totp_enabled: true });
    mockScopedModel.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login(BASE);

    expect(result.requires2fa).toBe(true);
    expect(result.tempToken).toEqual(expect.any(String));
    expect(result.token).toBeUndefined();

    // El tempToken debe ser un JWT de tipo '2fa_pending'
    const payload = authService.verifyToken(result.tempToken);
    expect(payload.type).toBe('2fa_pending');
    expect(payload.sub).toBe('user-1');

    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login.2fa_required', result: 'success' })
    );
  });

  it('el access token contiene jal_id, role y name', async () => {
    const user = makeUser({ role: 'administrador', jal_id: 'jal-99', name: 'Luis Reyes' });
    mockScopedModel.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);

    const { token } = await authService.login(BASE);

    const payload = authService.verifyToken(token);
    expect(payload.jal_id).toBe('jal-99');
    expect(payload.role).toBe('administrador');
    expect(payload.name).toBe('Luis Reyes');
  });
});

// ── refresh() ─────────────────────────────────────────────────────────────────

describe('refresh() — PT-20', () => {

  function makeRefreshToken(sub = 'user-1') {
    return authService.issueRefreshToken({ sub });
  }

  it('lanza 401 si el token es inválido', async () => {
    await expect(authService.refresh({ refreshToken: 'not-a-jwt', ip: '127.0.0.1' }))
      .rejects.toMatchObject({ status: 401, code: E.AUTH_REFRESH_INVALID });
  });

  it('lanza 401 si el token no es de tipo refresh (p.ej. access token)', async () => {
    const accessToken = authService.issueAccessToken({ sub: 'user-1', jal_id: 'j1', role: 'auxiliar', name: 'X' });

    await expect(authService.refresh({ refreshToken: accessToken, ip: '127.0.0.1' }))
      .rejects.toMatchObject({ status: 401, code: E.AUTH_REFRESH_INVALID });
  });

  it('lanza 401 si el usuario no existe', async () => {
    const token = makeRefreshToken('ghost-user');
    models.User.findByPk.mockResolvedValue(null);

    await expect(authService.refresh({ refreshToken: token, ip: '127.0.0.1' }))
      .rejects.toMatchObject({ status: 401, code: E.UNAUTHENTICATED });
  });

  it('lanza 401 si el usuario está desactivado', async () => {
    const token = makeRefreshToken();
    models.User.findByPk.mockResolvedValue({ id: 'user-1', active: false });

    await expect(authService.refresh({ refreshToken: token, ip: '127.0.0.1' }))
      .rejects.toMatchObject({ status: 401, code: E.UNAUTHENTICATED });
  });

  it('rota el refresh token y emite nuevo access token', async () => {
    const token = makeRefreshToken();
    // Avanzar 1 s para que el nuevo refresh token tenga diferente iat
    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);

    models.User.findByPk.mockResolvedValue({
      id: 'user-1', jal_id: 'jal-1', role: 'edil', name: 'Luisa', active: true,
    });

    const result = await authService.refresh({ refreshToken: token, ip: '127.0.0.1' });
    vi.useRealTimers();

    expect(result.token).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.refreshToken).not.toBe(token);

    const payload = authService.verifyToken(result.token);
    expect(payload.role).toBe('edil');

    expect(models.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh', result: 'success' })
    );
  });

  // Regresión: antes de esta corrección, refresh() no comparaba `iat` contra
  // `tokens_invalid_before`, así que un refresh token robado seguía funcionando
  // indefinidamente aunque el usuario cambiara su contraseña o cerrara todas las
  // sesiones (authenticate.js sí hacía esta comprobación para access tokens, refresh() no).
  it('lanza 401 si el refresh token fue emitido antes de tokens_invalid_before (sesión revocada)', async () => {
    const token = makeRefreshToken();

    models.User.findByPk.mockResolvedValue({
      id: 'user-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana', active: true,
      // Invalidado 1 hora después de emitido el token → el token debe rechazarse
      tokens_invalid_before: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(authService.refresh({ refreshToken: token, ip: '127.0.0.1' }))
      .rejects.toMatchObject({ status: 401, code: E.AUTH_TOKEN_REVOKED });
  });

  it('permite el refresh si el token fue emitido después de tokens_invalid_before', async () => {
    const token = makeRefreshToken();

    models.User.findByPk.mockResolvedValue({
      id: 'user-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana', active: true,
      // Invalidado 1 hora ANTES de emitido el token → el token sigue siendo válido
      tokens_invalid_before: new Date(Date.now() - 60 * 60 * 1000),
    });

    const result = await authService.refresh({ refreshToken: token, ip: '127.0.0.1' });
    expect(result.token).toEqual(expect.any(String));
  });
});

// ── hashPassword() / comparePassword() ───────────────────────────────────────

describe('hashPassword() / comparePassword() — PT-20', () => {
  it('hashPassword produce un hash bcrypt verificable', async () => {
    vi.restoreAllMocks(); // usar bcrypt real para este test
    const hash = await authService.hashPassword('MiPassword1!');
    // authService usa bcryptjs (dependencia real del proyecto, no el bcrypt nativo),
    // que produce el prefijo de versión $2a$ — funcionalmente equivalente a $2b$.
    expect(hash).toMatch(/^\$2[aby]\$/);
    const match = await authService.comparePassword('MiPassword1!', hash);
    expect(match).toBe(true);
  }, 15000); // bcrypt 12 rounds puede tardar ~500 ms

  it('comparePassword devuelve false para contraseña incorrecta', async () => {
    vi.restoreAllMocks();
    const hash = await authService.hashPassword('Correcta1!');
    const match = await authService.comparePassword('Incorrecta1!', hash);
    expect(match).toBe(false);
  }, 15000);
});

// ── issueAccessToken() / issueRefreshToken() / verifyToken() ─────────────────

describe('JWT helpers — PT-20', () => {
  it('issueAccessToken produce un token con el payload dado', () => {
    const payload = { sub: 'u-1', jal_id: 'j-1', role: 'auxiliar', name: 'Paula' };
    const token = authService.issueAccessToken(payload);
    const decoded = authService.verifyToken(token);

    expect(decoded.sub).toBe('u-1');
    expect(decoded.jal_id).toBe('j-1');
    expect(decoded.role).toBe('auxiliar');
    expect(decoded.name).toBe('Paula');
    expect(decoded.type).toBeUndefined();
  });

  it('issueRefreshToken produce un token con type: refresh', () => {
    const token = authService.issueRefreshToken({ sub: 'u-2' });
    const decoded = authService.verifyToken(token);

    expect(decoded.sub).toBe('u-2');
    expect(decoded.type).toBe('refresh');
  });

  it('verifyToken lanza si el token está firmado con otro secreto', () => {
    const rogue = jwt.sign({ sub: 'hacker' }, 'otro-secreto', { algorithm: 'HS256' });
    expect(() => authService.verifyToken(rogue)).toThrow();
  });

  // Regresión: verifyToken() no restringía `algorithms` en jwt.verify(). En modo
  // RS256, la clave de verificación es la clave PÚBLICA (no secreta por diseño). Sin
  // restringir el algoritmo, un atacante puede firmar un token con alg:HS256 usando el
  // texto de esa clave pública como "secreto" HMAC, y jwt.verify lo aceptaba como
  // válido — falsificación total de tokens (confusión de algoritmo RS256↔HS256).
  it('rechaza un token HS256 falsificado usando la clave pública RS256 como secreto (confusión de algoritmo)', () => {
    const { generateKeyPairSync } = require('crypto');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const originalPriv = process.env.JWT_PRIVATE_KEY;
    const originalPub  = process.env.JWT_PUBLIC_KEY;
    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY  = publicKey;

    try {
      // Token legítimo en modo RS256: debe verificarse sin problema.
      const legit = authService.issueAccessToken({ sub: 'user-1', jal_id: 'jal-1', role: 'auxiliar', name: 'Ana' });
      expect(() => authService.verifyToken(legit)).not.toThrow();

      // Ataque: firmar con HS256 usando el TEXTO de la clave pública como secreto.
      const forged = jwt.sign(
        { sub: 'attacker', jal_id: 'jal-1', role: 'administrador', name: 'Atacante' },
        publicKey,
        { algorithm: 'HS256' }
      );
      expect(() => authService.verifyToken(forged)).toThrow();
    } finally {
      process.env.JWT_PRIVATE_KEY = originalPriv;
      process.env.JWT_PUBLIC_KEY  = originalPub;
    }
  });
});

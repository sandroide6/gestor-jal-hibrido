'use strict';
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const authController  = require('../controllers/authController');
const twoFAController = require('../controllers/twoFAController');
const authenticate    = require('../middleware/authenticate');
const validate        = require('../middleware/validate');
const authSchemas     = require('../validations/auth');
const twoFASchemas    = require('../validations/twoFA');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Demasiadas solicitudes de renovación de sesión.' },
});

const totpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: true, message: 'Demasiados intentos. Espera 5 minutos.' },
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Sesión iniciada. El access/refresh token se entregan en cookies httpOnly (access_token, refresh_token) — no en el body — junto con una cookie csrf_token legible por JS para el patrón double-submit.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:  { $ref: '#/components/schemas/User' }
 *       400: { description: Validación fallida }
 *       401: { description: Credenciales incorrectas }
 *       423: { description: Cuenta bloqueada }
 */
router.post('/login',           loginLimiter, validate(authSchemas.login), authController.login);
/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token usando refresh token (cookie)
 *     security: []
 *     responses:
 *       200: { description: Nuevo access token emitido }
 *       401: { description: Refresh token ausente, inválido o expirado }
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión e invalidar tokens
 *     responses:
 *       204: { description: Sesión cerrada }
 *
 * /auth/change-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Cambiar contraseña del usuario autenticado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 8 }
 *     responses:
 *       204: { description: Contraseña actualizada }
 *       400: { description: Validación fallida }
 *       401: { description: Contraseña actual incorrecta }
 */
// /refresh no pasa por el middleware authenticate (usa el refresh token, no el access
// token), así que aplica el mismo chequeo CSRF de forma explícita — reusa
// authenticate.csrfValid() en vez de la comprobación ad-hoc anterior (Content-Type /
// X-Requested-With), unificando el mecanismo de protección.
router.post('/refresh', refreshLimiter, (req, res, next) => {
  if (req.cookies?.refresh_token && !authenticate.csrfValid(req)) {
    return res.status(403).json({ error: true, message: 'Token CSRF inválido o ausente' });
  }
  next();
}, authController.refresh);
router.post('/logout',          authenticate, authController.logout);
router.post('/logout-all',      authenticate, authController.logoutAll);
router.post('/consent',         authenticate, authController.acceptConsent);
router.patch('/change-password',authenticate, validate(authSchemas.changePassword), authController.changePassword);

// 2FA
router.post('/2fa/validate', totpLimiter, validate(twoFASchemas.validate2fa), twoFAController.validate);
router.post('/2fa/setup',    authenticate, twoFAController.setup);
// totpLimiter también aquí: sin él, un atacante con un access token robado podía
// probar hasta 100 códigos TOTP/min (límite global) contra /enable o /disable, sin
// bloqueo de cuenta por intentos fallidos (a diferencia del login).
router.post('/2fa/enable',   authenticate, totpLimiter, validate(twoFASchemas.totpToken), twoFAController.enable);
router.post('/2fa/disable',  authenticate, totpLimiter, validate(twoFASchemas.totpToken), twoFAController.disable);

module.exports = router;

'use strict';
// PT-21: totpService — secret generation, QR, token verification

process.env.NODE_ENV = 'test';

const speakeasy = require('speakeasy');
const totpService = require('../services/totpService');

describe('generateSecret()', () => {

  it('devuelve un objeto con base32 y otpauth_url', () => {
    const secret = totpService.generateSecret('test@jal.co');
    expect(typeof secret.base32).toBe('string');
    expect(secret.base32.length).toBeGreaterThan(0);
    expect(secret.otpauth_url).toContain('otpauth://totp/');
  });

  it('incluye el email del usuario en el nombre del OTP URI', () => {
    const secret = totpService.generateSecret('usuario@jal12.gov.co');
    expect(decodeURIComponent(secret.otpauth_url)).toContain('usuario@jal12.gov.co');
  });

  it('incluye el nombre de la app en el label del OTP URI', () => {
    const secret = totpService.generateSecret('test@jal.co');
    expect(decodeURIComponent(secret.otpauth_url)).toContain('Gestor JAL');
  });

  it('genera secretos distintos en cada llamada', () => {
    const s1 = totpService.generateSecret('a@j.co');
    const s2 = totpService.generateSecret('a@j.co');
    expect(s1.base32).not.toBe(s2.base32);
  });

});

describe('generateQRDataURL()', () => {

  it('devuelve un data URL que comienza con data:image/png;base64,', async () => {
    const secret = speakeasy.generateSecret({ length: 20 });
    const dataUrl = await totpService.generateQRDataURL(secret.otpauth_url);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

});

describe('verifyToken()', () => {

  it('devuelve true para un token válido del mismo segundo', () => {
    const secret = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
    expect(totpService.verifyToken(secret.base32, token)).toBe(true);
  });

  it('devuelve false para un token incorrecto', () => {
    const secret = speakeasy.generateSecret({ length: 20 });
    expect(totpService.verifyToken(secret.base32, '000000')).toBe(false);
  });

  it('devuelve false para un secreto diferente', () => {
    const secret1 = speakeasy.generateSecret({ length: 20 });
    const secret2 = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({ secret: secret1.base32, encoding: 'base32' });
    expect(totpService.verifyToken(secret2.base32, token)).toBe(false);
  });

});

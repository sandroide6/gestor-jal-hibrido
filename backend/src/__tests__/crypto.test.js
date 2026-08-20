'use strict';
// Fix: los tokens OAuth de Google Drive se guardaban en texto plano en Jal.config
// (JSONB) — un dump de BD exponía acceso indefinido al Drive de backups. Este util
// (AES-256-GCM) cifra/descifra esos valores antes de persistirlos.
process.env.NODE_ENV = 'test';

const { encrypt, decrypt, encryptJSON, decryptJSON } = require('../utils/crypto');

describe('encrypt() / decrypt()', () => {
  it('round-trip: decrypt(encrypt(x)) === x', () => {
    const plain = 'refresh_token_super_secreto_123';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produce un texto cifrado distinto cada vez para el mismo input (IV aleatorio)', () => {
    const a = encrypt('mismo-valor');
    const b = encrypt('mismo-valor');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('mismo-valor');
    expect(decrypt(b)).toBe('mismo-valor');
  });

  it('el texto cifrado no contiene el valor original en claro', () => {
    const secret = 'ya29.a0AfH6SMC_muy_secreto_refresh_token';
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(enc.includes('muy_secreto')).toBe(false);
  });

  it('lanza si el texto cifrado fue alterado (autenticación GCM falla)', () => {
    const enc = encrypt('valor original');
    const tampered = enc.slice(0, -4) + 'aaaa';
    expect(() => decrypt(tampered)).toThrow();
  });

  it('lanza si el payload no es un cifrado válido', () => {
    expect(() => decrypt('esto-no-es-base64-cifrado-valido')).toThrow();
  });
});

describe('encryptJSON() / decryptJSON()', () => {
  it('round-trip con un objeto completo de tokens OAuth', () => {
    const tokens = {
      access_token: 'at-123', refresh_token: 'rt-456',
      expiry_date: 1234567890, scope: 'drive.file', token_type: 'Bearer',
    };
    const enc = encryptJSON(tokens);
    expect(typeof enc).toBe('string');
    expect(enc).not.toContain('rt-456');
    expect(decryptJSON(enc)).toEqual(tokens);
  });
});

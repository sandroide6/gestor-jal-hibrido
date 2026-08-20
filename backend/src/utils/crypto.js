'use strict';
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16; // 128 bits — tamaño estándar recomendado para GCM

// Deriva siempre una clave de 32 bytes vía SHA-256, sin importar la longitud del
// valor configurado en ENCRYPTION_KEY — evita errores de "invalid key length".
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production';
  return crypto.createHash('sha256').update(raw).digest();
}

// Cifra un texto plano. Formato de salida: base64(iv[12] + authTag[16] + ciphertext).
function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(payload) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function encryptJSON(obj) {
  return encrypt(JSON.stringify(obj));
}

function decryptJSON(payload) {
  return JSON.parse(decrypt(payload));
}

module.exports = { encrypt, decrypt, encryptJSON, decryptJSON };

'use strict';
// speakeasy/qrcode se importan siempre al arrancar (vía las rutas de 2FA), aunque la
// mayoría de logins no activan/verifican 2FA en cada arranque. Diferirlos hasta el
// primer uso real recorta el tiempo hasta el primer app.listen(); require() ya cachea
// el módulo tras la primera llamada.
function getSpeakeasy() {
  return require('speakeasy');
}
function getQRCode() {
  return require('qrcode');
}

const APP_NAME = 'Gestor JAL';

function generateSecret(userEmail) {
  return getSpeakeasy().generateSecret({
    name:   `${APP_NAME} (${userEmail})`,
    issuer: APP_NAME,
    length: 20,
  });
}

async function generateQRDataURL(otpauthUrl) {
  return getQRCode().toDataURL(otpauthUrl);
}

function verifyToken(secret, token) {
  return getSpeakeasy().totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // tolera ±30 segundos de desfase
  });
}

module.exports = { generateSecret, generateQRDataURL, verifyToken };

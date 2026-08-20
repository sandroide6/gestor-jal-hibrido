'use strict';
const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');

const APP_NAME = 'Gestor JAL';

function generateSecret(userEmail) {
  return speakeasy.generateSecret({
    name:   `${APP_NAME} (${userEmail})`,
    issuer: APP_NAME,
    length: 20,
  });
}

async function generateQRDataURL(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

function verifyToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // tolera ±30 segundos de desfase
  });
}

module.exports = { generateSecret, generateQRDataURL, verifyToken };

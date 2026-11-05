// Genera los secretos que el backend exige con NODE_ENV=production, listos para pegar
// en deploy/.env (Docker), backend/.env (local) o el panel de Render.
// Uso (Windows, Linux o macOS): node deploy/generar-claves.js
// No guarda nada en disco: copia la salida a un lugar seguro y no la subas a git.
'use strict';
const { generateKeyPairSync, randomBytes } = require('crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Las claves PEM van en una sola línea con \n literal (authService las vuelve a convertir).
const oneLine = (pem) => pem.trim().replace(/\n/g, '\\n');

console.log(`JWT_SECRET=${randomBytes(64).toString('hex')}`);
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`);
console.log(`JWT_PRIVATE_KEY=${oneLine(privateKey)}`);
console.log(`JWT_PUBLIC_KEY=${oneLine(publicKey)}`);

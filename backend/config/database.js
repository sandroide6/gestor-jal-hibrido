require('dotenv').config();

// Backend usa PostgreSQL en todos los entornos.
// El almacenamiento offline del cliente corre en IndexedDB (browser), no en SQLite aquí.
const fs = require('fs');

// TLS hacia la base (auditoría 2026-11-05, P2-1). Antes siempre era
// rejectUnauthorized:false: cifrado pero sin comprobar QUIÉN responde, lo que permite
// un intermediario. Ahora:
//   DB_SSL_CA=<PEM o ruta a .crt>  → verifica contra esa CA (Supabase: "SSL certificate"
//                                    en Project Settings → Database). Recomendado.
//   DB_SSL_VERIFY=true             → verifica contra las CA del sistema.
//   ninguna                        → como antes, sin verificar (con aviso al arrancar).
function sslConfig() {
  const ca = process.env.DB_SSL_CA;
  if (ca) {
    const pem = ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : fs.readFileSync(ca, 'utf8');
    return { require: true, rejectUnauthorized: true, ca: pem };
  }
  if (process.env.DB_SSL_VERIFY === 'true') return { require: true, rejectUnauthorized: true };
  return { require: true, rejectUnauthorized: false };
}

const sslOpts = {
  get dialectOptions() {
    return { ssl: sslConfig() };
  },
};

function needsSsl(url) {
  // Override explícito: una IP de Tailscale (ej. 100.101.102.103) o un nombre
  // MagicDNS (*.ts.net) también "tienen punto", así que la heurística de abajo
  // los trataría como host externo y forzaría SSL contra un Postgres local que
  // no tiene certificados configurados. DB_SSL permite decidirlo explícitamente
  // en vez de adivinar por el hostname.
  if (process.env.DB_SSL === 'true') return true;
  if (process.env.DB_SSL === 'false') return false;

  if (!url) return false;
  try {
    // Sin override: usar SSL solo para hosts externos (tienen punto en el hostname:
    // supabase, RDS, etc.). Los nombres internos de Docker (postgres, localhost,
    // 127.0.0.1) no tienen punto.
    return new URL(url).hostname.includes('.');
  } catch {
    return false;
  }
}

module.exports = {
  sslConfig,
  development: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/gestor_jal',
    dialect: 'postgres',
    logging: process.env.LOG_SQL === 'true' ? console.log : false,
    pool: { max: 5, min: 1, acquire: 30000, idle: 10000 },
    ...(needsSsl(process.env.DATABASE_URL) ? sslOpts : {}),
  },
  test: {
    url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    pool: { max: 3, min: 1, acquire: 30000, idle: 10000 },
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    logging: false,
    ...(needsSsl(process.env.DATABASE_URL) ? sslOpts : {}),
  },
};

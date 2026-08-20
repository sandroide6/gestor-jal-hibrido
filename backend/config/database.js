require('dotenv').config();

// Backend usa PostgreSQL en todos los entornos.
// El almacenamiento offline del cliente corre en IndexedDB (browser), no en SQLite aquí.
const sslOpts = {
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
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

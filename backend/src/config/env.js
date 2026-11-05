'use strict';

const REQUIRED = ['DATABASE_URL'];

const INSECURE_DEFAULTS = {
  JWT_SECRET:      'dev-secret-change-in-production',
  JWT_PRIVATE_KEY: 'CAMBIAR_EN_PRODUCCION',
  // Cifra en reposo los tokens OAuth de Google Drive (Jal.config.drive_backup.tokens).
  ENCRYPTION_KEY:  'dev-encryption-key-change-in-production',
};

function validateEnv() {
  // logger aún no puede usarse aquí (carga circular), se usa console directamente
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(JSON.stringify({
      level: 'error', timestamp: new Date().toISOString(),
      message: 'Variables de entorno requeridas no configuradas',
      missing,
    }));
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const insecure = Object.entries(INSECURE_DEFAULTS)
      .filter(([k, defaultVal]) => !process.env[k] || process.env[k] === defaultVal)
      .map(([k]) => k);

    // Auditoría 2026-11-05 (P2-1): avisar si la conexión TLS a la base no verifica el certificado
    if (process.env.DB_SSL !== 'false' && !process.env.DB_SSL_CA && process.env.DB_SSL_VERIFY !== 'true') {
      console.warn(JSON.stringify({
        level: 'warn', timestamp: new Date().toISOString(),
        message: 'TLS a la base sin verificar el certificado: define DB_SSL_CA (CA de Supabase) o DB_SSL_VERIFY=true',
      }));
    }

    if (insecure.length) {
      console.error(JSON.stringify({
        level: 'error', timestamp: new Date().toISOString(),
        message: 'SEGURIDAD: Variables con valores por defecto inseguros en producción — servidor detenido',
        variables: insecure,
      }));
      process.exit(1);
    }
  }
}

module.exports = { validateEnv };

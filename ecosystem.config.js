// ecosystem.config.js — Configuración PM2 para Gestor JAL en Windows
// PM2 es opcional. Uso:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 stop gestor-jal-backend
//   pm2 logs gestor-jal-backend

module.exports = {
  apps: [
    {
      name: 'gestor-jal-backend',
      script: 'src/index.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env_file: './backend/.env',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};

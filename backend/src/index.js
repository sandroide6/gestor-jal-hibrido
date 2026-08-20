'use strict';
const logger = require('./config/logger');
const app    = require('./app');
const { sequelize } = require('./models');
const { checkAutoBackups } = require('./services/driveBackupService');
const wordConverter = require('./services/wordConverter');

const PORT      = parseInt(process.env.PORT || '3001', 10);
const BIND_HOST = '0.0.0.0';


const server = app.listen(PORT, BIND_HOST, () => {
  logger.info('Servidor escuchando', { host: BIND_HOST, port: PORT, health: `http://${BIND_HOST}:${PORT}/health` });
  logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  // Verificar backups automáticos cada 5 minutos
  setInterval(checkAutoBackups, 5 * 60 * 1000);
  // Pre-calentar Word en segundo plano para que el primer documento sea rápido —
  // solo tiene sentido en Windows (Word COM). En Linux (Render) ni lo intenta: además
  // de ser inútil ahí, un `spawn('powershell.exe', …)` que falla en un binario que no
  // existe puede tumbar el proceso si algo no maneja el evento 'error' correctamente.
  if (process.platform === 'win32') {
    wordConverter._ensureReady()
      .then(() => logger.info('Word COM listo — conversiones PDF < 300 ms'))
      .catch((err) => logger.warn('Word COM no disponible, se usará fallback', { message: err.message }));
  }
});

function shutdown(signal) {
  logger.info(`${signal} recibido — cerrando servidor…`);
  server.close(async () => {
    wordConverter.shutdown();
    try {
      await sequelize.close();
      logger.info('Pool de conexiones cerrado.');
    } catch (err) {
      logger.error('Error al cerrar Sequelize', { message: err.message });
    }
    logger.info('Servidor cerrado.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Timeout de cierre — forzando salida.');
    process.exit(1);
  }, 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;

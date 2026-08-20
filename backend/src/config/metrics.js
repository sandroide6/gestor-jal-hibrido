'use strict';

const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'jal_',
  labels: { app: 'gestor-jal', version: process.env.npm_package_version || '2.0.0' },
});

// ── Métricas de negocio ──────────────────────────────────────
const httpRequestDuration = new client.Histogram({
  name: 'jal_http_request_duration_seconds',
  help: 'Duración de peticiones HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'jal_http_requests_total',
  help: 'Total de peticiones HTTP',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const documentsGenerated = new client.Counter({
  name: 'jal_documents_generated_total',
  help: 'Total de documentos generados',
  labelNames: ['doc_type', 'jal_id'],
  registers: [register],
});

const activeUsers = new client.Gauge({
  name: 'jal_active_sessions',
  help: 'Sesiones JWT activas (aproximado)',
  registers: [register],
});

// ── Middleware de métricas HTTP ──────────────────────────────
function metricsMiddleware(req, res, next) {
  // No medir el propio endpoint de métricas
  if (req.path === '/metrics') return next();

  const start = Date.now();
  const route = req.route?.path || req.path;

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  documentsGenerated,
  activeUsers,
};

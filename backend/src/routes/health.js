'use strict';

const { Router } = require('express');
const { sequelize } = require('../models');

const router = Router();

// Liveness: el proceso responde. No toca la base, para que el health check del
// contenedor (Render, Docker) no reinicie el servicio en bucle durante una caída de
// Supabase, que reiniciar no arregla (auditoría 2026-11-05, P2-3). La disponibilidad
// real (readiness, con base) es GET /health y la vigila el monitor externo.
router.get('/live', (_req, res) => {
  res.json({ status: 'ok', uptime_s: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

router.get('/', async (_req, res) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let dbLatency = null;

  try {
    await sequelize.authenticate();
    dbLatency = Date.now() - start;
  } catch {
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'ok';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      db: { status: dbStatus, latency_ms: dbLatency },
    },
  });
});

module.exports = router;

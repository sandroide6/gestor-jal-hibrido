'use strict';

const { Router } = require('express');
const { sequelize } = require('../models');

const router = Router();

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

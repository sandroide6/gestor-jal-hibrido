'use strict';
const { Router } = require('express');
const authenticate    = require('../middleware/authenticate');
const authorize       = require('../middleware/authorize');
const validate        = require('../middleware/validate');
const reportsSchemas  = require('../validations/reports');
const reportsController = require('../controllers/reportsController');

const router = Router();
router.use(authenticate);

router.get('/stats',
  authorize('administrador', 'edil'),
  validate(reportsSchemas.exportDocuments, 'query'),
  reportsController.getStats,
);

router.get('/documents',
  authorize('administrador', 'edil'),
  validate(reportsSchemas.exportDocuments, 'query'),
  reportsController.exportDocuments,
);

module.exports = router;

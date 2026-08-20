'use strict';
const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const adminController  = require('../controllers/adminController');
const jalConfigCtrl    = require('../controllers/jalConfigController');
const adminSchemas     = require('../validations/admin');
const jalConfigSchemas = require('../validations/jalConfig');

const router = Router();
router.use(authenticate);
router.use(authorize('administrador', 'edil'));

router.get('/stats',  adminController.stats);
router.get('/backup', authorize('administrador'), adminController.backup);
router.get('/export', authorize('administrador'), adminController.exportData);
router.get('/audit-logs', authorize('administrador', 'edil'), validate(adminSchemas.auditQuery, 'query'), adminController.auditLogs);

// Configuración de la JAL (nombre, logo, feature flags)
router.get('/jal-config',   jalConfigCtrl.getConfig);
router.patch('/jal-config', authorize('administrador'), validate(jalConfigSchemas.update), jalConfigCtrl.updateConfig);

module.exports = router;

'use strict';
const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const syncController = require('../controllers/syncController');
const syncSchemas = require('../validations/sync');

const router = Router();
router.use(authenticate);

router.post('/batch', validate(syncSchemas.batch), syncController.batch);
router.get('/status', syncController.status);

module.exports = router;

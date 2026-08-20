'use strict';
const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { uuidParam } = require('../validations/common');
const ctrl = require('../controllers/notificationsController');

const router = Router();
router.use(authenticate);

router.get('/',              ctrl.list);
router.get('/unread-count',  ctrl.unreadCount);
router.patch('/read-all',    ctrl.markAllRead);
router.patch('/:id/read',    validate(uuidParam, 'params'), ctrl.markRead);
router.delete('/:id',        validate(uuidParam, 'params'), ctrl.remove);

module.exports = router;

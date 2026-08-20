'use strict';
const { Router } = require('express');
const multer = require('multer');
const os = require('os');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const usersController = require('../controllers/usersController');
const usersSchemas = require('../validations/users');
const { uuidParam } = require('../validations/common');

const router = Router();
router.use(authenticate);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (['image/png', 'image/jpeg'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes PNG o JPG'));
  },
});

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Obtener perfil propio
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *   patch:
 *     tags: [Users]
 *     summary: Actualizar perfil propio (nombre, cargo)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               cargo_titulo: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Listar usuarios de la JAL (solo admin)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:  { type: array, items: { $ref: '#/components/schemas/User' } }
 *                 total: { type: integer }
 *                 page:  { type: integer }
 *                 pages: { type: integer }
 *   post:
 *     tags: [Users]
 *     summary: Crear usuario (solo admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:     { type: string }
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role:     { type: string, enum: [administrador, edil, auxiliar] }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Actualizar usuario (solo admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *   delete:
 *     tags: [Users]
 *     summary: Desactivar usuario (solo admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Usuario desactivado }
 */
// ── Perfil propio (cualquier rol) ─────────────────────────
router.get('/me',          usersController.me);
router.patch('/me',        validate(usersSchemas.updateMe), usersController.updateMe);
router.post('/me/firma',   upload.single('firma'), usersController.uploadFirma);
router.get('/me/firma',    usersController.getFirma);
router.delete('/me/firma', usersController.deleteFirma);

// ── Ediles activos (cualquier rol autenticado) ────────────
router.get('/ediles', usersController.listEdiles);

// ── Firma de un edil (solo auxiliar/administrador, mismo JAL) — un edil no tiene
// caso de uso legítimo para ver la firma de otro edil. El controlador restringe
// además a que el usuario destino tenga role:'edil' (único caso de uso legítimo:
// delegar la firma de un documento generado en su nombre) ──
router.get(
  '/:id/firma',
  authorize('auxiliar', 'administrador'),
  validate(uuidParam, 'params'),
  usersController.getUserFirma
);

// ── Gestión de usuarios (solo admin) ──────────────────────
router.get('/',      authorize('administrador'), validate(usersSchemas.list, 'query'), usersController.list);
router.post('/',     authorize('administrador'), validate(usersSchemas.create), usersController.create);
router.patch('/:id',           authorize('administrador'), validate(uuidParam, 'params'), validate(usersSchemas.update), usersController.update);
router.delete('/:id/permanent', authorize('administrador'), validate(uuidParam, 'params'), usersController.hardDelete);
router.delete('/:id',           authorize('administrador'), validate(uuidParam, 'params'), usersController.deactivate);

module.exports = router;

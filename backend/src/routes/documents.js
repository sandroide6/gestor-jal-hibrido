'use strict';
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const documentController = require('../controllers/documentController');
const documentsSchemas = require('../validations/documents');
const { uuidParam } = require('../validations/common');

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);

const upload = multer({
  dest: path.join(os.tmpdir(), 'jal-signatures'),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes PNG o JPG para la firma'));
  },
});

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /documents/my:
 *   get:
 *     tags: [Documents]
 *     summary: Listar documentos generados por el usuario autenticado
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:  { type: array, items: { $ref: '#/components/schemas/Document' } }
 *                 total: { type: integer }
 *
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: Listar todos los documentos de la JAL (edil/admin)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: doc_type_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: user_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: reviewed
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:  { type: array, items: { $ref: '#/components/schemas/Document' } }
 *                 total: { type: integer }
 *   post:
 *     tags: [Documents]
 *     summary: Generar un nuevo documento
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               doc_type_id:      { type: string, format: uuid }
 *               beneficiary_name: { type: string }
 *               form_data:        { type: string, description: JSON con campos del formulario }
 *               firma:            { type: string, format: binary }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Document' }
 *
 * /documents/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Obtener detalle de un documento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Document' }
 *       404: { description: No encontrado }
 *
 * /documents/{id}/download:
 *   get:
 *     tags: [Documents]
 *     summary: Descargar el archivo del documento (PDF o DOCX)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 */
// ── Auxiliar ──────────────────────────────────────────────
// Lista propia + genera documento
router.get('/my', validate(documentsSchemas.ownList, 'query'), documentController.list);
router.post('/', upload.single('firma'), validate(documentsSchemas.create), documentController.create);

// ── Edil / Admin ──────────────────────────────────────────
// Panel con filtros (todos los documentos de la JAL)
router.get(
  '/',
  authorize('edil', 'administrador'),
  validate(documentsSchemas.edilList, 'query'),
  documentController.listForEdil
);

// Conteo de pendientes de revisión (para badge PWA)
router.get(
  '/pending-review-count',
  authorize('edil', 'administrador'),
  documentController.pendingReviewCount
);

// Detalle de un documento
router.get(
  '/:id',
  authorize('edil', 'administrador'),
  validate(uuidParam, 'params'),
  documentController.getById
);

// Descargar archivo (accesible para todos los roles autenticados)
router.get('/:id/download', validate(uuidParam, 'params'), documentController.download);

// Marcar como revisado
router.patch(
  '/:id/review',
  authorize('edil', 'administrador'),
  validate(uuidParam, 'params'),
  documentController.markReviewed
);

// Eliminar documento (solo administrador)
router.delete(
  '/:id',
  authorize('administrador'),
  validate(uuidParam, 'params'),
  documentController.remove
);

module.exports = router;

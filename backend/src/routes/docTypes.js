'use strict';
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const docTypesSchemas = require('../validations/docTypes');
const { uuidParam } = require('../validations/common');
const docTypesController = require('../controllers/docTypesController');

// Extrae el campo `data` (JSON string) de un multipart/form-data y lo convierte en req.body
function parseMultipartData(req, res, next) {
  if (typeof req.body?.data !== 'string') {
    return res.status(400).json({ error: true, message: 'Se requiere el campo data con el JSON del tipo de documento' });
  }
  try {
    req.body = JSON.parse(req.body.data);
    next();
  } catch {
    res.status(400).json({ error: true, message: 'El campo data no es JSON válido' });
  }
}

const upload = multer({
  dest: path.join(os.tmpdir(), 'jal-templates'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB máx para plantillas
  fileFilter(_req, file, cb) {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // algunos navegadores envían esto para .docx
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ext === '.docx') cb(null, true);
    else cb(new Error('Solo se permiten archivos .docx como plantilla'));
  },
});

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /doc-types:
 *   get:
 *     tags: [DocTypes]
 *     summary: Listar tipos de documento (activos e inactivos — el campo `active` indica cuáles; el panel de administración los necesita todos para poder reactivarlos, el generador filtra los inactivos del lado del cliente)
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/DocType' }
 *   post:
 *     tags: [DocTypes]
 *     summary: Crear tipo de documento con plantilla DOCX (solo admin)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON con name y fields
 *               template:
 *                 type: string
 *                 format: binary
 *                 description: Archivo .docx de plantilla
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DocType' }
 *
 * /doc-types/{id}:
 *   get:
 *     tags: [DocTypes]
 *     summary: Obtener detalle de un tipo de documento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DocType' }
 *   patch:
 *     tags: [DocTypes]
 *     summary: Actualizar tipo de documento (solo admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DocType' }
 */
// Todos los roles autenticados pueden ver los tipos (activos e inactivos — el
// generador filtra los inactivos del lado del cliente, el panel de admin los muestra
// todos para poder reactivarlos)
router.get('/', docTypesController.list);
router.get('/:id/template', validate(uuidParam, 'params'), docTypesController.getTemplate);
router.get('/:id', validate(uuidParam, 'params'), docTypesController.getOne);

// Solo admin puede crear y editar
router.post('/',
  authorize('administrador'),
  upload.single('template'),
  parseMultipartData,
  validate(docTypesSchemas.create),
  docTypesController.create,
);
router.patch('/:id',
  authorize('administrador'),
  validate(uuidParam, 'params'),
  upload.single('template'),
  parseMultipartData,
  validate(docTypesSchemas.update),
  docTypesController.update,
);

module.exports = router;

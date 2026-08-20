'use strict';
/**
 * @openapi
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Token JWT y datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:  { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Cambiar contraseña del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       400:
 *         description: Validación fallida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *
 * /documents:
 *   post:
 *     tags: [Documents]
 *     summary: Generar un nuevo documento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [doc_type_id, form_data]
 *             properties:
 *               doc_type_id: { type: string, format: uuid }
 *               form_data:   { type: string, description: 'JSON serializado con los campos del formulario' }
 *               firma:       { type: string, format: binary, description: 'Imagen de firma (opcional, si no está en perfil)' }
 *     responses:
 *       200:
 *         description: Documento generado (ZIP con DOCX y PDF)
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   get:
 *     tags: [Documents]
 *     summary: Listar documentos de la JAL
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: doc_type_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: user_id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista paginada de documentos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:  { type: array, items: { $ref: '#/components/schemas/Document' } }
 *                 total: { type: integer }
 *                 page:  { type: integer }
 *                 pages: { type: integer }
 *
 * /doc-types:
 *   get:
 *     tags: [DocTypes]
 *     summary: Listar tipos de documento activos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array de tipos de documento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/DocType' }
 *   post:
 *     tags: [DocTypes]
 *     summary: Crear tipo de documento (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, prefix, template]
 *             properties:
 *               name:     { type: string }
 *               prefix:   { type: string, maxLength: 10 }
 *               template: { type: string }
 *     responses:
 *       201:
 *         description: Tipo creado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DocType' }
 *
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Listar usuarios de la JAL (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/User' }
 *   post:
 *     tags: [Users]
 *     summary: Crear usuario (admin)
 *     security:
 *       - bearerAuth: []
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
 *               cargo:    { type: string }
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *
 * /users/{id}/firma:
 *   post:
 *     tags: [Users]
 *     summary: Subir firma digital del usuario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firma: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Firma guardada correctamente
 *
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Estadísticas generales de la JAL
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas (usuarios, documentos, tipos)
 *
 * /admin/backup:
 *   get:
 *     tags: [Admin]
 *     summary: Descargar backup de la base de datos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archivo de backup (JSON)
 *         content:
 *           application/json:
 *             schema: { type: object }
 *
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Consultar registros de auditoría
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: user_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: result
 *         schema: { type: string, enum: [success, failure, error] }
 *     responses:
 *       200:
 *         description: Registros paginados
 *
 * /admin/jal-config:
 *   get:
 *     tags: [Admin]
 *     summary: Obtener configuración de la JAL
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración actual
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JalConfig' }
 *   patch:
 *     tags: [Admin]
 *     summary: Actualizar configuración de la JAL
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:     { type: string, minLength: 2, maxLength: 200 }
 *               logo_url: { type: string, format: uri, nullable: true }
 *               features:
 *                 type: object
 *                 properties:
 *                   backup:        { type: boolean }
 *                   reports:       { type: boolean }
 *                   notifications: { type: boolean }
 *                   doc_types:     { type: boolean }
 *                   audit_logs:    { type: boolean }
 *     responses:
 *       200:
 *         description: Configuración actualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JalConfig' }
 *
 * /reports/documents:
 *   get:
 *     tags: [Reports]
 *     summary: Reporte de documentos generados
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: date_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, xlsx], default: json }
 *     responses:
 *       200:
 *         description: Reporte en JSON o Excel
 *
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Listar notificaciones del usuario
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 *
 * /sync/pending:
 *   get:
 *     tags: [Sync]
 *     summary: Obtener documentos pendientes de sincronizar
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documentos pendientes
 *
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Estado del servidor y la base de datos
 *     security: []
 *     responses:
 *       200:
 *         description: Servidor operativo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 db:     { type: string, example: connected }
 */
module.exports = {};

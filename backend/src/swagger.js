'use strict';
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gestor de Documentos JAL — API',
      version: '2.0.0',
      description:
        'API REST del sistema de gestión documental para Juntas de Acción Local (JAL). ' +
        'Autenticación con JWT via cookie `token` o cabecera `Authorization: Bearer <token>`.',
      contact: { name: 'Equipo JAL', email: 'admin@jal.gov.co' },
      license: { name: 'Privado' },
    },
    servers: [
      { url: '/api/v1', description: 'Producción (mismo servidor)' },
      { url: 'http://localhost:3001/v1', description: 'Desarrollo local' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error:   { type: 'boolean', example: true },
            message: { type: 'string',  example: 'Descripción del error' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            name:       { type: 'string', example: 'Ana García' },
            email:      { type: 'string', format: 'email' },
            role:       { type: 'string', enum: ['administrador', 'edil', 'auxiliar'] },
            cargo:      { type: 'string', example: 'Secretaria' },
            has_firma:  { type: 'boolean' },
            is_active:  { type: 'boolean' },
            jal_id:     { type: 'string', format: 'uuid' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        DocType: {
          type: 'object',
          properties: {
            id:       { type: 'string', format: 'uuid' },
            name:     { type: 'string', example: 'Acta de reunión' },
            prefix:   { type: 'string', example: 'ACT' },
            template: { type: 'string', example: 'ACTA_001' },
            active:   { type: 'boolean' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            doc_number:   { type: 'string', example: 'ACT-2026-001' },
            doc_type_id:  { type: 'string', format: 'uuid' },
            user_id:      { type: 'string', format: 'uuid' },
            jal_id:       { type: 'string', format: 'uuid' },
            status:       { type: 'string', enum: ['pending', 'synced', 'conflict'] },
            form_data:    { type: 'object' },
            created_at:   { type: 'string', format: 'date-time' },
          },
        },
        JalConfig: {
          type: 'object',
          properties: {
            id:       { type: 'string', format: 'uuid' },
            name:     { type: 'string', example: 'JAL Ciudad Jardín' },
            logo_url: { type: 'string', format: 'uri', nullable: true },
            features: {
              type: 'object',
              properties: {
                backup:        { type: 'boolean' },
                reports:       { type: 'boolean' },
                notifications: { type: 'boolean' },
                doc_types:     { type: 'boolean' },
                audit_logs:    { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    tags: [
      { name: 'Auth',          description: 'Autenticación y sesión' },
      { name: 'Documents',     description: 'Generación y consulta de documentos' },
      { name: 'DocTypes',      description: 'Tipos de documento' },
      { name: 'Users',         description: 'Gestión de usuarios y firmas' },
      { name: 'Admin',         description: 'Panel de administración' },
      { name: 'Reports',       description: 'Reportes y exportaciones' },
      { name: 'Notifications', description: 'Notificaciones en tiempo real' },
      { name: 'Sync',          description: 'Sincronización offline' },
      { name: 'Health',        description: 'Estado del servidor' },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

module.exports = swaggerJsdoc(options);

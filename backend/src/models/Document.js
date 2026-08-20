'use strict';
const { DataTypes } = require('sequelize');
const { SYNC_STATUSES } = require('../config/constants');

module.exports = (sequelize) =>
  sequelize.define(
    'Document',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      document_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      numero_radicado: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      tipo_tramite: {
        type: DataTypes.ENUM('entrada', 'salida', 'interno'),
        allowNull: false,
      },
      jal_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      doc_type_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      doc_type_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      beneficiary_name: {
        type: DataTypes.STRING(300),
        allowNull: false,
      },
      beneficiary_id: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      file_path_docx: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      file_path_pdf: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      // Copia del contenido en BD — fuente de verdad cuando el disco del backend no
      // persiste (ej. Render free tier). file_path_* se mantiene como caché rápida.
      file_docx: {
        type: DataTypes.BLOB('long'),
        allowNull: true,
      },
      file_pdf: {
        type: DataTypes.BLOB('long'),
        allowNull: true,
      },
      sync_status: {
        type: DataTypes.ENUM(...SYNC_STATUSES),
        defaultValue: 'synced',
        validate: { isIn: [SYNC_STATUSES] },
      },
      reviewed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reviewed_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      edil_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'documents',
      underscored: true,
      paranoid: true,
      deletedAt: 'deleted_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'DocType',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      jal_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      // [{ name: 'cedula', label: 'Cédula', type: 'text', required: true }]
      fields: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      template_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      template_data: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Contenido base64 de la plantilla .docx',
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      tipo_tramite: {
        type: DataTypes.ENUM('entrada', 'salida', 'interno'),
        allowNull: false,
        defaultValue: 'salida',
      },
    },
    {
      tableName: 'doc_types',
      underscored: true,
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

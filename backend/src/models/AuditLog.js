'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'AuditLog',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      resource: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      result: {
        type: DataTypes.ENUM('success', 'failure', 'error'),
        allowNull: false,
      },
      ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
    },
    {
      tableName: 'audit_logs',
      underscored: true,
      timestamps: false,
    }
  );

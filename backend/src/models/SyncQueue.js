'use strict';
const { DataTypes } = require('sequelize');

const OPERATIONS = ['create', 'update', 'delete'];

module.exports = (sequelize) =>
  sequelize.define(
    'SyncQueue',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      jal_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      operation: {
        type: DataTypes.ENUM(...OPERATIONS),
        allowNull: false,
        validate: { isIn: [OPERATIONS] },
      },
      payload: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      retries: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'sync_queue',
      underscored: true,
      updatedAt: false, // solo tiene created_at
    }
  );

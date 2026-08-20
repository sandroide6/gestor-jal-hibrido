'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'Jal',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      logo_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      logo_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      config: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      features: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Feature flags: { backup, reports, notifications }',
      },
    },
    {
      tableName: 'jals',
      underscored: true,
    }
  );

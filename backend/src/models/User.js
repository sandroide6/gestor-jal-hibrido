'use strict';
const { DataTypes } = require('sequelize');
const { ROLES } = require('../config/constants');

module.exports = (sequelize) =>
  sequelize.define(
    'User',
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
      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      role: {
        type: DataTypes.ENUM(...ROLES),
        allowNull: false,
        validate: { isIn: [ROLES] },
      },
      password_hash: {
        type: DataTypes.STRING(72),
        allowNull: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      failed_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      locked_until: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tokens_invalid_before: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cargo_titulo: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      signature_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      signature_data: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      totp_secret: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      totp_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      consent_accepted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      underscored: true,
      paranoid: true,
      deletedAt: 'deleted_at',
      defaultScope: {
        attributes: { exclude: ['password_hash', 'totp_secret'] },
      },
      scopes: {
        withPassword: { attributes: {} },
        withTotp: { attributes: {} },
      },
    }
  );

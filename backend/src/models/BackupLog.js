'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('BackupLog', {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    jal_id:         { type: DataTypes.UUID, allowNull: false },
    filename:       { type: DataTypes.STRING(500) },
    drive_file_id:  { type: DataTypes.STRING(300) },
    drive_file_url: { type: DataTypes.STRING(1000) },
    size_bytes:     { type: DataTypes.BIGINT },
    status:         { type: DataTypes.ENUM('running', 'success', 'failed'), defaultValue: 'running' },
    type:           { type: DataTypes.ENUM('manual', 'auto'), defaultValue: 'manual' },
    error_message:  { type: DataTypes.TEXT },
    created_by:     { type: DataTypes.UUID },
  }, {
    tableName: 'backup_logs',
    underscored: true,
  });

'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('backup_logs', {
      id:             { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      jal_id:         { type: Sequelize.UUID, allowNull: false },
      filename:       { type: Sequelize.STRING(500) },
      drive_file_id:  { type: Sequelize.STRING(300) },
      drive_file_url: { type: Sequelize.STRING(1000) },
      size_bytes:     { type: Sequelize.BIGINT },
      status:         { type: Sequelize.ENUM('running', 'success', 'failed'), defaultValue: 'running' },
      type:           { type: Sequelize.ENUM('manual', 'auto'), defaultValue: 'manual' },
      error_message:  { type: Sequelize.TEXT },
      created_by:     { type: Sequelize.UUID },
      created_at:     { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at:     { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('backup_logs', ['jal_id', 'created_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('backup_logs');
  },
};

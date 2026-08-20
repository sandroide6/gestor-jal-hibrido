'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true, // null para intentos de login fallidos sin usuario
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      resource: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      result: {
        type: Sequelize.ENUM('success', 'failure', 'error'),
        allowNull: false,
      },
      ip: {
        type: Sequelize.STRING(45), // IPv6 max
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
    });

    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['timestamp']);
    await queryInterface.addIndex('audit_logs', ['action']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};

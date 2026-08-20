'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sync_queue', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      // Dispositivo/usuario que generó la operación offline
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      jal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'jals', key: 'id' },
        onDelete: 'CASCADE',
      },
      operation: {
        type: Sequelize.ENUM('create', 'update', 'delete'),
        allowNull: false,
      },
      // Recurso afectado (tabla + id): { resource: 'documents', id: '...' }
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      retries: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      // null = pendiente | timestamp = procesado exitosamente
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('sync_queue', ['user_id']);
    await queryInterface.addIndex('sync_queue', ['jal_id']);
    await queryInterface.addIndex('sync_queue', ['processed_at']);
    await queryInterface.addIndex('sync_queue', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sync_queue');
  },
};

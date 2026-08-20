'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      jal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'jals', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      doc_type_id: {
        type: Sequelize.UUID,
        allowNull: true, // null si el tipo fue eliminado
        references: { model: 'doc_types', key: 'id' },
        onDelete: 'SET NULL',
      },
      // Nombre del tipo en el momento de generación (snapshot)
      doc_type_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      beneficiary_name: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      beneficiary_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      // Todos los campos del formulario que se usaron para generar el documento
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      file_path_docx: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      file_path_pdf: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      // Estado de sincronización offline→online
      sync_status: {
        type: Sequelize.ENUM('pending', 'synced', 'conflict'),
        defaultValue: 'synced',
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('documents', ['jal_id']);
    await queryInterface.addIndex('documents', ['user_id']);
    await queryInterface.addIndex('documents', ['doc_type_id']);
    await queryInterface.addIndex('documents', ['beneficiary_id']);
    await queryInterface.addIndex('documents', ['sync_status']);
    await queryInterface.addIndex('documents', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('documents');
  },
};

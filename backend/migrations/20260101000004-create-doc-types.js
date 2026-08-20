'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('doc_types', {
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
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      // Array de objetos: [{ name, label, type, required }]
      // type: 'text' | 'date' | 'number' | 'select'
      fields: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false,
      },
      template_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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

    await queryInterface.addIndex('doc_types', ['jal_id', 'active']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('doc_types');
  },
};

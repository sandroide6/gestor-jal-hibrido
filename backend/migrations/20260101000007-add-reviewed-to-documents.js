'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('documents', 'reviewed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('documents', 'reviewed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('documents', 'reviewed_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('documents', ['reviewed']);
    await queryInterface.addIndex('documents', ['reviewed_by']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('documents', 'reviewed');
    await queryInterface.removeColumn('documents', 'reviewed_at');
    await queryInterface.removeColumn('documents', 'reviewed_by');
  },
};

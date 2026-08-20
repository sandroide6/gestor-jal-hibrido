'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('documents', 'edil_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('documents', ['edil_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('documents', ['edil_id']);
    await queryInterface.removeColumn('documents', 'edil_id');
  },
};

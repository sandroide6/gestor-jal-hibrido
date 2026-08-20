'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'tokens_invalid_before', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Los tokens emitidos antes de esta fecha se consideran inválidos',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'tokens_invalid_before');
  },
};

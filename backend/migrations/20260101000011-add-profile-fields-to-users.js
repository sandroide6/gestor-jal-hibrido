'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'cargo_titulo', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'signature_path', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'cargo_titulo');
    await queryInterface.removeColumn('users', 'signature_path');
  },
};

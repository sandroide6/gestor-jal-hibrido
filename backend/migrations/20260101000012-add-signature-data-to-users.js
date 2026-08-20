'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'signature_data', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Firma en base64 (data:image/png;base64,...)',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'signature_data');
  },
};

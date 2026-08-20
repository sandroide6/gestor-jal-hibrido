'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'consent_accepted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'totp_enabled',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'consent_accepted_at');
  },
};

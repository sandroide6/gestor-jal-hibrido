'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jals', 'features', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Feature flags por JAL: { backup: true, reports: true, notifications: true }',
    });
    await queryInterface.addColumn('jals', 'logo_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL del logo institucional de la JAL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('jals', 'features');
    await queryInterface.removeColumn('jals', 'logo_url');
  },
};

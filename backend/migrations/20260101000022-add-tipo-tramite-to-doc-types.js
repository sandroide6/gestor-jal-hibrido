'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('doc_types', 'tipo_tramite', {
      type: Sequelize.ENUM('entrada', 'salida', 'interno'),
      allowNull: false,
      defaultValue: 'salida',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('doc_types', 'tipo_tramite');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_doc_types_tipo_tramite";');
  },
};

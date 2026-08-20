'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('doc_types', 'template_data', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Contenido base64 de la plantilla .docx (sustituye template_path en Render)',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('doc_types', 'template_data');
  },
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('documents', 'document_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
      after: 'id',
    });

    // Rellenar los documentos existentes con un número correlativo por JAL
    await queryInterface.sequelize.query(`
      WITH numbered AS (
        SELECT id,
               jal_id,
               EXTRACT(YEAR FROM created_at)::INT AS año,
               ROW_NUMBER() OVER (PARTITION BY jal_id, EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS n
        FROM documents
        WHERE deleted_at IS NULL
      )
      UPDATE documents d
      SET document_number = LPAD(n::TEXT, 4, '0') || '-' || año
      FROM numbered num
      WHERE d.id = num.id
    `);

    // Índice único por JAL + número (año ya va dentro del número)
    await queryInterface.addIndex('documents', ['jal_id', 'document_number'], {
      name: 'idx_documents_jal_number',
      unique: true,
      where: { document_number: { [Sequelize.Op.ne]: null }, deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('documents', 'idx_documents_jal_number');
    await queryInterface.removeColumn('documents', 'document_number');
  },
};

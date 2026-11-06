'use strict';

// Idempotencia de la creación de documentos (auditoría 2026-11-05, P0-2).
//
// El frontend genera un identificador local (UUID) antes de enviar un documento. Si la
// respuesta se pierde (corte de red, arranque en frío de Render) el cliente lo reenvía,
// en línea o por la cola sin conexión. Sin esta columna cada reenvío creaba otro
// documento con otro radicado. Con ella, el segundo envío devuelve el documento ya
// creado. Única por JAL y solo cuando tiene valor: los documentos antiguos quedan en NULL.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('documents', 'client_local_id', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addIndex('documents', ['jal_id', 'client_local_id'], {
      name: 'documents_jal_client_local_id_unique',
      unique: true,
      where: { client_local_id: { [Sequelize.Op.ne]: null } },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('documents', 'documents_jal_client_local_id_unique');
    await queryInterface.removeColumn('documents', 'client_local_id');
  },
};

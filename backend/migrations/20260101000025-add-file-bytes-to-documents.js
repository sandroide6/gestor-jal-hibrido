'use strict';

// Agrega columnas BYTEA (file_docx, file_pdf) a `documents` para que el contenido
// generado viva también en Postgres, no solo en disco (backend/data/output vía
// file_path_docx/file_path_pdf). Necesario para el modo híbrido: si el backend corre
// en Render (free tier), su disco es efímero y se pierde en cada redeploy/reinicio —
// la BD, centralizada en el PC local vía Tailscale, es la que sobrevive.
//
// Nullable y sin backfill: los documentos ya existentes conservan solo su copia en
// disco local (file_path_*) tal como hasta ahora; únicamente los documentos generados
// después de este cambio quedan también con copia en BD.
//
// NOTA: este archivo se crea como propuesta — no se ejecuta como parte de la tarea de
// migración de arquitectura. Revísalo y corre `npm run db:migrate` cuando decidas.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('documents', 'file_docx', {
      type: Sequelize.BLOB('long'),
      allowNull: true,
    });
    await queryInterface.addColumn('documents', 'file_pdf', {
      type: Sequelize.BLOB('long'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('documents', 'file_docx');
    await queryInterface.removeColumn('documents', 'file_pdf');
  },
};

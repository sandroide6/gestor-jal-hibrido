'use strict';

// Agrega el número de radicado (AÑO-CODIGO_DEPENDENCIA-TIPO_TRAMITE-CONSECUTIVO) a `documents`.
// El consecutivo de los documentos ya existentes se calcula retroactivamente por
// jal_id + año + tipo_tramite (mismo criterio que usará radicadoService en adelante),
// y `radicado_counters` se siembra con el máximo usado para que la numeración futura
// continúe sin colisionar con lo ya asignado aquí.
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    await queryInterface.addColumn('documents', 'tipo_tramite', {
      type: Sequelize.ENUM('entrada', 'salida', 'interno'),
      allowNull: false,
      defaultValue: 'salida',
    });

    // Copiar el tipo de trámite desde el tipo de documento asociado (si aún existe).
    // doc_types.tipo_tramite y documents.tipo_tramite son ENUMs de Postgres distintos
    // (mismos labels, tipos distintos) — se castea vía texto.
    await sequelize.query(`
      UPDATE documents d
      SET tipo_tramite = dt.tipo_tramite::text::"enum_documents_tipo_tramite"
      FROM doc_types dt
      WHERE d.doc_type_id = dt.id
    `);

    await queryInterface.addColumn('documents', 'numero_radicado', {
      type: Sequelize.STRING(30),
      allowNull: true, // se pasa a NOT NULL tras el backfill
      after: 'tipo_tramite',
    });

    const abbrCase = `
      CASE d.tipo_tramite
        WHEN 'entrada' THEN 'ENT'
        WHEN 'salida'  THEN 'SAL'
        ELSE 'INT'
      END
    `;

    await sequelize.query(`
      WITH numbered AS (
        SELECT
          d.id,
          d.jal_id,
          EXTRACT(YEAR FROM d.created_at)::INT AS año,
          d.tipo_tramite,
          COALESCE(j.config->>'codigo_dependencia', 'JAL') AS codigo_dependencia,
          ROW_NUMBER() OVER (
            PARTITION BY d.jal_id, EXTRACT(YEAR FROM d.created_at), d.tipo_tramite
            ORDER BY d.created_at, d.id
          ) AS n
        FROM documents d
        JOIN jals j ON j.id = d.jal_id
      )
      UPDATE documents d
      SET numero_radicado =
        num.año || '-' ||
        UPPER(REGEXP_REPLACE(num.codigo_dependencia, '[^a-zA-Z0-9]', '', 'g')) || '-' ||
        (${abbrCase.replace('d.tipo_tramite', 'num.tipo_tramite')}) || '-' ||
        LPAD(num.n::TEXT, 6, '0')
      FROM numbered num
      WHERE d.id = num.id
    `);

    // jal_id es FK NOT NULL a jals (ON DELETE CASCADE), por lo que el JOIN anterior
    // siempre cubre todas las filas — no quedan numero_radicado en NULL tras el backfill.

    await queryInterface.changeColumn('documents', 'numero_radicado', {
      type: Sequelize.STRING(30),
      allowNull: false,
    });

    await queryInterface.addIndex('documents', ['numero_radicado'], {
      name: 'idx_documents_numero_radicado_unique',
      unique: true,
    });

    // Sembrar el contador con el máximo consecutivo ya usado por jal_id + año + tipo_tramite.
    // Se incluyen también los documentos con soft-delete: su número de radicado queda retirado
    // y nunca debe reasignarse a un documento nuevo.
    await sequelize.query(`
      INSERT INTO radicado_counters (jal_id, year, tipo_tramite, last_value, created_at, updated_at)
      SELECT
        jal_id,
        EXTRACT(YEAR FROM created_at)::INT AS year,
        tipo_tramite,
        MAX(CAST(SPLIT_PART(numero_radicado, '-', 4) AS INTEGER)) AS last_value,
        NOW(),
        NOW()
      FROM documents
      GROUP BY jal_id, EXTRACT(YEAR FROM created_at), tipo_tramite
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('documents', 'idx_documents_numero_radicado_unique');
    await queryInterface.removeColumn('documents', 'numero_radicado');
    await queryInterface.removeColumn('documents', 'tipo_tramite');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_documents_tipo_tramite";');
  },
};

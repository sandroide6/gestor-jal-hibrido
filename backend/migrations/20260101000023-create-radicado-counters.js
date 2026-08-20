'use strict';

// Contador atómico del consecutivo de radicación, particionado por JAL + año + tipo de trámite.
// El siguiente número se reclama con un UPSERT (INSERT ... ON CONFLICT DO UPDATE ... RETURNING),
// que Postgres serializa a nivel de fila — sin necesidad de locks explícitos ni de escanear la
// tabla `documents`. Al cambiar el año, la primera reclamación crea una fila nueva empezando en 1.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('radicado_counters', {
      jal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'jals', key: 'id' },
        onDelete: 'CASCADE',
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      tipo_tramite: {
        type: Sequelize.STRING(10),
        allowNull: false,
        primaryKey: true,
      },
      last_value: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('radicado_counters');
  },
};

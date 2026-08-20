'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const addIndexSafe = async (table, columns, options) => {
      try {
        await queryInterface.addIndex(table, columns, options);
      } catch (e) {
        const msg = e.message.toLowerCase();
        const esIgnorable =
          msg.includes('already exists') || msg.includes('does not exist') ||
          msg.includes('ya existe')      || msg.includes('no existe');
        if (!esIgnorable) throw e;
      }
    };

    // documents — consultas frecuentes por JAL, usuario y estado de sincronización
    await addIndexSafe('documents', ['jal_id', 'created_at'], { name: 'idx_documents_jal_created' });
    await addIndexSafe('documents', ['user_id', 'sync_status'], { name: 'idx_documents_user_sync' });
    await addIndexSafe('documents', ['jal_id', 'reviewed'], { name: 'idx_documents_jal_reviewed' });
    await addIndexSafe('documents', ['beneficiary_id'], { name: 'idx_documents_beneficiary' });

    // users — búsqueda por email y listado por JAL + rol
    await addIndexSafe('users', ['email'], { name: 'idx_users_email', unique: true });
    await addIndexSafe('users', ['jal_id', 'role'], { name: 'idx_users_jal_role' });
    await addIndexSafe('users', ['jal_id', 'active'], { name: 'idx_users_jal_active' });

    // audit_logs — agregar jal_id si no existe, luego indexar
    const cols = await queryInterface.describeTable('audit_logs');
    if (!cols.jal_id) {
      await queryInterface.addColumn('audit_logs', 'jal_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'jals', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    await addIndexSafe('audit_logs', ['jal_id', 'timestamp'], { name: 'idx_audit_jal_timestamp' });
    await addIndexSafe('audit_logs', ['user_id', 'timestamp'], { name: 'idx_audit_user_timestamp' });

    // sync_queue — procesamiento de cola offline
    await addIndexSafe('sync_queue', ['jal_id', 'processed_at'], { name: 'idx_sync_jal_processed' });
  },

  async down(queryInterface) {
    const removeIndexSafe = async (table, name) => {
      try { await queryInterface.removeIndex(table, name); } catch (_) {}
    };
    await removeIndexSafe('documents', 'idx_documents_jal_created');
    await removeIndexSafe('documents', 'idx_documents_user_sync');
    await removeIndexSafe('documents', 'idx_documents_jal_reviewed');
    await removeIndexSafe('documents', 'idx_documents_beneficiary');
    await removeIndexSafe('users', 'idx_users_email');
    await removeIndexSafe('users', 'idx_users_jal_role');
    await removeIndexSafe('users', 'idx_users_jal_active');
    await removeIndexSafe('audit_logs', 'idx_audit_jal_timestamp');
    await removeIndexSafe('audit_logs', 'idx_audit_user_timestamp');
    await removeIndexSafe('sync_queue', 'idx_sync_jal_processed');
  },
};

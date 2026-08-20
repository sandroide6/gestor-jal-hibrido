'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const JAL_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000002';

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // JAL de prueba
    await queryInterface.bulkInsert(
      'jals',
      [
        {
          id: JAL_ID,
          name: 'JAL Comuna 12 — La América',
          logo_path: null,
          config: JSON.stringify({}),
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );

    // Administrador inicial
    // Contraseña: Admin1234! — CAMBIAR después del primer login
    const passwordHash = await bcrypt.hash('Admin1234!', 12);

    await queryInterface.bulkInsert(
      'users',
      [
        {
          id: ADMIN_ID,
          jal_id: JAL_ID,
          name: 'Administrador JAL',
          email: 'admin@jal.gov.co',
          role: 'administrador',
          password_hash: passwordHash,
          active: true,
          failed_attempts: 0,
          locked_until: null,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { id: ADMIN_ID });
    await queryInterface.bulkDelete('jals', { id: JAL_ID });
  },
};

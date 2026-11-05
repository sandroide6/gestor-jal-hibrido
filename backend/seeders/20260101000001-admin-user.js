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

    // Administrador inicial. La contraseña de ejemplo solo vale para desarrollo y
    // pruebas; con NODE_ENV=production el seeder exige ADMIN_INITIAL_PASSWORD (auditoría
    // 2026-11-05, P1-6). En cualquier caso el administrador debe cambiarla al entrar.
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (process.env.NODE_ENV === 'production' && (!initialPassword || initialPassword === 'Admin1234!')) {
      throw new Error('ADMIN_INITIAL_PASSWORD es obligatoria (y distinta de la de ejemplo) para sembrar el administrador en producción');
    }
    const passwordHash = await bcrypt.hash(initialPassword || 'Admin1234!', 12);

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
          must_change_password: true,
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

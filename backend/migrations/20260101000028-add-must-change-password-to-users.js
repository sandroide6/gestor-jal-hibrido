'use strict';
const bcrypt = require('bcryptjs');

// Contraseña inicial obligatoria de cambiar (auditoría 2026-11-05, P1-6).
//
// Agrega users.must_change_password. Mientras esté en true, el backend solo permite
// cambiar la contraseña, ver el propio perfil y cerrar sesión. Al migrar, se marca a
// todo usuario cuya contraseña siga siendo la de ejemplo del seeder ("Admin1234!",
// publicada en versiones antiguas de la documentación): la comprobación se hace con
// bcrypt.compare dentro de la migración, sin guardar ni mostrar ninguna contraseña.
const KNOWN_DEFAULTS = ['Admin1234!'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'must_change_password', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    const [rows] = await queryInterface.sequelize.query('SELECT id, password_hash FROM users');
    const flagged = [];
    for (const row of rows) {
      for (const pwd of KNOWN_DEFAULTS) {
        if (row.password_hash && await bcrypt.compare(pwd, row.password_hash)) {
          flagged.push(row.id);
          break;
        }
      }
    }
    if (flagged.length) {
      await queryInterface.sequelize.query(
        'UPDATE users SET must_change_password = true WHERE id IN (:ids)',
        { replacements: { ids: flagged } },
      );
    }
    // Solo el conteo, nunca datos de la cuenta
    console.log(`[migración 0028] usuarios con contraseña por defecto marcados para cambio: ${flagged.length}`);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'must_change_password');
  },
};

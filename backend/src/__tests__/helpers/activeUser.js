'use strict';
// Las pruebas unitarias no tienen base de datos. authenticate consulta el usuario con
// User.findByPk(sub, { attributes: [..., 'must_change_password'] }); este doble responde a
// esa consulta con un usuario activo y sin revocaciones, y rechaza cualquier otra llamada
// a findByPk (como hacía la simulación anterior de "base caída"), para no cambiar el
// comportamiento que esperan los controladores bajo prueba.
const models = require('../../models');

function mockActiveSessionUser() {
  return vi.spyOn(models.User, 'findByPk').mockImplementation(async (id, opts) => {
    if (opts?.attributes?.includes?.('must_change_password')) {
      return { id, active: true, tokens_invalid_before: null, must_change_password: false };
    }
    throw new Error('test-db-offline');
  });
}

module.exports = { mockActiveSessionUser };

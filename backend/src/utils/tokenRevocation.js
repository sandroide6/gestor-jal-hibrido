'use strict';

// true si el token se emitió en un segundo ANTERIOR a la revocación. Un token del mismo
// segundo se acepta: es el que se emite justo después de cambiar la contraseña o el rol.
function tokenIssuedBefore(payload, invalidBefore) {
  if (!invalidBefore) return false;
  const revokedAtSec = Math.floor(new Date(invalidBefore).getTime() / 1000);
  return (payload.iat || 0) < revokedAtSec;
}

module.exports = { tokenIssuedBefore };

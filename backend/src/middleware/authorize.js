'use strict';
const E = require('../config/errorCodes');

// Uso: authorize('administrador', 'edil')
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: true, code: E.UNAUTHENTICATED, message: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: true,
        code: E.FORBIDDEN,
        message: 'No tiene permisos para esta acción',
      });
    }
    next();
  };
}

module.exports = authorize;

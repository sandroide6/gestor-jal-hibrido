'use strict';

// Elimina caracteres de control y NUL de strings en req.body / req.query
// para prevenir inyección de caracteres de control en logs y queries.
function sanitizeStrings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Eliminar caracteres NUL y de control (excepto \t, \n, \r)
      obj[key] = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else if (typeof val === 'object' && val !== null) {
      sanitizeStrings(val);
    }
  }
  return obj;
}

module.exports = function sanitize(req, _res, next) {
  sanitizeStrings(req.body);
  sanitizeStrings(req.query);
  sanitizeStrings(req.params);
  next();
};

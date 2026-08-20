'use strict';
const E = require('../config/errorCodes');

/**
 * Factory que devuelve un middleware Express que valida req[source] con el schema Joi.
 * En caso de error devuelve 400 con code: VALIDATION.
 * Si la validación pasa, reemplaza req[source] con el valor parseado (defaults aplicados).
 *
 * @param {import('joi').Schema} schema
 * @param {'body'|'query'|'params'} source
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: true, stripUnknown: true });
    if (error) {
      const detail  = error.details[0];
      const path    = detail.path;
      let   message = detail.message;

      // Si el error está dentro de un array "fields", mostrar qué campo falló
      if (path[0] === 'fields' && typeof path[1] === 'number') {
        const idx   = path[1];
        const field = req[source]?.fields?.[idx];
        const quien = field?.label
          ? `"${field.label}"`
          : field?.name
            ? `"${field.name}"`
            : `#${idx + 1}`;
        const propiedad = path[2] ?? 'valor';
        const valor     = detail.context?.value !== undefined
          ? ` ("${detail.context.value}")`
          : '';
        message = `Campo ${quien} (posición ${idx + 1}): el campo "${propiedad}"${valor} no es válido — ${detail.message}`;
      }

      return res.status(400).json({
        error: true,
        code: E.VALIDATION,
        message,
      });
    }
    req[source] = value;
    next();
  };
}

module.exports = validate;

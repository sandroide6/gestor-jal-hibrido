'use strict';
const { v4: uuidv4 } = require('uuid');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = (incoming && UUID_RE.test(incoming)) ? incoming : uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

module.exports = requestId;

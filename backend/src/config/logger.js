'use strict';

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

const COLORS = {
  error: '\x1b[31m',
  warn:  '\x1b[33m',
  info:  '\x1b[36m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

function write(level, message, meta) {
  if (IS_TEST) return;

  if (IS_PROD) {
    const line = JSON.stringify({ level, timestamp: new Date().toISOString(), message, ...meta });
    level === 'error' ? console.error(line) : console.log(line);
    return;
  }

  const tag = `${COLORS[level]}[${level.toUpperCase()}]${COLORS.reset}`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  level === 'error'
    ? console.error(`${tag} ${message}${metaStr}`)
    : console.log(`${tag} ${message}${metaStr}`);
}

const logger = {
  info:  (msg, meta) => write('info', msg, meta),
  warn:  (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
  debug: (msg, meta) => !IS_PROD && write('debug', msg, meta),
};

module.exports = logger;

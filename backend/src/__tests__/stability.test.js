'use strict';
// Estabilidad (auditoría de producción 2026-11-05, fase 3):
//   P2-3 errores de conexión a la base → 503 con Retry-After, no 500 genérico
//   P2-3 /health/live responde sin tocar la base (para el health check del contenedor)
//   P2-2 LibreOffice limitado a N conversiones simultáneas
//   P1-5 límite de peticiones por usuario autenticado, no por IP compartida
process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');
const errorHandler = require('../middleware/errorHandler');

describe('errorHandler — base de datos no disponible', () => {
  const appWith = (err) => {
    const a = express();
    a.get('/x', (_req, _res, next) => next(err));
    a.use(errorHandler);
    return a;
  };

  it.each([
    ['SequelizeConnectionRefusedError'],
    ['SequelizeConnectionError'],
    ['SequelizeConnectionAcquireTimeoutError'],
    ['SequelizeHostNotFoundError'],
  ])('%s → 503 DB_UNAVAILABLE con Retry-After', async (name) => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { name });
    const res = await request(appWith(err)).get('/x');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DB_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe('30');
    expect(res.body.message).toMatch(/base de datos/i);
  });

  it('otros errores siguen siendo 500', async () => {
    const res = await request(appWith(new Error('boom'))).get('/x');
    expect(res.status).toBe(500);
  });
});

describe('/health/live', () => {
  it('responde 200 sin consultar la base', async () => {
    const { sequelize } = require('../models');
    const spy = vi.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('db caída'));
    const app = require('../app');
    const live = await request(app).get('/health/live');
    expect(live.status).toBe(200);
    expect(live.body.status).toBe('ok');
    expect(spy).not.toHaveBeenCalled();
    const ready = await request(app).get('/health');
    expect(ready.status).toBe(503);
    spy.mockRestore();
  });
});

describe('LibreOffice — conversiones simultáneas limitadas', () => {
  it('con LIBREOFFICE_MAX_CONCURRENCY=1 nunca corren dos a la vez', async () => {
    const converter = require('../services/libreOfficeConverter');
    let running = 0;
    let peak = 0;
    const spy = vi.spyOn(converter, '_convertNow').mockImplementation(async () => {
      running++; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 30));
      running--;
      return Buffer.from('%PDF');
    });
    converter.setMaxConcurrency(1);
    await Promise.all([1, 2, 3, 4].map(() => converter.convert(Buffer.from('x'))));
    expect(peak).toBe(1);
    expect(spy).toHaveBeenCalledTimes(4);

    converter.setMaxConcurrency(2);
    peak = 0;
    await Promise.all([1, 2, 3, 4].map(() => converter.convert(Buffer.from('x'))));
    expect(peak).toBe(2);
    spy.mockRestore();
  });

  it('un fallo libera el turno para la siguiente conversión', async () => {
    const converter = require('../services/libreOfficeConverter');
    converter.setMaxConcurrency(1);
    const spy = vi.spyOn(converter, '_convertNow')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(Buffer.from('%PDF'));
    await expect(converter.convert(Buffer.from('x'))).rejects.toThrow('timeout');
    await expect(converter.convert(Buffer.from('x'))).resolves.toBeInstanceOf(Buffer);
    spy.mockRestore();
  });
});

describe('Límite de peticiones por usuario', () => {
  it('la clave del límite es el usuario autenticado, no la IP', () => {
    const { rateLimitKey } = require('../middleware/rateLimitKey');
    const { issueAccessToken } = require('../services/authService');
    const t1 = issueAccessToken({ sub: 'user-1', role: 'auxiliar', jal_id: 'j' });
    const t2 = issueAccessToken({ sub: 'user-2', role: 'auxiliar', jal_id: 'j' });
    const req = (tok) => ({ ip: '200.1.1.1', cookies: tok ? { access_token: tok } : {}, headers: {} });
    expect(rateLimitKey(req(t1))).toBe('u:user-1');
    expect(rateLimitKey(req(t2))).toBe('u:user-2');
    expect(rateLimitKey(req(null))).toBe('ip:200.1.1.1');
    expect(rateLimitKey(req('token-falso'))).toBe('ip:200.1.1.1');
  });
});

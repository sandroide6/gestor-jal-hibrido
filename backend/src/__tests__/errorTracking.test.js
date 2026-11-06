'use strict';
// Sentry (plan 6.2): inactivo sin SENTRY_DSN; con DSN envía los 5xx con su requestId y
// sin datos personales (cuerpo, cookies, cabeceras, consulta, usuario).
process.env.NODE_ENV = 'test';

const request = require('supertest');
const express = require('express');
const errorTracking = require('../services/errorTracking');
const errorHandler = require('../middleware/errorHandler');

const DSN = 'https://abc123@o123.ingest.sentry.io/456';

function appQueFalla(status = 500) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.id = 'req-prueba-123'; next(); });
  app.post('/v1/documents', () => {
    throw Object.assign(new Error('fallo interno con cédula 1000000001'), { status });
  });
  app.use(errorHandler);
  return app;
}

// Transporte en memoria: guarda los sobres en vez de mandarlos a sentry.io
function transporteEnMemoria(enviados) {
  return () => ({
    send: async (envelope) => { enviados.push(envelope); return { statusCode: 200 }; },
    flush: async () => true,
  });
}

function eventosDe(enviados) {
  return enviados.flatMap(([, items]) => items.filter(([h]) => h.type === 'event').map(([, e]) => e));
}

afterEach(async () => {
  delete process.env.SENTRY_DSN;
  await errorTracking._reset();
});

describe('errorTracking (Sentry)', () => {
  it('sin SENTRY_DSN no se activa y captureError no hace nada', async () => {
    expect(errorTracking.init()).toBe(false);
    expect(errorTracking.isEnabled()).toBe(false);
    expect(() => errorTracking.captureError(new Error('x'))).not.toThrow();
    const res = await request(appQueFalla()).post('/v1/documents').send({ cedula: '1' });
    expect(res.status).toBe(500);
  });

  it('con DSN envía el 5xx con requestId y ruta, sin datos personales', async () => {
    process.env.SENTRY_DSN = DSN;
    const enviados = [];
    expect(errorTracking.init({ transport: transporteEnMemoria(enviados) })).toBe(true);

    await request(appQueFalla())
      .post('/v1/documents?cedula=1000000001')
      .set('Cookie', 'access_token=secreto')
      .set('Authorization', 'Bearer secreto')
      .send({ nombre: 'Persona Real', cedula: '1000000001' });
    await errorTracking.flush(2000);

    const eventos = eventosDe(enviados);
    expect(eventos).toHaveLength(1);
    const ev = eventos[0];
    expect(ev.tags.requestId).toBe('req-prueba-123');
    expect(ev.tags.route).toBe('POST /v1/documents');
    expect(ev.tags.status).toBe('500');
    // Las líneas de código que Sentry adjunta a la traza (context_line) son el código
    // fuente de esta prueba, que escribe la cédula literal: no son datos de la petición.
    const sinCodigo = JSON.parse(JSON.stringify(ev));
    for (const v of sinCodigo.exception.values) delete v.stacktrace;
    const texto = JSON.stringify(sinCodigo);
    expect(texto).not.toContain('secreto');
    expect(texto).not.toContain('Persona Real');
    expect(texto).not.toContain('1000000001');
    expect(ev.exception.values[0].value).toBe('fallo interno con cédula [número]');
    expect(ev.user).toBeUndefined();
  });

  it('no envía los errores 4xx', async () => {
    process.env.SENTRY_DSN = DSN;
    const enviados = [];
    errorTracking.init({ transport: transporteEnMemoria(enviados) });
    await request(appQueFalla(400)).post('/v1/documents').send({});
    await errorTracking.flush(2000);
    expect(eventosDe(enviados)).toHaveLength(0);
  });

  it('scrubEvent quita cuerpo, cookies, cabeceras y consulta de la petición', () => {
    const ev = errorTracking.scrubEvent({
      request: { method: 'GET', url: 'https://x/v1/documents/person?cedula=123', data: '{"a":1}', cookies: { a: 1 }, headers: { authorization: 'b' }, query_string: 'cedula=123' },
      user: { ip_address: '1.2.3.4' },
      breadcrumbs: [{ category: 'console', message: 'cédula 123' }, { category: 'http', data: { url: 'https://x/a?cedula=1' } }],
    });
    expect(ev.request).toEqual({ method: 'GET', url: 'https://x/v1/documents/person' });
    expect(ev.user).toBeUndefined();
    expect(ev.breadcrumbs).toEqual([{ category: 'http', data: { url: 'https://x/a' } }]);
    const conValores = errorTracking.scrubEvent({ exception: { values: [{ value: 'Key (email)=(ana.perez@correo.co) y (cedula)=(43123456) ya existe' }] } });
    expect(conValores.exception.values[0].value).toBe('Key (email)=([correo]) y (cedula)=([número]) ya existe');
  });
});

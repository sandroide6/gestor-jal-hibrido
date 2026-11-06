'use strict';
// Auditoría 2026-11-05, P3-4: la consulta de datos de identidad por cédula solo tenía el
// límite general (300 por minuto), así que servía para recorrer el padrón. Ahora tiene
// un límite propio por usuario (60 cada 10 minutos) y cada consulta queda en auditoría.
process.env.NODE_ENV = 'test';
const request = require('supertest');
const h = require('./helpers');

let app;
let AuditLog;
beforeAll(() => {
  app = require('../../src/app');
  ({ AuditLog } = require('../../src/models'));
});

describe('Consulta por cédula (integración, base real)', () => {
  it('a partir de la consulta 61 en 10 minutos responde 429; otro usuario no se ve afectado', async () => {
    const a = await h.login(app, (await h.createTestUser('auxiliar')).email);
    const b = await h.login(app, (await h.createTestUser('auxiliar')).email);
    const consultar = (s, i) => request(app).get(`/v1/documents/person?cedula=${9000000 + i}`).set('Cookie', s.cookie);

    const estados = [];
    for (let i = 0; i < 61; i++) estados.push((await consultar(a, i)).status);
    expect(estados.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(estados[60]).toBe(429);
    expect((await consultar(b, 1)).status).toBe(200);

    const registradas = await AuditLog.count({ where: { user_id: a.user.id, action: 'document.person_lookup' } });
    expect(registradas).toBe(60);
  }, 60000);
});

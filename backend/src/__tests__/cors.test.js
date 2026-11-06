'use strict';
// CORS (auditoría de producción 2026-11-05, P0-3). Antes se aceptaba con credenciales
// cualquier subdominio de trycloudflare.com, ngrok, loca.lt y serveo: cualquiera puede
// crear uno gratis, así que una página ajena podía leer datos con la sesión de la
// víctima. Ahora solo pasan ALLOWED_ORIGINS y el propio origen del servidor (modo
// túnel local, donde el frontend se sirve desde el mismo host). Los patrones de túnel
// quedan detrás de ALLOW_TUNNEL_ORIGINS=true, apagado por defecto.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../app');

// Ruta inexistente: responde 404 sin tocar la base, pero pasa por el middleware de CORS
const PATH = '/v1/__cors_probe__';
const get = (origin, extra = {}) => {
  let r = request(app).get(PATH).set('Origin', origin);
  for (const [k, v] of Object.entries(extra)) r = r.set(k, v);
  return r;
};

afterEach(() => { delete process.env.ALLOW_TUNNEL_ORIGINS; });

describe('CORS — solo orígenes configurados', () => {
  it('permite un origen de ALLOWED_ORIGINS (por defecto http://localhost:5173) con credenciales', async () => {
    const res = await get('http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it.each([
    'https://atacante-cualquiera.trycloudflare.com',
    'https://a1b2-190-1-1-1.ngrok-free.app',
    'https://mi-tunel.ngrok.io',
    'https://x.loca.lt',
    'https://x.serveo.net',
  ])('rechaza el subdominio de túnel público %s', async (origin) => {
    const res = await get(origin);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.status).toBe(403);
  });

  it('rechaza un origen ajeno con 403 y sin traza', async () => {
    const res = await get('https://evil.com');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.body.message).toMatch(/Origen no permitido por CORS/);
    expect(res.body.stack).toBeUndefined();
  });

  it('acepta el mismo origen del servidor (modo túnel local: frontend y API en el mismo host)', async () => {
    const res = await get('https://mi-tunel.ngrok-free.app', { Host: 'mi-tunel.ngrok-free.app' });
    expect(res.headers['access-control-allow-origin']).toBe('https://mi-tunel.ngrok-free.app');
  });

  it('con ALLOW_TUNNEL_ORIGINS=true vuelve a aceptar subdominios de túnel anclados', async () => {
    process.env.ALLOW_TUNNEL_ORIGINS = 'true';
    const ok = await get('https://random-words.trycloudflare.com');
    expect(ok.headers['access-control-allow-origin']).toBe('https://random-words.trycloudflare.com');
    const bad = await get('https://x.ngrok-evil.com');
    expect(bad.status).toBe(403);
  });

  it('permite peticiones sin cabecera Origin (curl, health checks)', async () => {
    const res = await request(app).get(PATH);
    expect(res.status).toBe(404);
  });
});

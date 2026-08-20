'use strict';
// Fix: app.js — los patrones de CORS para túneles (ngrok, cloudflare, serveo, loca.lt)
// no estaban anclados con ^ al inicio, y el de ngrok terminaba en `.*$` (comodín
// abierto). Esto permitía que un origen atacante que solo CONTUVIERA la subcadena
// ".ngrok-" o ".ngrok." en cualquier posición del hostname pasara la validación de
// CORS — con `credentials: true`, eso habilita CSRF de sesión desde un dominio ajeno.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../app');

async function originStatus(origin) {
  const res = await request(app).get('/health').set('Origin', origin);
  return res;
}

describe('CORS — patrones de túneles anclados', () => {
  it('permite un subdominio real de ngrok-free.app', async () => {
    const res = await originStatus('https://a1b2-190-1-1-1.ngrok-free.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://a1b2-190-1-1-1.ngrok-free.app');
    expect(res.status).toBe(200);
  });

  it('permite un subdominio real de ngrok.io (legado)', async () => {
    const res = await originStatus('https://mi-tunel.ngrok.io');
    expect(res.headers['access-control-allow-origin']).toBe('https://mi-tunel.ngrok.io');
  });

  it('permite un subdominio real de trycloudflare.com', async () => {
    const res = await originStatus('https://random-words-here.trycloudflare.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://random-words-here.trycloudflare.com');
  });

  it('rechaza un dominio atacante que solo CONTIENE ".ngrok-" como subcadena (regresión del hallazgo de auditoría)', async () => {
    const res = await originStatus('https://x.ngrok-evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Origen no permitido por CORS/);
  });

  it('rechaza un dominio atacante que solo CONTIENE ".ngrok." como subcadena', async () => {
    const res = await originStatus('https://x.ngrok.evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.status).toBe(500);
  });

  it('rechaza un dominio atacante que termina en "trycloudflare.com" sin el punto separador', async () => {
    const res = await originStatus('https://evil-trycloudflare.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.status).toBe(500);
  });

  it('rechaza un origen completamente ajeno', async () => {
    const res = await originStatus('https://evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.status).toBe(500);
  });

  it('permite requests sin header Origin (mismo origen / curl / apps nativas)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

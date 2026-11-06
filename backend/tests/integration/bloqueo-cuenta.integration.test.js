'use strict';
// Auditoría 2026-11-05, P3-2: con 10 contraseñas erradas la cuenta quedaba bloqueada 15
// minutos para TODOS. Quien conociera el correo del administrador podía dejarlo fuera
// desde un solo equipo. Ahora un solo origen se frena con el límite por IP (10 fallos →
// 429 para esa IP) y la cuenta solo se bloquea ante un ataque desde muchos orígenes.
process.env.NODE_ENV = 'test';
const request = require('supertest');
const h = require('./helpers');

let app;
beforeAll(() => { app = require('../../src/app'); });

const intento = (email, password, ip) => request(app)
  .post('/v1/auth/login')
  .set('X-Forwarded-For', ip)
  .send({ email, password });

describe('Bloqueo de cuenta por terceros (integración, base real)', () => {
  it('10 fallos desde un equipo no impiden que el dueño entre desde otro', async () => {
    const u = await h.createTestUser('administrador');
    const atacante = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < 10; i++) {
      const r = await intento(u.email, 'clave-equivocada', atacante);
      expect(r.status).toBe(401);
    }
    // El atacante queda frenado por IP
    expect((await intento(u.email, 'clave-equivocada', atacante)).status).toBe(429);
    // El dueño, desde otro equipo, entra normalmente
    const dueño = await intento(u.email, u.password, '198.51.100.7');
    expect(dueño.status).toBe(200);
  }, 30000);

  it('un ataque desde muchos equipos sí bloquea la cuenta', async () => {
    const u = await h.createTestUser('auxiliar');
    let ultimo;
    for (let i = 0; i < 30; i++) {
      ultimo = await intento(u.email, 'clave-equivocada', `192.0.2.${(i % 10) + 1}${Math.floor(i / 10)}`);
    }
    expect(ultimo.status).toBe(401);
    const bloqueada = await intento(u.email, u.password, '198.51.100.8');
    expect(bloqueada.status).toBe(423);
  }, 60000);
});
